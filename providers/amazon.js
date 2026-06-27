/**
 * providers/amazon.js — Amazon Prime Video stream provider
 *
 * Specializes in Amazon login and Prime Video navigation,
 * capturing audio via PipeWire/PulseAudio sink.
 */

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { runSiteHandlers } = require("../lib/site_handlers");
const { HEADLESS } = require("../lib/args");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const { loginToAmazon } = require("../lib/amazon_login");

// Load environment variables for login
const envPath = path.join(__dirname, "..", ".env.prod");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

puppeteer.use(StealthPlugin());

let browser = null;
let ffmpegProc = null;
let _sinkProc = null;
let _ws = null;
let _logger = null;
let _streamUrl = null;
let _isStopped = false;
let _retryTimeout = null;

const SINK_NAME = "amazon_capture";
const MONITOR_NAME = "amazon_capture_monitor";

let _actualSinkName = SINK_NAME;
let _actualMonitorName = MONITOR_NAME;

// ── Virtual Audio Sink (PipeWire/PulseAudio) ────────────────────────
async function setupVirtualSink() {
  _logger.info(`[amazon] Setting up virtual audio sink logic...`);

  const { execSync } = require("child_process");

  // 1. Check if auto_null exists (preferred stereo sink on headless)
  try {
    const nodes = execSync("pw-link -i").toString();
    if (nodes.includes("auto_null:playback_")) {
      _logger.info(`[amazon] Detected existing auto_null sink. Using it for stereo stability.`);
      _actualSinkName = "auto_null";
      _actualMonitorName = "auto_null"; // pw-record understands "auto_null" as target
      return _actualMonitorName;
    }
  } catch (e) { }

  // 2. Fallback: Create dedicated loopback
  _logger.info(`[amazon] No auto_null found. Creating virtual audio sink: ${SINK_NAME}`);
  const proc = spawn("pw-loopback", [
    `--playback-props=node.name=${SINK_NAME} media.class=Audio/Sink node.description='Amazon Capture Sink' node.passive=true`,
    `--capture-props=node.name=${MONITOR_NAME} media.class=Audio/Source node.description='Amazon Capture Monitor' node.passive=true`,
    "-c", "2",
    "--latency=50ms"
  ]);

  proc.stdout.on("data", (d) => _logger.debug(`[pw-loopback] ${d.toString().trim()}`));
  proc.stderr.on("data", (d) => _logger.error(`[pw-loopback] ${d.toString().trim()}`));
  proc.on("error", (err) => _logger.error(`[pw-loopback] Spawn error: ${err.message || String(err)}`));

  _sinkProc = proc;
  _actualSinkName = SINK_NAME;
  _actualMonitorName = MONITOR_NAME;

  await new Promise(r => setTimeout(r, 2000));
  return _actualMonitorName;
}

function stopVirtualSink() {
  if (_sinkProc) {
    _logger.info(`[amazon] Stopping virtual audio sink...`);
    _sinkProc.kill();
    _sinkProc = null;
  }
}

// ── Audio Transcoder (PipeWire pw-record -> FFmpeg -> Raw PCM) ────────
function setupAudioTranscoder(retryCount = 0) {
  if (_isStopped) return;
  _logger.info(
    `[amazon-transcoder] Starting pw-record/ffmpeg capture from: ${_actualMonitorName} (Retry ${retryCount})`,
  );

  // Use pw-record to capture from our virtual monitor node
  const pwRecord = spawn("pw-record", [
    `--target=${_actualMonitorName}`,
    "--format=s16",
    "--rate=48000",
    "--channels=2",
    "-"
  ], {
    stdio: ["ignore", "pipe", "pipe"]
  });

  // Pipe pw-record output into FFmpeg to downsample to 16kHz Mono
  const ffmpegArgs = [
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "-i", "pipe:0",
    "-f", "s16le",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "pipe:1"
  ];

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  pwRecord.stdout.pipe(ffmpeg.stdin);

  ffmpeg.stdout.on("data", (data) => {
    try {
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        _ws.send(data);
      }
    } catch (e) {
      _logger.warn(`[amazon-transcoder] send error: ${e.message || String(e)}`);
    }
  });

  ffmpeg.stdout.on("error", (err) => {
    _logger.error(`[amazon-transcoder] stdout stream error: ${err.message || String(err)}`);
  });

  ffmpeg.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg.includes("Error") || msg.includes("failed")) {
      _logger.error(`[amazon-transcoder] ${msg}`);
    } else {
      _logger.trace(`[amazon-transcoder] ${msg}`);
    }
  });

  ffmpeg.stderr.on("error", (err) => {
    _logger.error(`[amazon-transcoder] stderr stream error: ${err.message || String(err)}`);
  });

  pwRecord.stdout.on("error", (err) => {
    _logger.error(`[pw-record] stdout stream error: ${err.message || String(err)}`);
  });

  pwRecord.stderr.on("data", (data) => {
    _logger.trace(`[pw-record] ${data.toString()}`);
  });

  pwRecord.stderr.on("error", (err) => {
    _logger.error(`[pw-record] stderr stream error: ${err.message || String(err)}`);
  });

  pwRecord.on("error", (err) => {
    _logger.error(`[pw-record] Spawn error: ${err.message || String(err)}`);
  });

  ffmpeg.on("close", (code) => {
    _logger.info(`[amazon-transcoder] FFmpeg exited with code ${code}`);
    pwRecord.kill();
    if (!_isStopped && code !== 0 && code !== 255) {
      const delay = Math.min(10000, 1000 * Math.pow(2, retryCount));
      _logger.info(`[amazon-transcoder] Retrying in ${delay}ms...`);
      _retryTimeout = setTimeout(() => {
        setupAudioTranscoder(retryCount + 1);
      }, delay);
    }
  });

  ffmpeg.on("error", (err) => {
    _logger.error(`[amazon-transcoder] Spawn error: ${err.message || String(err)}`);
  });

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

async function runAmazonCapture() {
  await setupVirtualSink();

  _logger.info(`[amazon] Launching Puppeteer with PULSE_SINK=${_actualSinkName}...`);

  const executablePath = "/usr/bin/google-chrome";

  browser = await puppeteer.launch({
    executablePath,
    headless: HEADLESS,
    args: [
      `--user-data-dir=/tmp/chrome-${market.slug || Date.now()}`,
      "--start-maximized",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies",
      "--disable-infobars",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1920,1080",
    ],
    env: {
      ...process.env,
      PULSE_SINK: _actualSinkName
    }
  });

  const page = await browser.newPage();
  page.on("console", (msg) => _logger.debug(`[Browser] ${msg.text()}`));

  _logger.info(`[amazon] Running manual login...`);
  await loginToAmazon(page);

  _logger.info(`[amazon] Navigating to ${_streamUrl}...`);
  await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Run site handlers (e.g., for clicking play)
  // await runSiteHandlers(_streamUrl, page, _logger);

  _logger.info(`[amazon] Starting system-level audio capture...`);
  setupAudioTranscoder();

  // Dynamic Routing Helper (PipeWire)
  const routeAudio = async () => {
    if (_isStopped) return;
    try {
      const { execSync } = require("child_process");
      const allOutPorts = execSync("pw-link -o").toString().split("\n").map(p => p.trim()).filter(p => p.length > 0);
      const allInPorts = execSync("pw-link -i").toString().split("\n").map(p => p.trim()).filter(p => p.length > 0);

      const outPorts = allOutPorts.filter(p => (p.toLowerCase().includes("chrome") || p.toLowerCase().includes("google") || p.toLowerCase().includes("amazon")));

      const sinkInPorts = allInPorts.filter(p => p.toLowerCase().includes(_actualSinkName));
      const ffmpegInPorts = allInPorts.filter(p => p.toLowerCase().includes("lavf") && p.includes("input_"));

      if (outPorts.length > 0) {
        _logger.info(`[amazon] Active output ports found: ${outPorts.join(", ")}`);
      } else if (Math.random() < 0.1) {
        _logger.debug(`[amazon] No Chrome/Amazon ports found. Available: ${allOutPorts.join(", ")}`);
      }

      // Check if video is muted
      try {
        const videoStatus = await page.evaluate(() => {
          const v = document.querySelector("video");
          if (!v) return "no-video";
          return {
            muted: v.muted,
            paused: v.paused,
            volume: v.volume,
            played: v.played.length > 0
          };
        });

        if (videoStatus && videoStatus !== "no-video") {
          if (videoStatus.muted) {
            _logger.info(`[amazon] Video is muted, unmuting...`);
            await page.evaluate(() => {
              const v = document.querySelector("video");
              if (v) v.muted = false;
            });
          }
          if (videoStatus.paused && videoStatus.played) {
            _logger.info(`[amazon] Video is paused but has played before, resuming...`);
            await page.evaluate(() => {
              const v = document.querySelector("video");
              if (v) v.play().catch(() => { });
            });
          }
        }
      } catch (e) { }

      for (const outPort of outPorts) {
        const isLeft = outPort.includes("_FL") || outPort.includes("_0") || outPort.includes("_L");

        // Target 1: Virtual Sink (Specifically target _actualSinkName)
        const matchingSinkIn = sinkInPorts.find(p => (isLeft && (p.includes("_FL") || p.includes("_0") || p.includes("_L"))) || (!isLeft && (p.includes("_FR") || p.includes("_1") || p.includes("_R"))));
        if (matchingSinkIn) {
          try {
            _logger.debug(`[amazon] Linking ${outPort} -> ${matchingSinkIn}`);
            execSync(`pw-link "${outPort}" "${matchingSinkIn}"`, { stdio: "ignore" });
          } catch (e) { }
        }

        // Target 2: FFmpeg (Direct)
        const matchingFfmpegIn = ffmpegInPorts.find(p => (isLeft && (p.includes("_FL") || p.includes("_0") || p.includes("_L"))) || (!isLeft && (p.includes("_FR") || p.includes("_1") || p.includes("_R"))));
        if (matchingFfmpegIn) {
          try {
            _logger.debug(`[amazon] Direct linking to FFmpeg: ${outPort} -> ${matchingFfmpegIn}`);
            execSync(`pw-link "${outPort}" "${matchingFfmpegIn}"`, { stdio: "ignore" });
          } catch (e) { }
        }
      }
    } catch (e) {
      _logger.debug(`[amazon] Routing check failed: ${e.message}`);
    }
    setTimeout(routeAudio, 3000);
  };
  routeAudio();

  return page;
}

module.exports = {
  name: "amazon",
  audioOnly: true,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _logger = logger;
    _streamUrl = streamUrl;
    _isStopped = false;

    try {
      await runAmazonCapture();
    } catch (e) {
      _logger.error(`[amazon] Failed to start Amazon capture: ${e.message}`);
      throw e;
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
      _logger.info(`[amazon] Killing FFmpeg transcoder...`);
      ffmpegProc.kill();
      ffmpegProc = null;
    }
    if (browser) {
      _logger.info(`[amazon] Stopping browser...`);
      browser.close().catch(() => { });
      browser = null;
    }
    stopVirtualSink();
  },
};
