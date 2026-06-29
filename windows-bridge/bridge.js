#!/usr/bin/env node
/**
 * windows-bridge/bridge.js — Windows VM streaming bridge
 *
 * WebSocket server that receives start/stop commands from the Linux host,
 * launches Chromium + ffmpeg locally on Windows, and streams PCM audio
 * directly to the remote EC2 server. Windows Chrome has Widevine CDM,
 * so DRM-protected sites (Peacock, Netflix) work.
 *
 * Management protocol (ws://0.0.0.0:8095):
 *   { type: "start", url, serverWsUrl, runUUID }
 *   { type: "stop" }
 *   { type: "status" }  →  { running: true|false }
 */

const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");

const puppeteer = require("puppeteer");

// ── State ──────────────────────────────────────────────────────────────
let ffmpegProc = null;
let browser = null;
let serverWs = null;       // WebSocket to the EC2 server
let mgmtWs = null;         // WebSocket back to the management client
let isRunning = false;
let currentUrl = null;

// ── Logging ────────────────────────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] ${msg}`;
  console.error(line);
  // Forward to management client if connected
  if (mgmtWs && mgmtWs.readyState === 1) {
    try { mgmtWs.send(JSON.stringify({ type: "log", level, message: msg })); } catch {}
  }
}

// ── FFmpeg Transcoder ──────────────────────────────────────────────────
function setupFFmpeg(inputUrl, retryCount = 0) {
  if (!isRunning) return;

  log("info", `Starting FFmpeg transcoder: ${inputUrl} (retry ${retryCount})`);

  const ffmpegArgs = [
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "64000",
    "-analyzeduration", "200000",
    "-i", inputUrl,
    "-f", "s16le",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-flush_packets", "1",
    "pipe:1",
  ];

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpeg.stdout.on("data", (data) => {
    try {
      if (serverWs && serverWs.readyState === 1) {
        serverWs.send(data);
      }
    } catch (e) {
      log("warn", `FFmpeg send error: ${e.message}`);
    }
  });

  ffmpeg.stdout.on("error", (err) => {
    log("error", `FFmpeg stdout stream error: ${err.message}`);
  });

  ffmpeg.stderr.on("data", (data) => {
    // FFmpeg logs to stderr — trace only
    const text = data.toString().trim();
    if (text) log("trace", `[ffmpeg] ${text}`);
  });

  ffmpeg.on("error", (err) => {
    log("error", `FFmpeg process error: ${err.message}`);
  });

  ffmpeg.on("exit", (code, signal) => {
    log("warn", `FFmpeg exited (code=${code}, signal=${signal})`);
    ffmpegProc = null;
    if (isRunning && code !== 0 && code !== null) {
      // Exponential backoff retry
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      log("info", `Retrying FFmpeg in ${delay}ms...`);
      setTimeout(() => setupFFmpeg(inputUrl, retryCount + 1), delay);
    }
  });

  ffmpegProc = ffmpeg;
}

// ── Browser Capture ────────────────────────────────────────────────────
async function runBrowserCapture(url) {
  log("info", `Launching browser for ${url}...`);

  browser = await puppeteer.launch({
    headless: false,  // DRM often requires non-headless
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-blink-features=AutomationControlled",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const page = await browser.newPage();

  // Expose function for MediaRecorder audio chunks
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
  });

  // Expose function for direct m3u8 discovery
  let m3u8Found = null;
  await page.exposeFunction("reportM3U8", (m3u8Url) => {
    log("info", `m3u8 discovered: ${m3u8Url}`);
    m3u8Found = m3u8Url;
  });

  try {
    log("info", `Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // In-page audio capture setup (same pattern as providers/browser.js)
    await page.evaluate(() => {
      // Play any paused video elements
      const playInterval = setInterval(() => {
        const videos = document.querySelectorAll("video");
        for (const v of videos) {
          if (v.paused) {
            v.muted = false;
            v.play().catch(() => {});
          }
        }
      }, 1000);
      window._playInterval = playInterval;

      let captureStarted = false;
      const RECORDER_MIME = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      async function setupCapture(videoElement) {
        if (captureStarted) return;

        let stream = null;
        try {
          stream = videoElement.captureStream();
          if (stream.getAudioTracks().length === 0) throw new Error("No audio tracks");
        } catch (e) {
          try {
            const audioCtx = new AudioContext();
            if (audioCtx.state === "suspended") await audioCtx.resume();
            const source = audioCtx.createMediaElementSource(videoElement);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(audioCtx.destination);
            source.connect(dest);
            stream = dest.stream;
          } catch (err) {
            console.error("AudioContext fallback failed:", err.message);
            return;
          }
        }

        if (!stream || stream.getAudioTracks().length === 0) return;

        captureStarted = true;
        const audioStream = new MediaStream(stream.getAudioTracks());
        const recorder = new MediaRecorder(audioStream, {
          mimeType: RECORDER_MIME,
          audioBitsPerSecond: 128000,
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result.split(",")[1];
              if (base64) window.sendAudioChunk(base64);
            };
            reader.readAsDataURL(event.data);
          }
        };

        recorder.start(50);
        console.log("[bridge] Audio MediaRecorder active");
      }

      // Hook into any video element that starts playing
      document.addEventListener("play", (e) => {
        if (e.target && e.target.tagName === "VIDEO") {
          console.log("Video play detected, capturing...");
          setupCapture(e.target);
        }
      }, true);

      document.addEventListener("playing", (e) => {
        if (e.target && e.target.tagName === "VIDEO") {
          console.log("Video playing detected, capturing...");
          setupCapture(e.target);
        }
      }, true);

      // Capture already-playing videos
      for (const vid of document.querySelectorAll("video")) {
        if (!vid.paused) setupCapture(vid);
      }
    });

    // Wait a beat for m3u8/capture to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

  } catch (e) {
    log("error", `Browser capture error: ${e.message}`);
  }

  // If an m3u8 was discovered, close browser and use direct ffmpeg
  if (m3u8Found) {
    log("info", "Closing browser — using direct m3u8 stream");
    try { await browser.close(); } catch {}
    browser = null;
    return m3u8Found;
  }

  // If neither m3u8 nor MediaRecorder started, keep browser open
  // (MediaRecorder hooks may fire later when video actually loads)
  log("info", "Browser capture running (MediaRecorder mode)");
  return null;
}

// ── Connect to remote server ───────────────────────────────────────────
function connectToServer(serverWsUrl, helloData) {
  log("info", `Connecting to server: ${serverWsUrl}`);

  const wsModule = require("ws");
  serverWs = new wsModule.WebSocket(serverWsUrl);

  serverWs.on("open", () => {
    log("info", "Connected to server WebSocket");
    // Send hello handshake so the server knows the market, runUUID, etc.
    if (helloData) {
      serverWs.send(JSON.stringify(helloData));
      log("info", "Sent hello handshake to server");
    }
  });

  serverWs.on("message", (data) => {
    // Forward transcript/signal messages to management client
    if (mgmtWs && mgmtWs.readyState === 1) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "transcript" || msg.type === "signal" || msg.type === "speaker_identified") {
          mgmtWs.send(JSON.stringify({ type: "server_msg", data: msg }));
        }
      } catch {}
    }
  });

  serverWs.on("close", (code) => {
    log("warn", `Server WebSocket closed (code=${code})`);
    serverWs = null;
    if (isRunning) {
      log("info", "Reconnecting to server in 5s...");
      setTimeout(() => connectToServer(_serverWsUrl, _helloData), 5000);
    }
  });

  serverWs.on("error", (err) => {
    log("error", `Server WebSocket error: ${err.message}`);
  });
}

// ── Start session ──────────────────────────────────────────────────────
let _helloData = null;
let _serverWsUrl = null;

async function startSession(url, serverWsUrl, runUUID, helloData) {
  if (isRunning) {
    log("warn", "Session already running, stopping first");
    await stopSession();
  }

  isRunning = true;
  currentUrl = url;
  _serverWsUrl = serverWsUrl;
  _helloData = helloData;
  log("info", `Starting session: ${url} → ${serverWsUrl} (run: ${runUUID})`);

  // Connect to the remote server
  connectToServer(serverWsUrl, helloData);

  // Launch browser capture
  const m3u8Url = await runBrowserCapture(url);

  if (m3u8Url) {
    // Direct m3u8 stream — no browser needed for audio
    setupFFmpeg(m3u8Url);
  } else {
    // Browser MediaRecorder mode — ffmpeg reads from stdin (pipe:0)
    setupFFmpeg("pipe:0");
  }
}

// ── Stop session ───────────────────────────────────────────────────────
async function stopSession() {
  log("info", "Stopping session...");
  isRunning = false;
  currentUrl = null;

  if (ffmpegProc) {
    ffmpegProc.kill();
    ffmpegProc = null;
  }

  if (serverWs) {
    try { serverWs.close(); } catch {}
    serverWs = null;
  }

  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
  }

  log("info", "Session stopped");
}

// ── Management WebSocket server ────────────────────────────────────────
const wss = new WebSocketServer({ host: "0.0.0.0", port: 8095 });

wss.on("connection", (ws) => {
  log("info", "Management client connected");

  // Only allow one management client at a time
  if (mgmtWs) {
    try { mgmtWs.close(); } catch {}
  }
  mgmtWs = ws;

  ws.on("message", async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "start": {
        if (!msg.url || !msg.serverWsUrl) {
          ws.send(JSON.stringify({ type: "error", message: "url and serverWsUrl required" }));
          return;
        }
        try {
          await startSession(msg.url, msg.serverWsUrl, msg.runUUID || "unknown", msg.hello || null);
          ws.send(JSON.stringify({ type: "started" }));
        } catch (e) {
          ws.send(JSON.stringify({ type: "error", message: e.message }));
        }
        break;
      }

      case "stop": {
        await stopSession();
        ws.send(JSON.stringify({ type: "stopped" }));
        break;
      }

      case "status": {
        ws.send(JSON.stringify({ type: "status", running: isRunning, url: currentUrl }));
        break;
      }

      default:
        ws.send(JSON.stringify({ type: "error", message: `Unknown command: ${msg.type}` }));
    }
  });

  ws.on("close", () => {
    log("info", "Management client disconnected");
    if (mgmtWs === ws) mgmtWs = null;
  });

  ws.on("error", (err) => {
    log("error", `Management WS error: ${err.message}`);
  });
});

wss.on("error", (err) => {
  console.error(`[bridge] Server error: ${err.message}`);
  process.exit(1);
});

// ── Graceful shutdown ──────────────────────────────────────────────────
async function shutdown() {
  log("info", "Bridge shutting down...");
  await stopSession();
  wss.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.error("[bridge] Windows streaming bridge listening on ws://0.0.0.0:8095");
