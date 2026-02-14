const puppeteer = require('puppeteer');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');

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
const durationMs = parseInt(args.duration) * 1000 || 10000;
const sessionId = args.id || `session_${Math.random().toString(36).substring(7)}`;

async function test() {
    console.log(`[${sessionId}] Launching browser for ${targetUrl} (${durationMs / 1000}s)...`);
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

        // Forward browser console logs to Node.js console
        page.on('console', msg => {
            console.log(`[Browser] ${msg.type().toUpperCase()}: ${msg.text()}`);
        });

        console.log(`Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: "networkidle2" });

        const streamsDir = path.join(__dirname, 'streams');
        if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir);
        const localFile = fs.createWriteStream(path.join(streamsDir, `test_${sessionId}.webm`));

        console.log(`[${sessionId}] Connecting to WebSocket server...`);
        const ws = new WebSocket(`ws://localhost:7654?id=${sessionId}`);

        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });
        console.log("Connected to WebSocket server.");

        // Expose a function to the page to receive audio chunks
        await page.exposeFunction('sendChunk', (data) => {
            const buffer = Buffer.from(data);

            // Forward to WebSocket
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(buffer);
            }

            // Still save locally for backup/verification
            localFile.write(buffer);
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

        console.log(`Streaming for ${durationMs / 1000} seconds...`);
        await new Promise(r => setTimeout(r, durationMs));

        console.log("Stopping stream...");
        await page.evaluate(() => {
            if (window._recorder) {
                window._recorder.stop();
            }
        });

        // Wait a bit for final chunks
        await new Promise(r => setTimeout(r, 1000));

        localFile.end();
        ws.close();
        console.log("Finished. Streaming complete.");

    } catch (e) {
        console.error("Streaming failed:", e);
    } finally {
        await browser.close();
    }
}

test();