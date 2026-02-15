const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const WebSocket = require('ws');
const logger = require('./lib/logger');

// Simple argument parsing
const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
    if (val.startsWith('--')) {
        const key = val.slice(2);
        const next = arr[i + 1];
        if (next && !next.startsWith('--')) {
            acc[key] = next;
        } else {
            acc[key] = true;
        }
    }
    return acc;
}, {});

const targetUrl = args.url || "https://www.youtube.com/watch?v=Z33nVLZ5NbI";
const sessionId = args.id || `session_${Math.random().toString(36).substring(7)}`;
const wsUrl = process.env.WS_URL || `ws://localhost:7654?id=${sessionId}`;
const retries = args.retries || 3;
const headless = args.headless || true;
async function runCapture(maxRetries = 3) {
    let browser;
    let ws;
    let retryCount = 0;

    const connectWS = () => new Promise((resolve, reject) => {
        logger.info(`[${sessionId}] Connecting to WebSocket server: ${wsUrl}...`);
        const socket = new WebSocket(wsUrl);
        socket.on('open', () => {
            logger.info("Connected to WebSocket server.");
            resolve(socket);
        });
        socket.on('error', reject);
    });

    while (retryCount < maxRetries) {
        try {
            browser = await puppeteer.launch({
                executablePath: '/usr/bin/google-chrome',
                headless,
                args: [
                    '--mute-audio',
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--use-fake-ui-for-media-stream",
                    "--autoplay-policy=no-user-gesture-required",
                ],
            });

            const page = await browser.newPage();
            // Forward console logs to pino
            page.on('console', msg => {
                const type = msg.type();
                const text = msg.text();
                if (type === 'error') logger.error(`[Browser] ${text}`);
                else if (type === 'warning') logger.warn(`[Browser] ${text}`);
                else if (type === 'info') logger.info(`[Browser] ${text}`);
                else logger.debug(`[Browser] ${text}`);
            });

            logger.info(`Navigating to ${targetUrl}...`);
            await page.goto(targetUrl);

            // Explicitly wait for video element
            try {
                logger.info("Waiting for video element...");
                await page.waitForSelector('video', { timeout: 20000 });
            } catch (e) {
                throw new Error("Video element not found within 20s");
            }

            ws = await connectWS();

            await page.exposeFunction('sendChunk', (data) => {
                const buffer = Buffer.from(data);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(buffer);
                }
            });

            logger.info("Injecting capture script...");
            await page.evaluate(async () => {
                const video = document.querySelector('video');
                if (!video) {
                    console.error("No video element found");
                    return;
                }
                const fullStream = video.captureStream();
                const audioStream = new MediaStream(fullStream.getAudioTracks());
                const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });

                recorder.ondataavailable = async (event) => {
                    if (event.data.size > 0) {
                        const reader = new FileReader();
                        reader.onload = async () => {
                            window.sendChunk(Array.from(new Uint8Array(reader.result)));
                            logger.info("Sent chunk");
                        };
                        reader.readAsArrayBuffer(event.data);
                    }
                };
                recorder.start(100);
                window._recorder = recorder;
            });

            // Keep alive and monitor
            await new Promise((resolve, reject) => {
                ws.on('close', () => reject(new Error('WebSocket closed')));
                browser.on('disconnected', () => reject(new Error('Browser disconnected')));

                if (args.duration) {
                    logger.info(`Running for ${args.duration} seconds...`);
                    setTimeout(() => {
                        logger.info("Duration reached. Closing capture session.");
                        resolve();
                    }, parseInt(args.duration) * 1000);
                }
            });

            // Success case - clean up and exit loop
            if (browser) await browser.close();
            if (ws) ws.close();
            break;


        } catch (err) {
            logger.error(`Capture session failed (Attempt ${retryCount + 1}):`, err);
            retryCount++;
            if (browser) await browser.close();
            if (ws) ws.close();
            await new Promise(r => setTimeout(r, 5000)); // Wait before retry
        }
    }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    logger.info("Received SIGINT. Cleaning up...");
    // We can't easily access the localized 'browser' variable here without refactoring,
    // but Puppeteer usually handles child process cleanup. 
    // For better safety, we could move 'browser' to outer scope, but for now just exit.
    process.exit();
});

runCapture(retries);