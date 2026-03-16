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


const espnCreds = require('../creds/espn.json');
puppeteer.use(StealthPlugin());

let ffmpegProc = null;
let browser = null;
let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;

// ── Audio Stream Copier (no transcoding) ──────────────────────
function setupAudioTranscoder(inputUrl = "pipe:0") {
  _logger.info(`[transcoder] Starting audio stream copier for URL: ${inputUrl}`);

  // Transcode AAC to PCM with low buffer for real-time processing
  const ffmpegArgs = [
    "-fflags", "nobuffer",
    "-flags", "low_delay",
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
    headless: false,
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
      "--disable-webgl"
    ],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => _logger.info(`[Browser] ${msg.text()}`));

  await page.goto("https://espn.com", { waitUntil: "networkidle2" });

  // // login

  // //<a data-affiliatename="espn" data-language="en" data-regformid="espn" tref="/members/v3_1/login" data-behavior="overlay" data-route="false" href="#">Log In</a>
  // // Wait for user menu and click login
  // await page.waitForSelector('li.user', { timeout: 10000 });
  // await page.click('li.user');
  // await new Promise((resolve) => setTimeout(resolve, 500));

  // await page.waitForSelector('a[tref="/members/v3_1/login"]', { timeout: 10000 });
  // await page.click('a[tref="/members/v3_1/login"]');
  // await new Promise((resolve) => setTimeout(resolve, 1000));

  // // Wait for iframe to load and get its content
  // await page.waitForSelector('#oneid-iframe', { timeout: 10000 });
  // const iframeElement = await page.$('#oneid-iframe');
  // _logger.info('Found iframe element');
  
  // const frame = await iframeElement.contentFrame();
  // if (frame) {
  //   // Wait for inputs to be available in the iframe
  //   await frame.waitForSelector('input', { timeout: 5000 });
  //   const inputs = await frame.$$('input');
  //   _logger.info(`Found ${inputs.length} input elements in iframe`);
    
  //   // Example: interact with the first input (username/email field)
  //   if (inputs.length > 0) {
  //     _logger.info('Typing username into first input');
  //     await inputs[0].type(espnCreds.username);
      
  //     await new Promise((resolve) => setTimeout(resolve, 500));

  //     // Click submit or continue button
  //     await frame.click('button[type="submit"]');
  //     await new Promise((resolve) => setTimeout(resolve, 1000));

  //     // Wait for password field to appear after form transition
  //     await frame.waitForSelector('input[type="password"]', { timeout: 5000 });
  //     const passwordInputs = await frame.$$('input[type="password"]');
      
  //     if (passwordInputs.length > 0) {
  //       _logger.info('Typing password into password field');
  //       await passwordInputs[0].type(espnCreds.password);
  //       await new Promise((resolve) => setTimeout(resolve, 500));
        
  //       // Submit the login form
  //       await frame.click('button[type="submit"]');
  //     } else {
  //       _logger.info('No password field found');
  //     }
  //   }
  // } else {
  //   _logger.info('Could not access iframe content');
  // }



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

  await new Promise((resolve) => setTimeout(resolve, 50000));

  await page.goto(_streamUrl, { waitUntil: "networkidle2", timeout: 60000 });


  // Expose functions
  await page.exposeFunction("sendAudioChunk", (base64Data) => {
    if (ffmpegProc && ffmpegProc.stdin.writable && window._isCommercial !== true) {
      const buffer = Buffer.from(base64Data, "base64");
      ffmpegProc.stdin.write(buffer);
    }
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
        }, 5000);
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
