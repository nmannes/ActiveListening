/**
 * providers/espn.js — ESPN-specific browser stream provider
 *
 * Uses Puppeteer to navigate to an ESPN watch page,
 * authenticates using provided cookies, and captures audio
 * via MediaRecorder to send as raw PCM over WebSocket.
 */

const { spawn } = require("child_process");
const WebSocket = require("ws");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { runSiteHandlers } = require("../lib/site_handlers");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

let ffmpegProc = null;
let browser = null;

let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;

// ── FFmpeg Transcoder (Browser WebM -> Raw PCM) ──────────────────────
function setupAudioTranscoder(inputUrl = "pipe:0") {
  _logger.info(`[transcoder] Starting FFmpeg transcoder for URL: ${inputUrl}`);

  const ffmpegArgs = [
    "-fflags",
    "nobuffer",
    "-flags",
    "low_delay",
    "-probesize",
    "5000000",
    "-analyzeduration",
    "5000000",
    "-i",
    inputUrl,
    "-f",
    "s16le",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-flush_packets",
    "1",
    "pipe:1",
  ];

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpeg.stdout.on("data", (data) => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(data);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    _logger.trace(`[transcoder] ${data.toString().trim()}`);
  });

  ffmpeg.on("close", (code) => {
    _logger.info(`[transcoder] FFmpeg exited with code ${code}`);
  });

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

// ── Browser Capture Logic ────────────────────────────────────────────
async function runBrowserCapture() {
  _logger.info(`[espn] Launching Puppeteer...`);

  const executablePaths = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  let browserPath = null;
  for (const p of executablePaths) {
    if (fs.existsSync(p)) {
      browserPath = p;
      break;
    }
  }

  browser = await puppeteer.launch({
    executablePath: browserPath,
    defaultViewport: null,
    headless: false,
    args: [
      "--start-maximized",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--disable-web-security",
    ],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => _logger.trace(`[Browser] ${msg.text()}`));

  // Load ESPN cookies if they exist
  const cookiesPath = path.join(
    __dirname,
    "..",
    "cookies",
    "espn_cookies.json",
  );
  if (fs.existsSync(cookiesPath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      _logger.info(`[espn] Loaded cookies from ${cookiesPath}`);
    } catch (e) {
      _logger.warn(`[espn] Failed to load cookies: ${e.message}`);
    }
  }

  // Expose audio chunk handler
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
  });

  try {
    _logger.info(`[espn] Navigating to ${_streamUrl}...`);
    await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // 1. Run Site-Specific Handlers
    await runSiteHandlers(_streamUrl, page, _logger);

    // 2. Play Video Loop & Audio Capture (Always use MediaRecorder for ESPN as they often have DRM/obfuscation)
    setupAudioTranscoder();
    await page.evaluate(() => {
      let captureStarted = false;

      async function setupCapture(videoElement) {
        if (captureStarted) return;
        console.log(
          "Setting up capture for video:",
          videoElement.currentSrc || videoElement.src || "(no src)",
        );

        let stream = null;
        try {
          stream = videoElement.captureStream();
          if (stream.getAudioTracks().length === 0)
            throw new Error("No audio tracks in captureStream");
        } catch (e) {
          console.log(
            "captureStream failed or no audio, trying AudioContext fallback...",
          );
          try {
            const audioCtx = new (
              window.AudioContext || window.webkitAudioContext
            )();
            const source = audioCtx.createMediaElementSource(videoElement);
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(audioCtx.destination);
            source.connect(dest);
            stream = dest.stream;
          } catch (err) {
            console.error("AudioContext fallback failed:", err.message);
          }
        }

        if (!stream) return;

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          captureStarted = true;
          const audioStream = new MediaStream(audioTracks);
          const recorder = new MediaRecorder(audioStream, {
            mimeType: "audio/webm;codecs=opus",
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
          console.log("Audio MediaRecorder active");
        }
      }

      // Ensure video plays
      const interval = setInterval(() => {
        const video = document.querySelector("video");
        if (video && video.paused) {
          video.muted = false;
          video.play().catch((e) => console.log("play() rejected:", e.message));
        }
      }, 1000);
      window._playInterval = interval;

      document.addEventListener(
        "play",
        (e) => {
          if (e.target && e.target.tagName === "VIDEO") {
            setupCapture(e.target);
          }
        },
        true,
      );

      // Immediate check
      for (const vid of document.querySelectorAll("video")) {
        if (!vid.paused) setupCapture(vid);
      }
    });
  } catch (e) {
    _logger.error(`[espn] Browser capture error: ${e.message}`);
    throw e;
  }

  return null; // browser stays open
}

// ── Provider interface ──────────────────────────────────────────────

module.exports = {
  name: "espn",
  audioOnly: true,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _streamUrl = streamUrl;
    _logger = logger;
    _isShuttingDown = isShuttingDown;

    await runBrowserCapture();
  },

  updateWs(ws) {
    _ws = ws;
  },

  stop() {
    if (ffmpegProc) {
      ffmpegProc.kill();
      ffmpegProc = null;
    }
    if (browser) {
      browser.close().catch(() => {});
      browser = null;
    }
  },
};
