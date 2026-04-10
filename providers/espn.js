/**
 * providers/espn.js — ESPN-specific browser stream provider
 */

const { spawn } = require("child_process");
const WebSocket = require("ws");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { runSiteHandlers } = require("../lib/site_handlers");
const { HEADLESS } = require("../lib/args");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

let ffmpegProc = null;
let browser = null;
let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;
let _isCommercial = false;

// ── Audio Stream Copier (no transcoding) ──────────────────────
function setupAudioTranscoder(inputUrl = "pipe:0") {
  _logger.info(
    `[transcoder] Starting audio stream copier for URL: ${inputUrl}`,
  );

  const ffmpegArgs = [
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "5000000",
    "-analyzeduration", "5000000",
    // Input format for raw PCM if input is pipe:0, else let ffmpeg detect
    ...(inputUrl === "pipe:0" ? ["-f", "s16le", "-ar", "16000", "-ac", "1"] : []),
    "-i", inputUrl,
    // Output format (ensure consistency)
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

  ffmpeg.stdin.on("error", (e) => {
    _logger.trace(`[transcoder] stdin error: ${e.message}`);
  });

  ffmpeg.stdout.on("data", (data) => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(data);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    _logger.info(`[transcoder] ${data.toString().trim()}`);
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
    headless: HEADLESS,
    args: [
      "--start-maximized",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--disable-popup-blocking",
      "--disable-hang-monitor",
      "--disable-sync",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-client-side-phishing-detection",
      "--disable-component-update",
      "--disable-domain-reliability",
      "--enable-audio",
      "--enable-video",
      "--allow-running-insecure-content",
      "--disable-webgl",
    ],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window._isCommercial = false;
  });

  page.on("console", (msg) => _logger.info(`[Browser] ${msg.text()}`));

  await loginToESPN(page);

  await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Expose functions
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable && !_isCommercial) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
  });

  await page.exposeFunction("logToClient", (msg) => {
    _logger.info(`[BrowserLog] ${msg}`);
  });

  try {
    _logger.info(`[espn] Navigating to ${_streamUrl}...`);

    // Monitor network requests for audio stream
    await page.setRequestInterception(true);
    const m3u8Candidates = [];
    let bestStreamFound = false;

    page.on("request", (request) => {
      const url = request.url();

      if (url.includes('.m3u8') && !url.includes('subtitle') && !url.includes('caption')) {
        _logger.debug(`[espn] Found m3u8 candidate: ${url}`);
        m3u8Candidates.push(url);

      }
      request.continue();
    });

    async function pickBestStream() {
      const deadline = Date.now() + 8000;
      while (m3u8Candidates.length === 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if (m3u8Candidates.length > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }

      const unique = [...new Set(m3u8Candidates)];
      if (unique.length === 0) return null;

      _logger.info(`[espn] ${unique.length} unique m3u8 candidates found`);

      // Prefer audio-only or high quality streams
      const audioOnly = unique.find(u => u.includes('audio') || u.includes('aac'));
      if (audioOnly) return audioOnly;

      const highQuality = unique.find(u => u.includes('128K') || u.includes('256K'));
      if (highQuality) return highQuality;

      return unique[0];
    }

    // Run site handlers
    await runSiteHandlers(_streamUrl, page, _logger);

    // Ensure playback
    await page.evaluate(() => {
      setInterval(() => {
        const video = document.querySelector("video");
        if (video && video.paused) {
          video.muted = false;
          video.play().catch((e) => console.log("play() rejected:", e.message));
        }
      }, 1000);
    });

    // Start transcoder reading from stdin
    setupAudioTranscoder();
    await new Promise((r) => setTimeout(r, 5000)); // Small delay for player stability

    // Inject capture script into all frames (handles cross-origin iframes)
    const injectCaptureToFrames = async () => {
      const frames = page.frames();
      for (const frame of frames) {
        try {
          await frame.evaluate(() => {
            if (window._captureActive) return;

            async function setupCapture(videoElement) {
              if (window._captureActive) return;
              window.logToClient(
                `Setting up PCM capture for video in frame: ${window.location.href}`,
              );

              try {
                const audioCtx = new (
                  window.AudioContext || window.webkitAudioContext
                )({ sampleRate: 16000 });
                window._audioCtx = audioCtx;

                // Cross-origin fix: setting anonymous may trigger reload if not already set,
                // but needed for browsers to allow raw audio access.
                if (videoElement.src && !videoElement.crossOrigin) {
                  videoElement.crossOrigin = "anonymous";
                }

                let source;
                try {
                  if (videoElement.captureStream) {
                    const stream = videoElement.captureStream();
                    if (stream.getAudioTracks().length > 0) {
                      source = audioCtx.createMediaStreamSource(stream);
                      window.logToClient("Using createMediaStreamSource capture");
                    }
                  }
                } catch (e) {
                  window.logToClient("captureStream failed: " + e.message);
                }

                if (!source) {
                  source = audioCtx.createMediaElementSource(videoElement);
                  window.logToClient("Using createMediaElementSource capture");
                }

                const processor = audioCtx.createScriptProcessor(16384, 1, 1);

                source.connect(processor);
                processor.connect(audioCtx.destination);
                source.connect(audioCtx.destination); // Keep hearing it in the browser

                processor.onaudioprocess = (e) => {
                  if (window._isCommercial) return;

                  const inputData = e.inputBuffer.getChannelData(0);
                  // Convert Float32 to Int16 PCM
                  const pcmData = new Int16Array(inputData.length);
                  for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                  }

                  // Efficient base64 conversion
                  const uint8 = new Uint8Array(pcmData.buffer);
                  let binary = "";
                  const chunkSize = 8192;
                  for (let i = 0; i < uint8.length; i += chunkSize) {
                    binary += String.fromCharCode.apply(
                      null,
                      uint8.subarray(i, i + chunkSize),
                    );
                  }
                  window.sendAudioChunk(btoa(binary));
                  window._pcmCount = (window._pcmCount || 0) + 1;
                };

                // Periodic resume to handle autoplay policy
                setInterval(() => {
                  if (audioCtx.state !== "running") {
                    audioCtx
                      .resume()
                      .then(() => window.logToClient("AudioContext resumed"));
                  }
                }, 3000);

                // Heartbeat
                setInterval(() => {
                  window.logToClient(
                    `PCM Heartbeat: ${window._pcmCount || 0} chunks sent from frame ${window.location.href}`,
                  );
                }, 10000);

                window._captureActive = true;
                window.logToClient("PCM capture active (16kHz mono)");
              } catch (err) {
                window.logToClient("PCM capture failed: " + err.message);
                console.error("PCM capture error", err);
              }
            }

            // Watch for play events
            document.addEventListener(
              "play",
              (e) => {
                if (e.target && e.target.tagName === "VIDEO")
                  setupCapture(e.target);
              },
              true,
            );

            // Check existing videos
            for (const vid of document.querySelectorAll("video")) {
              if (!vid.paused) setupCapture(vid);
            }
          });
        } catch (e) { }
      }
    };

    // Initial injection
    await injectCaptureToFrames();

    // Periodically re-inject to handle new iframes
    setInterval(injectCaptureToFrames, 5000);



    // Try to pick the best stream
    const bestStream = await pickBestStream();
    if (bestStream) {
      _logger.info(`[espn] Selected direct m3u8 stream: ${bestStream}`);
      _logger.info(`[espn] Closing browser to conserve resources...`);
      await browser.close().catch(() => { });
      browser = null;
      return bestStream;
    }

    _logger.warn("[espn] No direct m3u8 stream found, falling back to browser capture.");
    return null;
  } catch (e) {
    _logger.error(`[espn] Browser capture error: ${e.message}`);
    throw e;
  }

  return null;
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

    const result = await runBrowserCapture();
    if (typeof result === "string") {
      _logger.info(`[espn] Starting transcoder with extracted m3u8 stream...`);
      setupAudioTranscoder(result);
    }
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
      browser.close().catch(() => { });
      browser = null;
    }
  },
};
