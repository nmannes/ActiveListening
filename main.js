const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./lib/logger');
const fs = require('fs');
const path = require('path');
const http = require('http');

const debugFramesDir = path.join(__dirname, 'debug_frames');

if (!fs.existsSync(debugFramesDir)) {
    fs.mkdirSync(debugFramesDir, { recursive: true });
}

const cookies = require('./espn_cookies.json');

puppeteer.use(StealthPlugin());

const { args } = require('./lib/args')

const sessionId = args.id || (new Date()).getUTCSeconds()
const targetUrl = args.url || 'http://localhost:9981/play/stream/channel/10b4df1ca30fcb4b3099fb32a883c45e'
const { spawn, exec } = require('child_process');

async function runCaptureTvHeadEnd(url, retries) {
    logger.info(`[${sessionId}] Spawning ffmpeg to capture stream from ${url}`);

    return new Promise((resolve, reject) => {
        // We will output audio as PCM to stdout (so server.js ffmpeg can read it direct).
        // Wait, server.js expects pcm or webm. MediaRecorder gave webm/opus.
        // Actually ffmpeg in server.js doesn't care if we send it webm/opus or raw pcm, it will transcode to pcm_s16le.
        // Sending it as webm/opus closely mimics the puppeteer approach.
        const args = [
            '-y',
            '-i', url,
            // Output 1: Audio to stdout encoded as WebM/Opus so it seamlessly replaces MediaRecorder
            '-map', '0:a',
            '-c:a', 'libopus',
            '-f', 'webm',
            'pipe:1',
            // Output 2: Video frames to the debug_frames directory
            '-map', '0:v',
            '-r', '0.5', // 1 frame every 2 seconds
            '-f', 'image2',
            '-update', '1',
            path.join(debugFramesDir, `${sessionId}_last_frame.jpg`)
        ];


        let isCommercialBreak = false;

        // set an interval to check for commercial breaks
        const commercialCheckInterval = setInterval(async () => {
            const frameFiles = fs.readdirSync(debugFramesDir).filter(f => f.endsWith('.jpg')).sort();
            if (frameFiles.length === 0) {
                return;
            }
            const lastFrame = frameFiles[frameFiles.length - 1];
            const lastFramePath = path.join(debugFramesDir, lastFrame);

            // get all text on the frame via tesseract ocr
            await exec(`tesseract ${lastFramePath} stdout`, (error, stdout) => {
                if (error) {
                    logger.error(`[${sessionId}] Tesseract error: ${error.message}`);
                    return;
                }
                const text = stdout.toLowerCase().trim();

                if (text !== '') {
                    logger.debug(`[${sessionId}]: ${text}`);
                }
            });
        }, 2000);

        const ffmpegProc = spawn('ffmpeg', args);

        // Pipe the ffmpeg stdout (the audio stream) to the main process stdout
        ffmpegProc.stdout.on('data', (data) => {
            if (isCommercialBreak) {
                return;
            }
            process.stdout.write(data);
        });

        ffmpegProc.stderr.on('data', (data) => {
            // Optional: log ffmpeg output if needed for debugging
            // logger.trace(`[FFMPEG] ${data.toString()}`);
        });

        ffmpegProc.on('close', (code) => {
            logger.info(`[${sessionId}] FFMPEG exited with code ${code}`);
            resolve();
        });

        ffmpegProc.on('error', (err) => {
            logger.error(`[${sessionId}] FFMPEG error: ${err.message}`);
            reject(err);
        });

        // Handle Ctrl-C / cleanup by killing ffmpeg
        process.on('SIGINT', () => {
            clearInterval(commercialCheckInterval);
            ffmpegProc.kill();
        });
    });
}
async function runCapture(retries = 3) {

    if (args.duration) {
        setTimeout(() => {
            logger.info(`[${sessionId}] Duration reached, exiting.`);
            process.exit(0);
        }, parseInt(args.duration) * 1000);
    }

    if (targetUrl.includes("localhost:9981")) {
        return await runCaptureTvHeadEnd(targetUrl, retries);
    }

    var browser;
    var page;

    try {


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
                "--disable-features=StorageAccessAPI,ThirdPartyCookieDeprecation",
                "--disable-web-security",
            ],
        });

        page = await browser.newPage();

        // Forward console logs to pino via stderr
        page.on('console', msg => logger.trace(`[Browser] ${msg.text()}`));

        // Expose a function so the browser can send audio chunks back to Node.js
        await page.exposeFunction('sendAudioChunk', (base64Data) => {
            const buffer = Buffer.from(base64Data, 'base64');
            process.stdout.write(buffer);
        });

        const commercialCheckInterval = await setupCommercialCheck(targetUrl, page);

        browser.on('disconnected', () => clearInterval(commercialCheckInterval));


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

        logger.debug(`[${sessionId}] Page debug: ${JSON.stringify(pageDebug)}`);

        if (targetUrl.includes("espn.com")) {
            await runCaptureESPN(page, retries);
        } else if (targetUrl.includes("youtube.com")) {
            await runCaptureYouTube(page, retries);
        } else {
            throw new Error("Invalid URL");
        }

        // Keep alive
        await new Promise((resolve, reject) => {
            browser.on('disconnected', () => {
                reject(new Error('Browser disconnected'));
            });
            // We can also handle the args.duration here or rely on the process.exit(0) you already added at the top.
        });

    } catch (error) {
        logger.error(`[${sessionId}] Error: ${error.message}`);
    } finally {
        if (browser) await browser.close();
        if (page) await page.close();
    }
}

async function runCaptureESPN(page, retries) {
    await page.setCookie(...cookies);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // ESPN: complex shadow DOM search
    logger.debug(`[${sessionId}] Waiting for ESPN page to load...`);
    await new Promise(r => setTimeout(r, 5000));

    try {
        logger.debug(`[${sessionId}] Waiting for video element (timeout: 60000ms)...`);
        await page.waitForFunction(() => {
            if (document.querySelector('video')) return true;
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
                if (el.shadowRoot && el.shadowRoot.querySelector('video')) return true;
            }
            return false;
        }, { timeout: 60000 });
        logger.debug(`[${sessionId}] Video element found.`);
    } catch (e) {
        throw new Error(`Video element not found within 60s`);
    }
    await new Promise(r => setTimeout(r, 3000));

    // ESPN: complex shadow DOM search
    logger.debug(`[${sessionId}] Waiting for ESPN page to load...`);
    await new Promise(r => setTimeout(r, 5000));

    try {
        logger.debug(`[${sessionId}] Waiting for video element (timeout: 60000ms)...`);
        await page.waitForFunction(() => {
            if (document.querySelector('video')) return true;
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
                if (el.shadowRoot && el.shadowRoot.querySelector('video')) return true;
            }
            return false;
        }, { timeout: 60000 });
        logger.debug(`[${sessionId}] Video element found.`);
    } catch (e) {
        throw new Error(`Video element not found within 60s`);
    }
    await new Promise(r => setTimeout(r, 3000));

    // Try to play all video elements
    await page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        for (const v of videos) {
            console.log(`Video state: readyState=${v.readyState}, paused=${v.paused}, src=${v.currentSrc || v.src || '(none)'}`);
            if (v.paused) {
                v.muted = false;
                v.play().catch(e => console.log('play() rejected:', e.message));
            }
        }
    });


    // ESPN/Other: complex logic with AudioContext fallback for DRM
    await page.evaluate(() => {
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
            video = allVideos[0];
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
        console.log("MediaRecorder initialized and started");
    });

}

async function runCaptureYouTube(page, retries) {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    // YouTube: simple selector wait
    try {
        logger.debug(`[${sessionId}] Waiting for video element...`);
        await page.waitForSelector('video', { timeout: 20000 });
        logger.debug(`[${sessionId}] Video element found.`);
    } catch (e) {
        throw new Error("Video element not found within 20s");
    }
    // Small delay for video to start
    await new Promise(r => setTimeout(r, 2000));

    // Try to play all video elements
    await page.evaluate(() => {
        const videos = document.querySelectorAll('video');
        for (const v of videos) {
            console.log(`Video state: readyState=${v.readyState}, paused=${v.paused}, src=${v.currentSrc || v.src || '(none)'}`);
            if (v.paused) {
                v.muted = false;
                v.play().catch(e => console.log('play() rejected:', e.message));
            }
        }
    });


    // YouTube: simple captureStream (works reliably)
    await page.evaluate(() => {
        const video = document.querySelector('video');
        if (!video) {
            console.error("No video element found");
            return;
        }

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
        console.log("MediaRecorder initialized and started");

    });


}


async function setupCommercialCheck(url, page) {
    // Commercial detection via DOM search (for "Ad" badge)
    let commercialCheckInterval;
    let isCommercial = false;

    if (url.includes("espn.com")) {
        commercialCheckInterval = setInterval(async () => {
            try {
                const isNowCommercial = await page.evaluate(() => {
                    function findDeep(root, selector) {
                        let found = root.querySelector(selector);
                        if (found) return found;
                        const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                        let node = walkers.nextNode();
                        while (node) {
                            if (node.shadowRoot) {
                                found = findDeep(node.shadowRoot, selector);
                                if (found) return found;
                            }
                            node = walkers.nextNode();
                        }
                        return null;
                    }
                    const el = findDeep(document, '.ad-badge-overlay--badge');
                    return el !== null && el.textContent.toLowerCase().includes('ad');
                });

                if (isNowCommercial !== isCommercial) {
                    isCommercial = isNowCommercial;
                    await page.evaluate((val) => { window._isCommercial = val; }, isCommercial);
                    logger.info(`[${sessionId}] ESPN Ad state changed: ${isCommercial}`);
                }
            } catch (e) {
                // Ignore transient errors
            }
        }, 2000);
    } else if (url.includes("youtube.com")) {
        commercialCheckInterval = setInterval(async () => {
            try {
                const isNowCommercial = await page.evaluate(() => {
                    function findDeep(root, selector) {
                        let found = root.querySelector(selector);
                        if (found) return found;
                        const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                        let node = walkers.nextNode();
                        while (node) {
                            if (node.shadowRoot) {
                                found = findDeep(node.shadowRoot, selector);
                                if (found) return found;
                            }
                            node = walkers.nextNode();
                        }
                        return null;
                    }
                    // YouTube specific ad containers
                    const ytAd = document.querySelector('.video-ads.ytp-ad-module, .ytp-ad-player-overlay, .ytp-ad-player-overlay-layout');
                    if (ytAd && ytAd.children.length > 0) return true;

                    // Generic ad badge search (as requested)
                    const badge = findDeep(document, '.ad-badge-overlay--badge');
                    if (badge && badge.textContent.toLowerCase().includes('ad')) return true;

                    return false;
                });

                if (isNowCommercial !== isCommercial) {
                    isCommercial = isNowCommercial;
                    await page.evaluate((val) => { window._isCommercial = val; }, isCommercial);
                    logger.info(`[${sessionId}] YouTube Ad state changed: ${isCommercial}`);
                }
            } catch (e) {
                // Ignore transient errors
            }
        }, 2000);
    }

    page.on('close', () => {
        clearInterval(commercialCheckInterval);
    });

    return commercialCheckInterval;
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