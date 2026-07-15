/**
 * providers/browser.js — Browser-based stream provider
 *
 * Uses Puppeteer to navigate to an earnings-call (or similar) page,
 * capture audio via MediaRecorder from the browser, and send raw PCM
 * audio over WebSocket to the remote server. The browser stays open
 * for the duration — we don't try to hijack the underlying stream URL.
 */

const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { runSiteHandlers } = require("../lib/site_handlers");
const { HEADLESS } = require("../lib/args");

puppeteer.use(StealthPlugin());

let ffmpegProc = null;
let browser = null;

let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;
let _isStopped = false;
let _retryTimeout = null;

// ── FFmpeg Transcoder (Browser WebM -> Raw PCM) ──────────────────────
function setupAudioTranscoder(inputUrl = "pipe:0", retryCount = 0) {
  if (_isStopped) return;
  _logger.info(
    `[transcoder] Starting FFmpeg transcoder for URL: ${inputUrl} (Retry ${retryCount})`,
  );

  const ffmpegArgs = [
    "-fflags",
    "nobuffer",
    "-flags",
    "low_delay",
    "-probesize",
    "64000",
    "-analyzeduration",
    "200000",
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
    try {
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        _ws.send(data);
      }
    } catch (e) {
      _logger.warn(`[transcoder] send error: ${e.message || String(e)}`);
    }
  });

  ffmpeg.stdout.on("error", (err) => {
    _logger.error(`[transcoder] stdout stream error: ${err.message || String(err)}`);
  });

  ffmpeg.stderr.on("data", (data) => {
    _logger.trace(`[transcoder] ${data.toString().trim()}`);
  });

  ffmpeg.stderr.on("error", (err) => {
    _logger.error(`[transcoder] stderr stream error: ${err.message || String(err)}`);
  });

  ffmpeg.on("close", (code) => {
    _logger.info(`[transcoder] FFmpeg exited with code ${code}`);
    if (!_isStopped && code !== 0 && code !== 255) {
      const delay = Math.min(10000, 1000 * Math.pow(2, retryCount));
      _logger.info(`[transcoder] Retrying FFmpeg in ${delay}ms...`);
      _retryTimeout = setTimeout(() => {
        setupAudioTranscoder(inputUrl, retryCount + 1);
      }, delay);
    }
  });

  ffmpeg.on("error", (err) => {
    _logger.error(`[transcoder] Spawn error: ${err.message || String(err)}`);
  });

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

// ── Browser Capture Logic ────────────────────────────────────────────
async function runBrowserCapture(market) {
  _logger.info(`[browser] Launching Puppeteer...`);

  const executablePaths = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  let browserPath = null;
  const fs = require("fs");
  for (const p of executablePaths) {
    if (fs.existsSync(p)) {
      browserPath = p;
      break;
    }
  }

  browser = await puppeteer.launch({
    executablePath: browserPath,
    defaultViewport: null,
    headless: HEADLESS,
    args: [
      "--start-maximized",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--disable-web-security",
    ],
    userDataDir: `/tmp/chrome-${market.slug || Date.now()}`,
  });

  const page = await browser.newPage();
  page.on("console", (msg) => _logger.trace(`[Browser] ${msg.text()}`));

  // Expose audio chunk handler
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
  });

  try {
    _logger.info(`[browser] Navigating to ${_streamUrl}...`);
    await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // 1. Run Site-Specific Handlers (Logins, Registration, etc.)
    await runSiteHandlers(_streamUrl, page, _logger);

    // 2. Play Video Loop
    await page.evaluate(() => {
      const interval = setInterval(() => {
        const video = document.querySelector("video");
        if (video && video.paused) {
          video.muted = false;
          video.play().catch((e) => console.log("play() rejected:", e.message));
        }
      }, 1000);
      window._playInterval = interval;
    });

    // 3. Set up browser-based audio capture (MediaRecorder + captureStream)
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
            const audioCtx = new AudioContext();
            if (audioCtx.state === "suspended") await audioCtx.resume();
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

      document.addEventListener(
        "play",
        (e) => {
          if (e.target && e.target.tagName === "VIDEO") {
            console.log("Video play event detected, trying to capture...");
            setupCapture(e.target);
          }
        },
        true,
      );
      document.addEventListener(
        "playing",
        (e) => {
          if (e.target && e.target.tagName === "VIDEO") {
            console.log("Video playing event detected, trying to capture...");
            setupCapture(e.target);
          }
        },
        true,
      );

      for (const vid of document.querySelectorAll("video")) {
        if (!vid.paused) {
          setupCapture(vid);
        }
      }
    });
  } catch (e) {
    throw e;
  }

  return null; // browser stays open for MediaRecorder capture
}

// ── Provider interface ──────────────────────────────────────────────

module.exports = {
  name: "browser",
  audioOnly: true,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _streamUrl = streamUrl;
    _logger = logger;
    _isShuttingDown = isShuttingDown;
    _isStopped = false;
    if (_retryTimeout) clearTimeout(_retryTimeout);

    // Optimization: if it's already a direct m3u8, skip the browser
    if (_streamUrl.toLowerCase().includes(".m3u8")) {
      _logger.info(
        `[browser] Direct m3u8 URL detected, jumping straight to transcoder.`,
      );
      setupAudioTranscoder(_streamUrl);
      return;
    }

    await runBrowserCapture(market);
  },

  updateWs(ws) {
    _ws = ws;
  },

  async stop() {
    _isStopped = true;
    if (_retryTimeout) {
      clearTimeout(_retryTimeout);
      _retryTimeout = null;
    }
    if (ffmpegProc) {
      ffmpegProc.kill();
      ffmpegProc = null;
    }
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        _logger.warn(`[browser] Error closing browser: ${e.message || String(e)}`);
      }
      browser = null;
    }
  },
};
