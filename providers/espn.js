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

  // Expose function to log to client
  await page.exposeFunction("logToClient", (message) => {
    _logger.info(`[Browser] ${message}`);
  });

  try {
    _logger.info(`[espn] Navigating to ${_streamUrl}...`);
    
    // Enable network request monitoring
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

    // 1. Run Site-Specific Handlers
    await runSiteHandlers(_streamUrl, page, _logger);

    // Wait a bit for network requests to load
    await new Promise(r => setTimeout(r, 5000));
    
    // Find the audio-only m3u8 stream
    const audioStream = networkRequests.find(req => 
      req.url.includes('.m3u8') && req.url.includes('audio') && req.url.includes('128K')
    );
    
    if (audioStream) {
      _logger.info(`[espn] Found audio-only HLS stream, using direct capture`);
      setupAudioTranscoder(audioStream.url);
      return null;
    } else {
      _logger.warn(`[Network] No audio-only m3u8 stream found, falling back to browser capture`);
    }

    // 2. Play Video Loop & Audio Capture (fallback if HLS capture fails)
    await page.evaluate(async () => {
        // Find ALL video elements, including shadow DOM
        const allVideos = [...document.querySelectorAll('video')];
        
        // Also check shadow DOM for video elements
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                const shadowVideos = el.shadowRoot.querySelectorAll('video');
                allVideos.push(...shadowVideos);
            }
        }
        
        let video = null;
        for (let i = 0; i < allVideos.length; i++) {
            const v = allVideos[i];
            const src = v.currentSrc || v.src;
            
            // Try to find a video that's actually playing or has content
            if (v.readyState >= 2 || src) {
                video = v;
                break;
            }
        }
        
        // If no ready video, use the first one that exists
        if (!video && allVideos.length > 0) {
            video = allVideos[0];
        }

        if (!video) {
            return;
        }

        // Force video to play and unmute
        video.muted = false;
        video.volume = 1.0;
        
        // Wait a moment then setup audio capture
        setTimeout(() => {
            setupAudioCapture(video);
        }, 1000);

        // Wait for video to get source and actually start playing
        let attempts = 0;
        const checkReady = setInterval(() => {
            attempts++;
            const currentSrc = video.currentSrc || video.src;
            
            // Only proceed when video actually has a source and is playing
            if (currentSrc && video.readyState >= 2 && !video.paused && attempts > 5) {
                clearInterval(checkReady);
                // Add extra delay to ensure audio is flowing
                setTimeout(() => {
                    setupAudioCapture(video);
                }, 2000);
            } else if (attempts > 120) { // Wait up to 2 minutes
                clearInterval(checkReady);
                setupAudioCapture(video);
            }
        }, 1000);

        function setupAudioCapture(video) {
            // Try to find ALL media elements that might have audio
            const allMediaElements = [
                ...document.querySelectorAll('video'),
                ...document.querySelectorAll('audio')
            ];
            
            // Also check shadow DOM
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (el.shadowRoot) {
                    const shadowVideos = el.shadowRoot.querySelectorAll('video');
                    const shadowAudios = el.shadowRoot.querySelectorAll('audio');
                    allMediaElements.push(...shadowVideos, ...shadowAudios);
                }
            }
            
            let stream = null;
            let sourceElement = null;
            
            // Try each media element to find one with audio
            for (let i = 0; i < allMediaElements.length; i++) {
                const element = allMediaElements[i];
                
                try {
                    // Try to get stream from this element
                    const testStream = element.captureStream();
                    const audioTracks = testStream.getAudioTracks();
                    
                    if (audioTracks.length > 0) {
                        stream = testStream;
                        sourceElement = element;
                        break;
                    }
                } catch (e) {
                    // EME DRM protection - continue to next element
                }
            }
            
            // If no direct stream found, try AudioContext with the original video
            if (!stream) {
                try {
                    const audioCtx = new AudioContext();
                    const source = audioCtx.createMediaElementSource(video);
                    const dest = audioCtx.createMediaStreamDestination();
                    source.connect(audioCtx.destination);
                    source.connect(dest);
                    stream = dest.stream;
                    sourceElement = video;
                } catch (e) {
                    return;
                }
            }
            
            const audioTracks = stream.getAudioTracks();
            
            if (audioTracks.length === 0) {
                return;
            }
            
            const audioStream = new MediaStream(audioTracks);

            const recorder = new MediaRecorder(audioStream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });

            recorder.ondataavailable = async (event) => {
                if (window._isCommercial) return; // skip audio during commercials
                if (event.data.size > 0) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = reader.result.split(',')[1];
                        if (base64) {
                            window.sendAudioChunk(base64);
                        }
                    };
                    reader.readAsDataURL(event.data);
                }
            };

            recorder.onerror = (e) => {
                console.error("MediaRecorder error:", e.error?.message || e);
            };

            recorder.start(100);
            window._recorder = recorder;
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
