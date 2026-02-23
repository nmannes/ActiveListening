const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./lib/logger');
const fs = require('fs');
const path = require('path');

const { args } = require('./lib/args')

const debugFramesDir = path.join(__dirname, 'debug_frames');

if (!fs.existsSync(debugFramesDir)) {
    fs.mkdirSync(debugFramesDir, { recursive: true });
}

let cookies = [];
const cookiesDir = path.join(__dirname, 'cookies');
if (fs.existsSync(cookiesDir)) {
    const cookieFiles = fs.readdirSync(cookiesDir).filter(f => f.endsWith('.json'));
    cookieFiles.forEach(file => {
        try {
            const content = JSON.parse(fs.readFileSync(path.join(cookiesDir, file), 'utf8'));
            if (Array.isArray(content)) {
                cookies = cookies.concat(content);
            } else {
                cookies.push(content);
            }
            logger.debug(`Loaded cookies from ${file}`);
        } catch (e) {
            logger.error(`Failed to load cookies from ${file}: ${e.message}`);
        }
    });
}

puppeteer.use(StealthPlugin());

const sessionId = args.id || (new Date()).getUTCSeconds()
const targetUrl = args.url || 'https://www.youtube.com/watch?v=GyTufVoPa0c'
// const targetUrl = 'http://localhost:9981/play/stream/channel/10b4df1ca30fcb4b3099fb32a883c45e'
const { spawn, exec } = require('child_process');



const nbcColors = [
    '#FCB711',
    '#F37021',
    '#CC004C',
    '#6460AA',
    '#0089D0',
    '#0DB14B'
]

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

async function verifyNbcColors(imagePath) {
    const targetRgb = nbcColors.map(hexToRgb);
    const foundColors = new Set();
    const tolerance = 35; // Increased tolerance for "mostly similar" colors

    return new Promise((resolve, reject) => {
        // Use ffmpeg to stream raw RGB pixels from the cropped image
        const ffmpeg = spawn('ffmpeg', ['-i', imagePath, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1']);

        ffmpeg.stdout.on('data', (chunk) => {
            for (let i = 0; i < chunk.length; i += 3) {
                const r = chunk[i];
                const g = chunk[i + 1];
                const b = chunk[i + 2];

                for (let j = 0; j < targetRgb.length; j++) {
                    if (foundColors.has(j)) continue; // Optimization: skip already found colors

                    const target = targetRgb[j];
                    // Simple Euclidean distance squared or manhattan distance for speed
                    // Here we use channel-wise tolerance
                    if (Math.abs(r - target.r) < tolerance &&
                        Math.abs(g - target.g) < tolerance &&
                        Math.abs(b - target.b) < tolerance) {
                        foundColors.add(j);
                    }
                }
            }
        });

        ffmpeg.on('close', () => {
            const allFound = foundColors.size === targetRgb.length;
            if (foundColors.size > 0) {
                logger.trace(`[verifyNbcColors] Found ${foundColors.size}/${targetRgb.length} NBC colors.`);
            }
            resolve(allFound);
        });

        ffmpeg.on('error', (err) => reject(err));
    });
}


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
            '-map', '0:a:0', // Map first audio stream only
            '-c:a', 'libopus',
            '-ac', '1',      // Downmix to mono
            '-f', 'webm',
            'pipe:1',
            // Output 2: Video frames to the debug_frames directory
            '-map', '0:v',
            '-r', '0.5', // 1 frame every 2 seconds
            '-f', 'image2',
            '-update', '1',
            path.join(debugFramesDir, `last_frame.jpg`)
        ];


        let isCommercialBreak = false;

        const commercialCheckInterval = setInterval(async () => {
            const lastFramePath = path.join(debugFramesDir, 'last_frame.jpg');
            const cropPath = path.join(debugFramesDir, 'top_right_crop.jpg');

            if (!fs.existsSync(lastFramePath)) {
                return;
            }



            // 1. Run tesseract on the whole screen for context (as requested)
            exec(`tesseract ${lastFramePath} stdout`, (error, stdout) => {
                if (!error) {
                    const fullText = stdout.trim();
                    if (fullText) logger.trace(`[${sessionId}] Full screen OCR: ${fullText.replace(/\n/g, ' ')}`);

                    // look for 1st, 2nd, 3rd, or 4th quarter to detect if we're in a game or not
                    const quarterRegex = /([1-4](st|nd|rd|th)?\s*quarter)/i;
                    const hasQuarter = quarterRegex.test(fullText);
                    if (!hasQuarter) {
                        logger.info(`[${sessionId}] No quarter text detected in OCR, likely not live game content. Marking as commercial break.`);
                        isCommercialBreak = true;
                    } else {
                        logger.info(`[${sessionId}] Quarter text detected in OCR, likely live game content. Marking as non-commercial.`);
                        isCommercialBreak = false;
                    }
                }
            });

            // // 2. Crop the top-right corner and run tesseract for logo detection
            // const cropCmd = `ffmpeg -i ${lastFramePath} -vf "crop=100:150:1750:20" -y ${cropPath}`;
            // exec(cropCmd, async (error, stdout) => {
            //     if (error) {
            //         logger.error(`[${sessionId}] Logo detection error: ${error.message}`);
            //         return;
            //     }

            //     const cropText = stdout.toLowerCase().trim();
            //     if (cropText) logger.debug(`[${sessionId}] Logo crop OCR: ${cropText.replace(/\n/g, ' ')}`);

            //     // Verify NBC colors are present in the crop
            //     let allColorsPresent = false;
            //     try {
            //         allColorsPresent = await verifyNbcColors(cropPath);
            //     } catch (err) {
            //         logger.error(`[${sessionId}] Color verification error: ${err.message}`);
            //     }

            //     const nextIsCommercialBreak = !hasLogo;

            //     if (nextIsCommercialBreak !== isCommercialBreak) {
            //         isCommercialBreak = nextIsCommercialBreak;
            //         logger.info(`[${sessionId}] Commercial break state changed: ${isCommercialBreak} (Reason: ${hasLogo ? (allColorsPresent ? 'Colors found' : 'OCR found') : 'Logo missing'})`);
            //     }
            // });
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
            // Log ffmpeg output to help debug code 234
            logger.trace(`[FFMPEG] ${data.toString().trim()}`);
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

        await page.setCookie(...cookies);

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
            await runCaptureAudio(page, retries);
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

async function runCaptureAudio(page, retries) {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Auto-fill Q4 earnings registration form if present
    try {
        const emailInput = await page.$('[data-id="AlreadyRegisteredFormEmail"] input, [data-id="GuestRegistrationFormEmail"] input');
        if (emailInput) {
            logger.info(`[${sessionId}] Q4 registration form detected, auto-filling email...`);
            await emailInput.click({ clickCount: 3 }); // select any existing text
            await emailInput.type('nmannes@gmail.com', { delay: 50 });
            await new Promise(r => setTimeout(r, 500));
            const joinButton = await page.$('[data-id="AlreadyRegisteredFormJoinButton"], [data-id="GuestRegistrationFormRegisterButton"]');
            if (joinButton) {
                await joinButton.click();
                logger.info(`[${sessionId}] Clicked join/register button, waiting for page transition...`);
                await new Promise(r => setTimeout(r, 5000));
                // Wait for navigation or content change
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
            }
        }
    } catch (e) {
        logger.debug(`[${sessionId}] No Q4 registration form found or auto-fill failed: ${e.message}`);
    }

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
