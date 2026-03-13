/**
 * providers/espn.js — ESPN-specific browser stream provider
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

// ── FFmpeg Transcoder ──────────────────────────────────────────────
function setupAudioTranscoder(inputUrl = "pipe:0") {
  _logger.info(`[transcoder] Starting FFmpeg transcoder for URL: ${inputUrl}`);

  const ffmpegArgs = [
    "-fflags", "nobuffer",
    "-flags", "low_delay",
    "-probesize", "5000000",
    "-analyzeduration", "5000000",
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
    headless: true,
    args: [
      "--start-maximized",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
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
      "--use-fake-device-for-media-stream",
      "--allow-running-insecure-content",
      "--disable-webgl",
      "--disable-webrtc",
      "--enable-features=VaapiVideoDecoder"
    ],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => _logger.trace(`[Browser] ${msg.text()}`));

  // Load ESPN cookies
  const cookiesPath = path.join(__dirname, "..", "cookies", "espn_cookies.json");
  if (fs.existsSync(cookiesPath)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
      await page.setCookie(...cookies);
      _logger.info(`[espn] Loaded cookies from ${cookiesPath}`);
    } catch (e) {
      _logger.warn(`[espn] Failed to load cookies: ${e.message}`);
    }
  }

  // Expose functions
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
  });

  await page.exposeFunction("logToClient", (message) => {
    _logger.info(`[Browser] ${message}`);
  });

  try {
    _logger.info(`[espn] Navigating to ${_streamUrl}...`);
    
    // Monitor network requests for audio stream
    await page.setRequestInterception(true);
    const networkRequests = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('audio')) {
        networkRequests.push({
          url: url,
          type: request.resourceType(),
          timestamp: Date.now()
        });
      }
      request.continue();
    });

    await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });

    // Run site handlers
    await runSiteHandlers(_streamUrl, page, _logger);
    await new Promise(r => setTimeout(r, 10000)); // Increased wait time
    
    // Look for audio-only stream
    _logger.info(`[espn] Found ${networkRequests.length} network requests`);
    
    // Log all m3u8 requests
    const m3u8Requests = networkRequests.filter(req => req.url.includes('.m3u8'));
    _logger.info(`[espn] Found ${m3u8Requests.length} m3u8 requests:`);
    m3u8Requests.forEach(req => {
      _logger.info(`[espn] M3U8: ${req.url}`);
    });
    
    networkRequests.forEach(req => {
      _logger.info(`[espn] Request: ${req.url} (${req.type})`);
    });
    
    const audioStream = networkRequests.find(req => 
      req.url.includes('.m3u8') && req.url.includes('audio') && req.url.includes('128K')
    );
    
    if (audioStream) {
      _logger.info(`[espn] Found audio-only HLS stream, using direct capture`);
      setupAudioTranscoder(audioStream.url);
      
      // Start ad badge detection even with HLS capture
      await page.evaluate(() => {
        let lastAdBadgeFound = false;
        window._adBadgeInterval = setInterval(() => {
          // Check regular DOM
          let adBadge = document.querySelector('.ad-badge-overlay--badge');
          
          // Check shadow DOMs if not found
          if (!adBadge) {
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              if (el.shadowRoot) {
                adBadge = el.shadowRoot.querySelector('.ad-badge-overlay--badge');
                if (adBadge) break;
              }
            }
          }
          
          const adBadgeFound = !!adBadge;
          
          window.logToClient(`Ad badge found: ${adBadgeFound}`);
          if (adBadgeFound && !lastAdBadgeFound) {
            console.log('Ad badge detected, pausing audio');
            window._isCommercial = true;
            window.logToClient('Commercial detected - pausing audio transmission');
          } else if (!adBadgeFound && lastAdBadgeFound) {
            console.log('Ad badge no longer detected, resuming audio');
            window._isCommercial = false;
            window.logToClient('Commercial ended - resuming audio transmission');
          }
          
          lastAdBadgeFound = adBadgeFound;
        }, 1000);
      });
      
      return null;
    }


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
