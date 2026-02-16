const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./lib/logger');

puppeteer.use(StealthPlugin());

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

async function runCapture(maxRetries = 3) {
    let browser;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            logger.info(`[${sessionId}] Launching browser...`);

            browser = await puppeteer.launch({
                defaultViewport: null,
                headless: false,
                args: [
                    "--start-maximized",
                    "--autoplay-policy=no-user-gesture-required",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--use-fake-ui-for-media-stream",
                ],
            });

            const page = await browser.newPage();

            // Forward console logs to pino via stderr
            page.on('console', msg => {
                const type = msg.type();
                const text = msg.text();
                if (type === 'error') logger.error(`[Browser] ${text}`);
                else if (type === 'warning') logger.warn(`[Browser] ${text}`);
                else logger.debug(`[Browser] ${text}`);
            });

            // Expose a function so the browser can send audio chunks back to Node.js
            await page.exposeFunction('sendAudioChunk', (base64Data) => {
                const buffer = Buffer.from(base64Data, 'base64');
                process.stdout.write(buffer);
            });

            logger.info(`[${sessionId}] Navigating to ${targetUrl}...`);
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });

            // Wait for the video element to load
            try {
                logger.debug(`[${sessionId}] Waiting for video element...`);
                await page.waitForSelector('video', { timeout: 20000 });
            } catch (e) {
                throw new Error("Video element not found within 20s");
            }

            // Small delay to let the video start playing
            await new Promise(r => setTimeout(r, 2000));

            logger.info(`[${sessionId}] Starting audio capture via MediaRecorder...`);

            // Inject the capture script into the browser context
            await page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) {
                    console.error("No video element found");
                    return;
                }

                // Capture the media stream from the video element
                const stream = video.captureStream();
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length === 0) {
                    console.error("No audio tracks found on video element");
                    return;
                }

                console.log(`Found ${audioTracks.length} audio track(s)`);
                const audioStream = new MediaStream(audioTracks);

                const recorder = new MediaRecorder(audioStream, {
                    mimeType: 'audio/webm;codecs=opus',
                    audioBitsPerSecond: 128000
                });

                recorder.ondataavailable = async (event) => {
                    if (event.data.size > 0) {
                        // Convert Blob to base64 and send to Node.js via exposed function
                        const reader = new FileReader();
                        reader.onload = () => {
                            // reader.result is a data URL like "data:audio/webm;base64,..."
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

                recorder.onstart = () => {
                    console.log("MediaRecorder started");
                };

                recorder.onstop = () => {
                    console.log("MediaRecorder stopped");
                };

                recorder.start(100); // Emit data every 100ms
                window._recorder = recorder;
                console.log("MediaRecorder initialized and started");
            });

            logger.info(`[${sessionId}] Audio capture running. Streaming to stdout...`);

            // Keep alive
            await new Promise((resolve, reject) => {
                browser.on('disconnected', () => reject(new Error('Browser disconnected')));

                if (args.duration) {
                    setTimeout(() => {
                        logger.info(`[${sessionId}] Duration reached.`);
                        resolve();
                    }, parseInt(args.duration) * 1000);
                }
            });

            if (browser) await browser.close();
            break;

        } catch (err) {
            const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : JSON.stringify(err);
            logger.error(`[${sessionId}] Capture session failed (Attempt ${retryCount + 1}): ${errMsg}`);
            retryCount++;
            if (browser) await browser.close();
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
    logger.info("Received SIGINT. Cleaning up...");
    process.exit();
});

// Suppress max listeners warning
process.stdout.setMaxListeners(5);

(async () => {
    await runCapture(1);
})();