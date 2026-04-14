/**
 * providers/yttv.js — YouTube TV stream provider
 *
 * Specializes in YouTube TV navigation, session persistence (cookies),
 * and basic interaction to ensure playback.
 */

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { runSiteHandlers } = require("../lib/site_handlers");
const { HEADLESS } = require("../lib/args");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { executablePath } = require("puppeteer");

puppeteer.use(StealthPlugin());

let browser = null;
let ffmpegProc = null;
let _ws = null;
let _logger = null;
let _streamUrl = null;
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
    if (!_isStopped && code !== 0 && code !== 255) {
      const delay = Math.min(10000, 1000 * Math.pow(2, retryCount));
      _logger.info(`[transcoder] Retrying FFmpeg in ${delay}ms...`);
      _retryTimeout = setTimeout(() => {
        setupAudioTranscoder(inputUrl, retryCount + 1);
      }, delay);
    }
  });

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

async function runYTTVCapture(page) {
  _logger.info(`[yttv] Launching Puppeteer for YouTube TV...`);


  // Expose audio chunk handler
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
  });

  // Load cookies
  const cookiePath = path.join(__dirname, "../cookies/yttv.json");
  if (fs.existsSync(cookiePath)) {
    _logger.info(`[yttv] Loading session cookies...`);
    const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
    await page.setCookie(...cookies);
  } else {
    _logger.warn(`[yttv] Cookies not found at ${cookiePath}. Authentication may fail.`);
  }

  _logger.info(`[yttv] Navigating to ${_streamUrl}...`);
  await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Run site handlers (e.g., for clicking play)
  await runSiteHandlers(_streamUrl, page, _logger);

  _logger.info(`[yttv] Starting audio capture...`);
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

  return page;
}
async function latencyReduction(page, logger, timeout = 5000) {
  try {
    await new Promise((r) => setTimeout(r, timeout)); // wait for the stream to start
    logger.info(`[yttv] Stream started, attempting to reduce latency...`);

    const keys = ["s", "Enter", "ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown", "Enter"];
    for (const key of keys) {
      await page.keyboard.press(key);
      await new Promise((r) => setTimeout(r, Math.random() * 800 + 200));
    }
    logger.info(`[yttv] Latency reduction sequence completed.`);
  } catch (e) {
    logger.warn(`[yttv] Could not automatically reduce latency: ${e.message}`);
  }
}

module.exports = {
  name: "yttv",
  audioOnly: true,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _logger = logger;
    _streamUrl = streamUrl;
    _isStopped = false;

    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: HEADLESS,
      args: [
        "--start-maximized",
        "--autoplay-policy=no-user-gesture-required",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });

    const page = await browser.newPage();


    try {
      await runYTTVCapture(page);
    } catch (e) {
      _logger.error(`[yttv] Failed to start YTTV capture: ${e.message}`);
      throw e;
    } finally {
      await latencyReduction(page, logger)
    }
  },

  updateWs(ws) {
    _ws = ws;
  },

  stop() {
    _isStopped = true;
    if (_retryTimeout) {
      clearTimeout(_retryTimeout);
      _retryTimeout = null;
    }
    if (ffmpegProc) {
      _logger.info(`[yttv] Killing FFmpeg transcoder...`);
      ffmpegProc.kill();
      ffmpegProc = null;
    }
    if (browser) {
      _logger.info(`[yttv] Stopping browser...`);
      browser.close().catch(() => { });
      browser = null;
    }
  },
};