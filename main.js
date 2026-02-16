const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./lib/logger');

const cookies = require('./espn_cookies.json');

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

const sessionId = args.id || (new Date()).getUTCSeconds()
const targetUrl = args.url

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

            if (targetUrl.includes("espn.com")) {
                await page.setCookie(...cookies);
            }

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
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for the media player to load
            const isESPN = targetUrl.includes('espn.com');

            if (isESPN) {
                // Give ESPN time to bootstrap its player
                logger.debug(`[${sessionId}] Waiting for ESPN page to load...`);
                await new Promise(r => setTimeout(r, 5000));

                // Debug: log what's actually on the page
                const pageDebug = await page.evaluate(() => {
                    const body = document.body;
                    const allTags = [...new Set([...body.querySelectorAll('*')].map(e => e.tagName.toLowerCase()))];
                    const videos = document.querySelectorAll('video');
                    const iframes = document.querySelectorAll('iframe');
                    const customEls = allTags.filter(t => t.includes('-'));
                    return {
                        totalElements: body.querySelectorAll('*').length,
                        customElements: customEls,
                        videoCount: videos.length,
                        iframeCount: iframes.length,
                        iframeSrcs: [...iframes].map(f => f.src),
                        bodyInnerHTMLLength: body.innerHTML.length,
                        title: document.title,
                    };
                });
                logger.info(`[${sessionId}] Page debug: ${JSON.stringify(pageDebug)}`);
            }

            const waitTimeout = isESPN ? 60000 : 20000;
            try {
                logger.debug(`[${sessionId}] Waiting for video element (timeout: ${waitTimeout}ms)...`);
                // Poll for video in DOM, shadow roots, and iframes
                await page.waitForFunction(() => {
                    // Check main document
                    if (document.querySelector('video')) return true;
                    // Check all shadow roots
                    const allEls = document.querySelectorAll('*');
                    for (const el of allEls) {
                        if (el.shadowRoot && el.shadowRoot.querySelector('video')) return true;
                    }
                    return false;
                }, { timeout: waitTimeout });
                logger.debug(`[${sessionId}] Video element found.`);
            } catch (e) {
                throw new Error(`Video element not found within ${waitTimeout}ms`);
            }

            // Give the video time to start playing
            await new Promise(r => setTimeout(r, 3000));

            // For ESPN, try to click play if video isn't playing
            if (isESPN) {
                await page.evaluate(() => {
                    const videos = document.querySelectorAll('video');
                    for (const v of videos) {
                        console.log(`Video state: readyState=${v.readyState}, paused=${v.paused}, src=${v.currentSrc || v.src || '(none)'}`);
                        if (v.paused) {
                            v.play().catch(e => console.log('play() rejected:', e.message));
                        }
                    }
                });
                // Extra wait for play to begin
                await new Promise(r => setTimeout(r, 3000));
            }

            logger.info(`[${sessionId}] Starting audio capture via MediaRecorder...`);

            // Inject the capture script into the browser context
            await page.evaluate((isESPNStream) => {
                // Find the best video element (prefer one with audio/src)
                const allVideos = [...document.querySelectorAll('video')];
                let video = null;

                for (const v of allVideos) {
                    console.log(`Checking video: src=${v.currentSrc || v.src}, readyState=${v.readyState}, paused=${v.paused}`);
                    if (v.readyState >= 2 && (v.currentSrc || v.src)) {
                        video = v;
                        break;
                    }
                }
                if (!video && allVideos.length > 0) {
                    video = allVideos[0]; // fallback to first
                }

                if (!video) {
                    console.error('No video element found');
                    return;
                }

                console.log('Using video element:', video.currentSrc || video.src || '(no src)');

                // Try captureStream first
                let stream = null;
                try {
                    stream = video.captureStream();
                    const audioTracks = stream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        console.log(`captureStream() has ${audioTracks.length} audio track(s) — using direct capture`);
                    } else {
                        console.log('captureStream() returned 0 audio tracks (likely DRM). Falling back to AudioContext...');
                        stream = null;
                    }
                } catch (e) {
                    console.log('captureStream() failed:', e.message, '— falling back to AudioContext...');
                    stream = null;
                }

                // Fallback: intercept audio via AudioContext
                if (!stream) {
                    try {
                        const audioCtx = new AudioContext();
                        const source = audioCtx.createMediaElementSource(video);
                        const dest = audioCtx.createMediaStreamDestination();
                        // Connect to both destination (so we can hear it) and the stream destination
                        source.connect(audioCtx.destination);
                        source.connect(dest);
                        stream = dest.stream;
                        const audioTracks = stream.getAudioTracks();
                        console.log(`AudioContext fallback: ${audioTracks.length} audio track(s)`);
                        if (audioTracks.length === 0) {
                            console.error('AudioContext fallback also has no audio tracks');
                            return;
                        }
                    } catch (e) {
                        console.error('AudioContext fallback failed:', e.message);
                        return;
                    }
                }

                const audioTracks = stream.getAudioTracks();
                console.log(`Recording with ${audioTracks.length} audio track(s)`);
                const audioStream = new MediaStream(audioTracks);

                const recorder = new MediaRecorder(audioStream, {
                    mimeType: 'audio/webm;codecs=opus',
                    audioBitsPerSecond: 128000
                });

                recorder.ondataavailable = async (event) => {
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

                recorder.onstart = () => {
                    console.log("MediaRecorder started");
                };

                recorder.onstop = () => {
                    console.log("MediaRecorder stopped");
                };

                recorder.start(100); // Emit data every 100ms
                window._recorder = recorder;
                console.log("MediaRecorder initialized and started");
            }, isESPN);

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