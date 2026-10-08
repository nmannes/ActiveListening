/**
 * video_gif.js — rolling low-res video ring buffer + on-demand GIF builder.
 *
 * The GPU server's speaker-ask flow needs to show the operator *who* was on
 * screen when an unknown speaker talked.  The server can't capture video
 * (ephemeral EC2, no yt-dlp), the local client can — so this module keeps a
 * small in-memory ring of JPEG frames (4fps, 320px wide, ~120s) captured
 * from the same stream the session listens to, and builds a single GIF when
 * the server asks (`{type:"request_gif", req_id, age_newest, age_oldest}`).
 *
 * Everything stays in memory: frames live in the ring (≤ ~8MB), the GIF is
 * produced by ffmpeg on stdout, and binary GIFs are sent to the server ONLY
 * in direct response to a request — an unsolicited `0x02` frame would be fed
 * to Deepgram as PCM by an old server.
 */

const { spawn } = require("child_process");

const YTDLP_BIN = process.env.YT_DLP_BIN || "/home/linuxbrew/.linuxbrew/bin/yt-dlp";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

const CAPTURE_FPS = 4;
const FRAME_WIDTH = 320;
const RING_SECS = 120;
const RING_MAX_BYTES = 8 * 1024 * 1024;
const MAX_PARTIAL_BYTES = 2 * 1024 * 1024; // resync guard on a corrupt stream
const RESPAWN_DELAY_MS = 5_000;
const RESPAWN_MAX_DELAY_MS = 60_000;
const YTDLP_TIMEOUT_MS = 60_000;
const BUILD_TIMEOUT_MS = 15_000;
const PAD_SECS = 2.0; // audio/video pipeline skew (independent pipelines, 1-5s)
const MIN_FRAMES = 3;

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

// ── Pure helpers (Bun-testable) ──────────────────────────────────────

/**
 * How (if at all) this stream URL can be read for video frames.
 * "youtube" — re-extract a direct video URL with yt-dlp;
 * "direct"  — ffmpeg can open it as-is (HLS/mp4/ts);
 * null      — page-based / DRM sources we can't capture (browser, yttv, …).
 */
function extractStrategy(streamUrl) {
  if (!streamUrl) return null;
  const u = String(streamUrl);
  if (/(^|[./])youtube\.com\/|youtu\.be\//.test(u)) return "youtube";
  if (/^https?:\/\/localhost:9981/.test(u)) return "direct";
  if (/^https?:\/\//.test(u) && /\.(m3u8|mp4|ts)([?#]|$)/i.test(u)) return "direct";
  return null;
}

/** Split a chunk of an mjpeg stream into complete JPEG frames. */
function scanFrames(prev, chunk) {
  let buf = prev.length ? Buffer.concat([prev, chunk]) : chunk;
  const frames = [];
  let endIdx;
  while ((endIdx = buf.indexOf(EOI)) !== -1) {
    const startIdx = buf.indexOf(SOI);
    if (startIdx === -1 || startIdx > endIdx) {
      buf = buf.slice(endIdx + 2);
      continue;
    }
    frames.push(buf.slice(startIdx, endIdx + 2));
    buf = buf.slice(endIdx + 2);
  }
  if (buf.length > MAX_PARTIAL_BYTES) buf = Buffer.alloc(0);
  return { frames, rest: buf };
}

/** Drop frames older than `bufferSecs` (or beyond the byte cap). Mutates. */
function evictRing(ring, now, opts = {}) {
  const bufferSecs = opts.bufferSecs || RING_SECS;
  const maxBytes = opts.maxBytes || RING_MAX_BYTES;
  const cutoff = now - bufferSecs * 1000;
  while (ring.length && ring[0].ts < cutoff) ring.shift();
  let bytes = 0;
  for (const f of ring) bytes += f.data.length;
  while (ring.length > MIN_FRAMES && bytes > maxBytes) {
    bytes -= ring.shift().data.length;
  }
  return ring;
}

/**
 * Frames covering the requested audio-age window, padded for the audio/video
 * pipeline skew.  `age` = seconds before now (audio-clock, from the server's
 * WAV byte offsets).
 */
function selectFrames(ring, now, opts) {
  const pad = opts.padSecs === undefined ? PAD_SECS : opts.padSecs;
  const maxSpan = opts.maxSpanSecs || 20;
  const oldest = Math.min(Math.max(0, opts.ageOldest) + pad, maxSpan + pad);
  const newest = Math.max(0, opts.ageNewest - pad);
  const start = now - oldest * 1000;
  const end = now - newest * 1000;
  return ring.filter((f) => f.ts >= start && f.ts <= end);
}

/** Degradation ladder for oversize GIFs: biggest/smoothest first. */
function gifLadder(fps, width) {
  const half = Math.max(1, Math.round(fps / 2));
  return [
    { scale: 1.0, fps, width },
    { scale: 1.0, fps: half, width },
    { scale: 0.75, fps: half, width },
    { scale: 0.5, fps: half, width },
  ];
}

/** ffmpeg args: mjpeg from stdin → single-pass palette GIF on stdout. */
function gifArgs({ fps, width, scale = 1.0 }) {
  const w = Math.max(64, Math.round((width * scale) / 2) * 2);
  return [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "image2pipe",
    "-c:v", "mjpeg",
    "-framerate", String(CAPTURE_FPS),
    "-i", "pipe:0",
    "-vf",
    `fps=${fps},scale=${w}:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
    "-loop", "0",
    "-f", "gif",
    "pipe:1",
  ];
}

/** Wire format: 0x02 + "GIF1" + u32BE(req_id) + gif bytes. */
function gifMessage(reqId, gifBuffer) {
  const head = Buffer.alloc(5);
  head[0] = 0x02;
  head.write("GIF1", 1, "ascii");
  const id = Buffer.alloc(4);
  id.writeUInt32BE(reqId >>> 0, 0);
  return Buffer.concat([head, id, gifBuffer]);
}

// ── GIF build ────────────────────────────────────────────────────────

function runFfmpegOnce(frames, rung, maxBytes, logger) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, gifArgs(rung), { stdio: ["pipe", "pipe", "pipe"] });
    let out = Buffer.alloc(0);
    let stderr = "";
    let oversized = false;
    let settled = false;
    const done = (result) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };
    const timer = setTimeout(() => {
      logger.warn("[gif] build timed out — killing ffmpeg");
      try { proc.kill("SIGKILL"); } catch { /* already gone */ }
      done(null);
    }, BUILD_TIMEOUT_MS);

    proc.stdout.on("data", (d) => {
      if (oversized) return;
      out = Buffer.concat([out, d]);
      if (out.length > maxBytes) {
        oversized = true;
        try { proc.kill("SIGKILL"); } catch { /* already gone */ }
      }
    });
    proc.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-500);
    });
    proc.stdin.on("error", () => { /* EPIPE when ffmpeg dies early */ });
    proc.on("error", (err) => {
      logger.warn(`[gif] ffmpeg spawn error: ${err.message || String(err)}`);
      done(null);
    });
    proc.on("close", (code) => {
      if (oversized) return done({ oversized: true });
      if (code === 0 && out.length > 100) return done({ buffer: out });
      logger.warn(`[gif] ffmpeg exited ${code}: ${stderr.trim()}`);
      done(null);
    });

    for (const f of frames) proc.stdin.write(f.data);
    proc.stdin.end();
  });
}

// ── Manager ──────────────────────────────────────────────────────────

/**
 * Start capturing a frame ring for this session.
 * Returns null when the source can't be captured (caller logs & moves on).
 * `getWs` returns the current live WebSocket (reconnects replace it).
 */
function startVideoGif({ streamUrl, logger, cfg = {}, getWs }) {
  const strategy = extractStrategy(streamUrl);
  if (!strategy) return null;

  const bufferSecs = cfg.bufferSecs || RING_SECS;
  const maxSpanSecs = cfg.maxSpanSecs || 20;
  const maxBytes = cfg.maxBytes || 5_000_000;
  const ring = [];
  let captureProc = null;
  let ytdlpProc = null;
  let respawnTimer = null;
  let respawnDelay = RESPAWN_DELAY_MS;
  let stopped = false;

  function resolveYoutubeUrl() {
    return new Promise((resolve, reject) => {
      const proc = spawn(YTDLP_BIN, [
        "-f", `bestvideo[height<=360]/best[height<=360]/best`,
        "-g", streamUrl,
      ]);
      ytdlpProc = proc;
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { /* already gone */ }
        reject(new Error(`yt-dlp timed out after ${YTDLP_TIMEOUT_MS / 1000}s`));
      }, YTDLP_TIMEOUT_MS);
      proc.stdout.on("data", (d) => (out += d.toString()));
      proc.stderr.on("data", (d) => (err += d.toString()));
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(new Error(`yt-dlp spawn error: ${e.message || String(e)}`));
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        ytdlpProc = null;
        const first = out.split("\n").map((l) => l.trim()).filter(Boolean)[0];
        if (code === 0 && first) resolve(first);
        else reject(new Error(`yt-dlp exited ${code}: ${err.trim().slice(-300)}`));
      });
    });
  }

  function scheduleRespawn() {
    if (stopped || respawnTimer) return;
    logger.warn(`[gif] capture down — retrying in ${respawnDelay / 1000}s`);
    respawnTimer = setTimeout(() => {
      respawnTimer = null;
      spawnCapture();
    }, respawnDelay);
    respawnDelay = Math.min(respawnDelay * 2, RESPAWN_MAX_DELAY_MS);
  }

  async function spawnCapture() {
    if (stopped) return;
    let url = streamUrl;
    if (strategy === "youtube") {
      try {
        url = await resolveYoutubeUrl();
      } catch (e) {
        if (stopped) return;
        logger.warn(`[gif] yt-dlp extraction failed: ${e.message || String(e)}`);
        scheduleRespawn();
        return;
      }
      if (stopped) return;
    }

    logger.info(`[gif] frame capture starting (${strategy}, ${bufferSecs}s ring)`);
    const proc = spawn(FFMPEG_BIN, [
      "-hide_banner",
      "-loglevel", "error",
      "-fflags", "nobuffer+genpts+discardcorrupt",
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_delay_max", "5",
      "-i", url,
      "-vf", `fps=${CAPTURE_FPS},scale=${FRAME_WIDTH}:-2`,
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-q:v", "5",
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    captureProc = proc;

    let buf = Buffer.alloc(0);
    proc.stdout.on("data", (chunk) => {
      const scanned = scanFrames(buf, chunk);
      buf = scanned.rest;
      if (!scanned.frames.length) return;
      const now = Date.now();
      for (const data of scanned.frames) ring.push({ ts: now, data });
      evictRing(ring, now, { bufferSecs, maxBytes: RING_MAX_BYTES });
      respawnDelay = RESPAWN_DELAY_MS; // healthy again
    });
    proc.stdout.on("error", () => { /* stream torn down on kill */ });
    proc.stderr.on("data", (d) => logger.debug(`[gif] ${d.toString().trim()}`));
    proc.on("error", (err) => logger.warn(`[gif] capture spawn error: ${err.message || String(err)}`));
    proc.on("close", (code) => {
      captureProc = null;
      if (stopped) return;
      logger.warn(`[gif] capture exited (code ${code})`);
      scheduleRespawn();
    });
  }

  async function handleRequest(msg) {
    const reqId = Number(msg.req_id) >>> 0;
    const sendJson = (obj) => {
      const ws = getWs && getWs();
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    };
    const unavailable = (reason) => {
      logger.info(`[gif] request ${reqId}: ${reason}`);
      sendJson({ type: "gif_unavailable", req_id: reqId, reason });
    };

    if (stopped) return unavailable("capture stopped");
    const frames = selectFrames(ring, Date.now(), {
      ageNewest: Number(msg.age_newest) || 0,
      ageOldest: Number(msg.age_oldest) || 0,
      maxSpanSecs,
    });
    if (frames.length < MIN_FRAMES) {
      return unavailable(`only ${frames.length} frame(s) buffered in window`);
    }

    const width = Math.min(Number(msg.width) || FRAME_WIDTH, FRAME_WIDTH);
    const fps = Math.min(Number(msg.fps) || CAPTURE_FPS, CAPTURE_FPS);
    for (const rung of gifLadder(fps, width)) {
      const res = await runFfmpegOnce(frames, rung, maxBytes, logger);
      if (res && res.buffer) {
        logger.info(
          `[gif] request ${reqId}: ${res.buffer.length} bytes ` +
          `(${frames.length} frames, scale ${rung.scale}, fps ${rung.fps})`
        );
        const ws = getWs && getWs();
        if (ws && ws.readyState === 1) ws.send(gifMessage(reqId, res.buffer));
        else logger.warn(`[gif] request ${reqId}: websocket not open — dropping reply`);
        return undefined;
      }
    }
    return unavailable("build failed or over size cap");
  }

  spawnCapture();

  return {
    strategy,
    ringSize: () => ring.length,
    handleRequest,
    stop() {
      stopped = true;
      if (respawnTimer) clearTimeout(respawnTimer);
      respawnTimer = null;
      for (const proc of [captureProc, ytdlpProc]) {
        if (!proc) continue;
        try { proc.kill("SIGKILL"); } catch { /* already gone */ }
      }
      captureProc = null;
      ytdlpProc = null;
    },
  };
}

module.exports = {
  startVideoGif,
  extractStrategy,
  scanFrames,
  evictRing,
  selectFrames,
  gifLadder,
  gifArgs,
  gifMessage,
  CAPTURE_FPS,
  FRAME_WIDTH,
};
