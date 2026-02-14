const puppeteer = require('puppeteer');
const fs = require('fs');

async function test() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: "new", // "new" is recommended for modern Puppeteer
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--use-fake-ui-for-media-stream", // Allows media capture without prompts
            "--autoplay-policy=no-user-gesture-required",
        ],
    });

    try {
        const page = await browser.newPage();
        console.log("Navigating to YouTube...");
        await page.goto("https://www.youtube.com/watch?v=Z33nVLZ5NbI", { waitUntil: "networkidle2" });

        const file = fs.createWriteStream(__dirname + "/test.webm");

        // Expose a function to the page to receive audio chunks
        await page.exposeFunction('sendChunk', (data) => {
            const buffer = Buffer.from(data);
            file.write(buffer);
        });

        console.log("Injecting capture script...");
        await page.evaluate(async () => {
            const video = document.querySelector('video');
            if (!video) {
                console.error("No video element found");
                return;
            }

            // Capture the stream from the video element
            const fullStream = video.captureStream();

            // Create an audio-only stream
            const audioStream = new MediaStream(fullStream.getAudioTracks());

            const recorder = new MediaRecorder(audioStream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            recorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    const reader = new FileReader();
                    reader.onload = async () => {
                        const arrayBuffer = reader.result;
                        // Send the chunk back to Node.js
                        window.sendChunk(Array.from(new Uint8Array(arrayBuffer)));
                    };
                    reader.readAsArrayBuffer(event.data);
                }
            };

            recorder.start(100); // Send chunks every 100ms
            console.log("Recording started in page context");

            // Store for cleanup if needed
            window._recorder = recorder;
        });

        console.log("Recording for 10 seconds...");
        await new Promise(r => setTimeout(r, 10000));

        console.log("Stopping recording...");
        await page.evaluate(() => {
            if (window._recorder) {
                window._recorder.stop();
            }
        });

        // Wait a bit for final chunks
        await new Promise(r => setTimeout(r, 1000));

        file.end();
        console.log("Finished. Audio saved to test.webm");

    } catch (e) {
        console.error("Capture failed:", e);
    } finally {
        await browser.close();
    }
}

test();