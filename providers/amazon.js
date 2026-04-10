/**
 * providers/amazon.js — Amazon Prime Video stream provider
 *
 * Specializes in Amazon login and Prime Video navigation,
 * capturing audio via MediaRecorder and transcoding to PCM.
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

// ── Virtual Audio Sink (PipeWire/PulseAudio) ────────────────────────
async function setupVirtualSink() {
  _logger.info(`[amazon] Setting up virtual audio sink: ${SINK_NAME}`);

  // In PipeWire, we create a loopback device where:
  // - Playback side is a Sink (what Chrome outputs to)
  // - Capture side is a Source (what FFmpeg records from)
  const args = [
    `--playback-props=node.name=${SINK_NAME} media.class=Audio/Sink node.description='Amazon Capture Sink'`,
    `--capture-props=node.name=${MONITOR_NAME} media.class=Audio/Source node.description='Amazon Capture Monitor'`,
    "-c", "2",
    "--latency=50ms"
  ];

  const proc = spawn("pw-loopback", args, { stdio: "ignore" });
  _sinkProc = proc;

  // Give it a moment to initialize and appear in the system
  await new Promise(r => setTimeout(r, 2000));
  return MONITOR_NAME;
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
    `[amazon-transcoder] Starting pw-record/ffmpeg capture from: ${MONITOR_NAME} (Retry ${retryCount})`,
  );

  // Use pw-record to capture from our virtual monitor node
  const pwRecord = spawn("pw-record", [
    `--target=${MONITOR_NAME}`,
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
    "pipe:1",
  ];

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  pwRecord.stdout.pipe(ffmpeg.stdin);

  ffmpeg.stdout.on("data", (data) => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(data);
      if (Math.random() < 0.05) {
        _logger.info(`[amazon-transcoder] Sent ${data.length} bytes to server`);
      }
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg.includes("Error") || msg.includes("failed")) {
      _logger.error(`[amazon-transcoder] ${msg}`);
    } else {
      _logger.trace(`[amazon-transcoder] ${msg}`);
    }
  });

  pwRecord.stderr.on("data", (data) => {
    _logger.trace(`[pw-record] ${data.toString()}`);
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

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

async function runAmazonCapture() {
  await setupVirtualSink();

  _logger.info(`[amazon] Launching Puppeteer with PULSE_SINK=${SINK_NAME}...`);

  const executablePath = "/usr/bin/google-chrome";

  browser = await puppeteer.launch({
    executablePath,
    headless: HEADLESS,
    args: [
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
      PULSE_SINK: SINK_NAME
    }
  });

  const page = await browser.newPage();
  page.on("console", (msg) => _logger.info(`[Browser] ${msg.text()}`));

  _logger.info(`[amazon] Running manual login...`);
  await loginToAmazon(page);

  _logger.info(`[amazon] Navigating to ${_streamUrl}...`);
  await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

  // Run site handlers (e.g., for clicking play)
  await runSiteHandlers(_streamUrl, page, _logger);

  _logger.info(`[amazon] Starting system-level audio capture...`);
  setupAudioTranscoder();

  // Dynamic Routing Helper (PipeWire)
  const routeAudio = async () => {
    if (_isStopped) return;
    try {
      const { execSync } = require("child_process");
      // Find all Chrome output ports
      const outPorts = execSync("pw-link -o").toString().split("\n")
        .filter(p => (p.toLowerCase().includes("chrome") || p.toLowerCase().includes("google")) && p.includes("output_"));
      
      // Find all Amazon sink input ports (the playback side of our sink)
      const inPorts = execSync("pw-link -i").toString().split("\n")
        .filter(p => p.toLowerCase().includes(SINK_NAME) && p.includes("playback_"));

      // Find all FFmpeg input ports (Lavf)
      const ffmpegInPorts = execSync("pw-link -i").toString().split("\n")
        .filter(p => p.toLowerCase().includes("lavf") && p.includes("input_"));

      // Check if video is muted
      try {
        const muted = await page.evaluate(() => {
          const v = document.querySelector("video");
          return v ? v.muted : "no-video";
        });
        if (muted === true) {
          _logger.info(`[amazon] Video is muted, attempting to unmute...`);
          await page.evaluate(() => {
            const v = document.querySelector("video");
            if (v) v.muted = false;
          });
        }
      } catch (e) {}

      for (const outPort of outPorts) {
        const isLeft = outPort.includes("_FL") || outPort.includes("_0");
        
        // Target 1: Virtual Sink
        const matchingSinkIn = inPorts.find(p => (isLeft && (p.includes("_FL") || p.includes("_0"))) || (!isLeft && (p.includes("_FR") || p.includes("_1"))));
        if (matchingSinkIn) {
          try {
            execSync(`pw-link "${outPort}" "${matchingSinkIn}"`, { stdio: "ignore" });
          } catch(e) {}
        }

        // Target 2: FFmpeg (Direct)
        const matchingFfmpegIn = ffmpegInPorts.find(p => (isLeft && (p.includes("_FL") || p.includes("_0"))) || (!isLeft && (p.includes("_FR") || p.includes("_1"))));
        if (matchingFfmpegIn) {
          try {
            execSync(`pw-link "${outPort}" "${matchingFfmpegIn}"`, { stdio: "ignore" });
          } catch(e) {}
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
