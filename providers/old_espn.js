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
