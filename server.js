const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const logger = require('./lib/logger');
const KalshiClient = require('./lib/kalshi');

// CLI argument parsing
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

const KALSHI_ENV = args.env || 'demo';


require('dotenv').config({
    path: `.env.${KALSHI_ENV}`
});


async function init() {
    try {
        const modelName = process.env.WHISPER_MODEL || 'Xenova/whisper-base.en';
        const isDryRun = process.env.DRY_RUN === 'true';
        logger.info(`Loading transcription model (${modelName})...`);
        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
            cache_dir: './models',
        });
        logger.info('Model loaded.');


        const markets = [];

        const kalshi = new KalshiClient(
            process.env.KALSHI_KEY_ID,
            process.env.KALSHI_PRIVATE_KEY_PATH,
            KALSHI_ENV
        );

        return {
            kalshi,
            markets,
            isDryRun,
            transcriber,
        }
    } catch (err) {
        logger.fatal('Initialization failed', err);
    }
};

async function handleSignal(word, sessionId, market, isDryRun) {
    if (isDryRun) {
        logger.info('Dry run, not placing bet');
        logger.fatal(`[${sessionId}] Handling signal: ${word} for ${market.link}...`);
        return;
    }

};

function calculateRMS(buffer) {
    let sum = 0;
    // buffer is 16-bit integers
    for (let i = 0; i < buffer.length; i += 2) {
        const sample = buffer.readInt16LE(i) / 32768.0;
        sum += sample * sample;
    }
    return Math.sqrt(sum / (buffer.length / 2));
}

(async () => {
    const { kalshi, markets, isDryRun, transcriber } = await init();
    const sessionState = new Map();
    const marketMap = new Map();

    const exampleMarket = {
        "link": "https://kalshi.com/markets/kxwomention/winter-olympics/kxwomention-26feb17",
        "slug": "hello-world",
        "eventStartTimeTS": 1771266600000,
        "eventStartTime": "2/16/2026, 1:30:00 PM",
        "mediaStreamURL": "https://www.youtube.com/watch?v=AxxVM_Vfcck",
        "keywords": {
            "job": "hello"
        }
    }

    // Single session for the example
    const market = exampleMarket;
    const sessionId = market.slug;
    marketMap.set(sessionId, market);
    sessionState.set(sessionId, { transcript: [], audioChunks: [] });

    logger.info(`[${sessionId}] Starting capture process...`);

    const streamsDir = path.join(__dirname, 'streams');
    if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir);
    const outputFile = fs.createWriteStream(path.join(streamsDir, `${(new Date()).getTime()}-${sessionId}.webm`));

    // Spawn main.js

    logger.info(`[${sessionId}] Spawning main.js...`);
    const child = spawn("node", [
        "./main.js",
        "--url", market.mediaStreamURL,
    ]);

    // Cleanup on exit
    process.on('SIGINT', () => {
        child.kill();
        process.exit();
    });

    // Handle logs from child
    child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
            // Directly log child logs without adding extra prefixes if they are already formatted
            if (line.includes('[Browser]')) logger.info(line);
            else logger.info(`[${sessionId}] [Child] ${line}`);
        });
    });

    // Setup FFmpeg
    // Reading from child.stdout (main.js stdout) -> Pipe to ffmpeg stdin
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',      // Input from stdin
        '-f', 's16le',       // Output format PCM 16-bit Little Endian
        '-acodec', 'pcm_s16le',
        '-ar', '16000',      // Sample rate 16k
        '-ac', '1',          // Mono
        'pipe:1'             // Output to stdout
    ]);

    // Pipe audio: main.js -> ffmpeg
    child.stdout.on('data', (chunk) => {
        logger.debug(`[${sessionId}] Received ${chunk.length} bytes from child`);
    });
    child.stdout.pipe(ffmpeg.stdin);
    // Also save raw stream for debugging if needed, but ffmpeg expects webm/opus usually. 
    // Since main.js sends webm/opus via stdout, we can also pipe it to file:
    child.stdout.pipe(outputFile);

    ffmpeg.stderr.on('data', (data) => {
        // logger.debug(`[${sessionId}] [ffmpeg] ${data.toString()}`);
    });

    let pcmBuffer = [];
    const CHUNK_THRESHOLD = 16000 * 2 * 2; // ~2 seconds of 16-bit audio (2 bytes/sample)
    const VAD_THRESHOLD = 0.01; // Adjust based on noise levels

    ffmpeg.stdout.on('data', async (chunk) => {
        pcmBuffer.push(chunk);
        const totalLength = pcmBuffer.reduce((acc, c) => acc + c.length, 0);

        if (totalLength >= CHUNK_THRESHOLD) {
            const fullBuffer = Buffer.concat(pcmBuffer);
            pcmBuffer = [];

            // VAD Check
            const rms = calculateRMS(fullBuffer);
            if (rms < VAD_THRESHOLD) {
                // logger.debug(`[${sessionId}] Silence detected (RMS: ${rms.toFixed(4)}), skipping...`);
                return;
            }

            // Convert to Float32 for model
            const float32Array = new Float32Array(fullBuffer.length / 2);
            for (let i = 0; i < float32Array.length; i++) {
                float32Array[i] = fullBuffer.readInt16LE(i * 2) / 32768.0;
            }

            if (transcriber) {
                try {
                    const result = await transcriber(float32Array);
                    const text = result.text.trim();
                    if (!text) return;

                    const state = sessionState.get(sessionId);
                    const keywords = marketMap.get(sessionId)['keywords'];

                    const words = text.split(' ');
                    for (const word of words) {
                        logger.info(`[${sessionId}] Transcribed: ${word}`);
                        if (Object.hasOwn(keywords, word)) {
                            await handleSignal(word, sessionId, market, isDryRun);
                        }
                        state.transcript.push(word);
                    }
                } catch (e) {
                    logger.error(`[${sessionId}] Transcription error:`, e);
                }
            }
        }
    });

    child.on('close', (code) => {
        logger.info(`[${sessionId}] Child process exited with code ${code}`);
        process.exit(0);
    });

})();