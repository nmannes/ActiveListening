/**
 * providers/tv.js — TVHeadEnd stream provider
 *
 * Captures audio from a TVHeadEnd MPEG-TS stream via ffmpeg,
 * demuxes the audio track (no transcoding), and streams the
 * compressed audio over WebSocket. Optionally grabs video frames.
 */

const { spawn } = require("child_process");
const path = require("path");
const WebSocket = require("ws");

let ffmpegProc = null;
let frameGrabberProc = null;
let listenProc = null;

const RESPAWN_DELAY_MS = 3_000;

let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;
let _listen = false;

// ── FFmpeg audio pipeline ────────────────────────────────────────────
function spawnFFmpeg() {
  if (_isShuttingDown()) return;

  _logger.info(`[ffmpeg] Spawning: ${_streamUrl}`);

  const ffmpegArgs = [
    '-y',
    // Minimize latency (but probe enough to detect AC3 stream params)
    '-fflags', 'nobuffer+genpts+discardcorrupt',
    '-flags', 'low_delay',
    '-probesize', '1000000',
    '-analyzeduration', '1000000',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', _streamUrl,
    // Output: raw PCM to stdout — send over WebSocket (reliable TCP)
    '-map', '0:m:language:eng',
    '-c:a', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    '-f', 's16le', 'pipe:1'
  ];


  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let totalBytes = 0;
  let lastLogTime = 0;

  ffmpeg.stdout.on("data", (data) => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      totalBytes += data.length;

      // Log every 1MB of data
      const now = Date.now();
      if (now - lastLogTime > 10000) { // Every 10 seconds
        _logger.debug(`[ffmpeg] Sent ${Math.round(totalBytes / 1024 / 1024)}MB total, last chunk: ${data.length} bytes`);
        lastLogTime = now;
      }

      // Check for reasonable chunk sizes (should be multiples of frame size)
      const expectedFrameSize = 16000 * 2 * 0.75; // 0.75 seconds at 16kHz 16-bit
      if (data.length > 0 && data.length % 2 !== 0) {
        _logger.warn(`[ffmpeg] Odd byte count: ${data.length} - possible corruption`);
      }

      _ws.send(data);
    } else {
      _logger.warn(`[ffmpeg] Dropping ${data.length} bytes - WebSocket not ready`);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    const lines = data
      .toString()
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      _logger.trace(`[ffmpeg] ${line}`);

      // Look for audio-specific errors
      if (line.includes("Invalid frame dimensions") ||
        line.includes("corrupted") ||
        line.includes("error") ||
        line.includes("failed")) {
        _logger.error(`[ffmpeg] Audio stream issue: ${line}`);
      }

      // Look for audio stream info
      if (line.includes("Audio:") && line.includes("ac3")) {
        _logger.info(`[ffmpeg] Audio stream detected: ${line}`);
      }
    }
  });

  ffmpeg.on("close", (code) => {
    if (_isShuttingDown()) {
      _logger.info(`[ffmpeg] Exited (code ${code}) — shutting down`);
      return;
    }
    _logger.warn(
      `[ffmpeg] Exited (code ${code}), respawning in ${RESPAWN_DELAY_MS / 1000}s...`,
    );
    setTimeout(spawnFFmpeg, RESPAWN_DELAY_MS);
  });

  ffmpeg.on("error", (err) => {
    _logger.error(`[ffmpeg] Spawn error: ${err.message}`);
  });

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

// ── Video frame grabber (1 frame every 2s) ──────────────────────────
function spawnFrameGrabber() {
  if (_isShuttingDown()) return;

  _logger.info(`[frames] Starting frame grabber: ${_streamUrl}`);

  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-fflags",
      "nobuffer+genpts+discardcorrupt",
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-i",
      _streamUrl,
      "-vf",
      "fps=0.5",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "-q:v",
      "5",
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let jpegBuffer = Buffer.alloc(0);

  ffmpeg.stdout.on("data", (data) => {
    jpegBuffer = Buffer.concat([jpegBuffer, data]);

    let endIdx;
    while ((endIdx = jpegBuffer.indexOf(Buffer.from([0xff, 0xd9]))) !== -1) {
      const startIdx = jpegBuffer.indexOf(Buffer.from([0xff, 0xd8]));
      if (startIdx === -1 || startIdx > endIdx) {
        jpegBuffer = jpegBuffer.slice(endIdx + 2);
        continue;
      }

      const frame = jpegBuffer.slice(startIdx, endIdx + 2);
      jpegBuffer = jpegBuffer.slice(endIdx + 2);

      if (_ws && _ws.readyState === WebSocket.OPEN) {
        const header = Buffer.from([0x01]);
        _ws.send(Buffer.concat([header, frame]));
        _logger.info(`[frames] Sent frame: ${frame.length / 1024} KB`);
      }
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    const lines = data
      .toString()
      .split("\n")
      .filter((l) => l.trim());
    for (const line of lines) {
      _logger.trace(`[frames] ${line}`);
    }
  });

  ffmpeg.on("close", (code) => {
    if (_isShuttingDown()) {
      _logger.info(`[frames] Exited (code ${code}) — shutting down`);
      return;
    }
    _logger.warn(
      `[frames] Exited (code ${code}), respawning in ${RESPAWN_DELAY_MS / 1000}s...`,
    );
    setTimeout(spawnFrameGrabber, RESPAWN_DELAY_MS);
  });

  ffmpeg.on("error", (err) => {
    _logger.error(`[frames] Spawn error: ${err.message}`);
  });

  frameGrabberProc = ffmpeg;
  return ffmpeg;
}

// ── Local audio debug recording (--listen) ──────────────────────────
function spawnListener() {
  if (!_listen || _isShuttingDown()) return;
  const outFile = path.join(__dirname, "..", "debug_audio.wav");
  _logger.info(`[listen] Recording 30s of audio to ${outFile}`);
  listenProc = spawn(
    "ffmpeg",
    [
      "-y",
      "-probesize",
      "1000000",
      "-analyzeduration",
      "1000000",
      "-i",
      _streamUrl,
      "-map",
      "0:m:language:eng",
      "-c:a",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-t",
      "30",
      outFile,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  listenProc.stderr.on("data", () => { });
  listenProc.on("close", (code) => {
    _logger.info(`[listen] Saved debug audio to ${outFile} (exit ${code})`);
  });
}

// ── Provider interface ──────────────────────────────────────────────

module.exports = {
  name: "tv",
  audioOnly: false,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _streamUrl = streamUrl;
    _logger = logger;
    _isShuttingDown = isShuttingDown;
    _listen = !!args.listen;

    if (_listen) _logger.info(`[listen] Local audio playback enabled`);

    spawnFFmpeg();
    spawnFrameGrabber();
    if (_listen) spawnListener();
  },

  /** Called by client.js when ws reconnects — update the reference */
  updateWs(ws) {
    _ws = ws;
  },

  stop() {
    if (ffmpegProc) ffmpegProc.kill();
    if (frameGrabberProc) frameGrabberProc.kill();
    if (listenProc) listenProc.kill();
    ffmpegProc = null;
    frameGrabberProc = null;
    listenProc = null;
  },
};
