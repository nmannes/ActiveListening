const { spawn, PassThrough } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./lib/logger');
const { runSiteHandlers } = require('./lib/site_handlers');

puppeteer.use(StealthPlugin());

// ── CLI args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
    if (val.startsWith('--')) {
        const key = val.slice(2);
        const next = arr[i + 1];
        acc[key] = (next && !next.startsWith('--')) ? next : true;
    }
    return acc;
}, {});

const { execSync } = require('child_process');

let REMOTE_IP_ADDRESS = args.ip;

if (!REMOTE_IP_ADDRESS) {
    if (fs.existsSync('remote_server_ip.txt')) {
        REMOTE_IP_ADDRESS = fs.readFileSync('remote_server_ip.txt', 'utf8').trim();
    } else {
        try {
            logger.info('Discovery: Attempting to find running Kalshi worker...');
            REMOTE_IP_ADDRESS = execSync('./discover_instance.sh', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
            logger.info(`Discovery: Found worker at ${REMOTE_IP_ADDRESS}`);
        } catch (e) {
            logger.error('Discovery: No running worker found via discover_instance.sh');
            process.exit(1);
        }
    }
}

if (!REMOTE_IP_ADDRESS || REMOTE_IP_ADDRESS === 'None') {
    logger.error('Error: Could not determine remote server IP. Start an instance or use --ip.');
    process.exit(1);
}

const REMOTE_URL = args.server || `ws://${REMOTE_IP_ADDRESS}:8090`;

// ── Parse market data ────────────────────────────────────────────────
let market = null;
if (args.fromFile) {
    market = JSON.parse(fs.readFileSync(args.fromFile, 'utf8'));
} else if (args.matchJSON) {
    try {
        if (args.matchJSON.trim().startsWith('{')) {
            market = JSON.parse(args.matchJSON);
        } else {
            market = JSON.parse(Buffer.from(args.matchJSON, 'base64').toString());
        }
    } catch (e) {
        console.error(`Failed to parse matchJSON: ${e.message}`);
        process.exit(1);
    }
} else {
    console.error('Must provide --matchJSON or --fromFile with market data');
    process.exit(1);
}

let STREAM_URL = args.url || market.mediaStreamURL || market.channelURL;
if (!STREAM_URL) {
    console.error('Usage: node earnings_call_client.js --url <url> --server <ws://host:port> --matchJSON <json>');
    process.exit(1);
}

const sessionId = market.slug || args.id || (new Date()).getUTCSeconds();
logger.info(`Session ID: ${sessionId}`);
logger.info(`Market: ${market.title || market.slug}`);
logger.info(`Target URL: ${STREAM_URL}`);
logger.info(`Remote: ${REMOTE_URL}`);

// ── Orderbook tracking (runs locally) ────────────────────────────────
const { startOrderbookTracking } = require('./lib/orderbook_tracking');
const orderbook = startOrderbookTracking(market);
logger.info('Orderbook tracking started locally');

// ── Constants ────────────────────────────────────────────────────────
const RECONNECT_DELAY_MS = 3_000;

let isShuttingDown = false;

// ── WebSocket connection ─────────────────────────────────────────────
let ws = null;

function connectWebSocket() {
    if (isShuttingDown) return;

    logger.info(`[ws] Connecting to ${REMOTE_URL}...`);
    ws = new WebSocket(REMOTE_URL);

    ws.on('open', () => {
        logger.info(`[ws] Connected to remote server`);

        ws.send(JSON.stringify({
            type: 'hello',
            market,
            audioOnly: true,
        }));

        this.heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
        }, 2000);
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'signal') {
                logger.info(`[remote] SIGNAL: ${msg.keyword} → ${msg.ticker}`);
            } else if (msg.type === 'transcript') {
                logger.debug(`[remote] transcript: ${msg.text}`);
            } else if (msg.type === 'pong') {
                const rtt = Date.now() - msg.ts;
                logger.debug(`[ws] RTT: ${rtt}ms`);
            } else if (msg.type === 'telemetry') {
                logger.info(`[remote] Buffer: ${msg.buffer_ms}ms | Proc: ${msg.last_proc_ms}ms`);
            }
        } catch (e) {
            logger.debug(`[remote] data error: ${e.message}`);
        }
    });

    ws.on('close', (code) => {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (isShuttingDown) return;
        logger.warn(`[ws] Connection closed (code ${code}), reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
        setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
    });

    ws.on('error', (err) => {
        logger.error(`[ws] Error: ${err.message}`);
    });
}

// ── FFmpeg Transcoder (Browser WebM -> Raw PCM) ──────────────────────
let ffmpegProc = null;

function setupAudioTranscoder() {
    logger.info(`[transcoder] Starting FFmpeg transcoder (WebM -> PCM)...`);

    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    ffmpeg.stdout.on('data', (data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ffmpeg.stderr.on('data', (data) => {
        logger.trace(`[transcoder] ${data.toString().trim()}`);
    });

    ffmpeg.on('close', (code) => {
        logger.info(`[transcoder] FFmpeg exited with code ${code}`);
    });

    ffmpegProc = ffmpeg;
    return ffmpeg;
}

// ── Browser Capture Logic ────────────────────────────────────────────
async function runBrowserCapture() {
    logger.info(`[browser] Launching Puppeteer...`);
    const browser = await puppeteer.launch({
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
    page.on('console', msg => logger.trace(`[Browser] ${msg.text()}`));

    // Expose audio chunk handler
    await page.exposeFunction('sendAudioChunk', (base64Data) => {
        if (ffmpegProc && ffmpegProc.stdin.writable) {
            const buffer = Buffer.from(base64Data, 'base64');
            ffmpegProc.stdin.write(buffer);
        }
    });

    logger.info(`[browser] Navigating to ${STREAM_URL}...`);
    await page.goto(STREAM_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 1. Run Site-Specific Handlers (Logins, Registration, etc.)
    await runSiteHandlers(STREAM_URL, page, logger);

    // 2. Play Video Loop
    await page.evaluate(() => {
        const interval = setInterval(() => {
            const video = document.querySelector('video');
            if (video && video.paused) {
                video.muted = false;
                video.play().catch(e => console.log('play() rejected:', e.message));
            }
        }, 1000);
        window._playInterval = interval;
    });

    // 3. Audio/Frame Capture Setup
    await page.evaluate(() => {
        async function setupCapture() {
            let video = document.querySelector('video');
            if (!video) {
                // Wait for video element
                await new Promise(resolve => {
                    const observer = new MutationObserver(() => {
                        if (document.querySelector('video')) {
                            video = document.querySelector('video');
                            observer.disconnect();
                            resolve();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }

            console.log("Setting up capture for video:", video.currentSrc || video.src || "(no src)");

            // CaptureStream with AudioContext fallback for DRM/ShadowDOM
            let stream = null;
            try {
                stream = video.captureStream();
                if (stream.getAudioTracks().length === 0) throw new Error("No audio tracks in captureStream");
            } catch (e) {
                console.log("captureStream failed or no audio, trying AudioContext fallback...");
                try {
                    const audioCtx = new AudioContext();
                    const source = audioCtx.createMediaElementSource(video);
                    const dest = audioCtx.createMediaStreamDestination();
                    source.connect(audioCtx.destination);
                    source.connect(dest);
                    stream = dest.stream;
                } catch (err) {
                    console.error("AudioContext fallback failed:", err.message);
                }
            }

            if (!stream) return;

            // Audio MediaRecorder
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                const audioStream = new MediaStream(audioTracks);
                const recorder = new MediaRecorder(audioStream, {
                    mimeType: 'audio/webm;codecs=opus',
                    audioBitsPerSecond: 128000
                });
                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const base64 = reader.result.split(',')[1];
                            if (base64) window.sendAudioChunk(base64);
                        };
                        reader.readAsDataURL(event.data);
                    }
                };
                recorder.start(100);
                console.log("Audio MediaRecorder active");
            }
        }

        setupCapture();
    });

    return { browser, page };
}


// ── Startup ──────────────────────────────────────────────────────────
connectWebSocket();
setupAudioTranscoder();

runBrowserCapture().catch(err => {
    logger.error(`[main] Critical error: ${err.message}`);
    process.exit(1);
});

// Setup shutdown timer if duration is provided
if (args.duration) {
    const durationMs = parseInt(args.duration, 10) * 60 * 1000;
    if (!isNaN(durationMs)) {
        logger.info(`Shutdown scheduled in ${args.duration} minutes`);
        setTimeout(() => {
            logger.info('Duration reached, shutting down...');
            isShuttingDown = true;
            process.exit(0);
        }, durationMs);
    }
}

