const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const logger = require('./lib/logger');
const KalshiClient = require('./lib/kalshi');

const { args, KALSHI_ENV } = require('./lib/args');


async function init() {
    try {

        logger.info(`LOG_LEVEL: INFO`);
        logger.debug(`LOG_LEVEL: DEBUG`);
        logger.info(`Environment: ${KALSHI_ENV}`);
        const modelName = process.env.WHISPER_MODEL || 'Xenova/whisper-base.en';
        logger.info(`Loading transcription model (${modelName})...`);
        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
            cache_dir: './models',
        });
        logger.info('Model loaded.');

        if (!process.env.KALSHI_KEY_ID) throw new Error("KALSHI_KEY_ID is missing from environment variables");
        if (!process.env.KALSHI_PRIVATE_KEY_PATH) throw new Error("KALSHI_PRIVATE_KEY_PATH is missing from environment variables");

        logger.info(`Loading markets for ${KALSHI_ENV}...`);
        const rawData = fs.readFileSync(`${__dirname}/${KALSHI_ENV}_markets_with_event_times.json`);

        const markets = JSON.parse(rawData);

        const market = markets.find(m => m.link === args.kalshiLink) || markets.find(m => m.mediaStreamURL !== null);
        if (!market) throw new Error(`no market available rn :(`);

        const kalshi = new KalshiClient(
            process.env.KALSHI_KEY_ID,
            process.env.KALSHI_PRIVATE_KEY_PATH,
            KALSHI_ENV
        );

        logger.info(`Market: ${market.title}`);
        logger.info(`Trading enabled: ${process.env.TRADE_FOR_REAL}`);

        return {
            kalshi,
            market,
            enableTrading: process.env.TRADE_FOR_REAL,
            transcriber,
        }
    } catch (err) {
        logger.fatal({ err }, 'Initialization failed: ' + err.message);
        process.exit(1);
    }
};

async function handleSignal(kalshi, word, ticker, enableTrading) {
    logger.info(`In this scenario I would bet on: ${word}`);

    logger.info("^^^")
    logger.info(await kalshi.getOrderbookValue(ticker))


    // await kalshi.placeOrder({
    //     ticker,
    //     count: 1,
    // });

    //logger.info(`BET ON WORD: ${word}`);
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
    const { kalshi, market, enableTrading, transcriber } = await init();
    const state = new Map();

    const sessionId = market.slug;
    state.set(sessionId, { transcript: [], audioChunks: [] });

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
        logger.trace(`[${sessionId}] Received ${chunk.length} bytes from child`);
    });
    child.stdout.pipe(ffmpeg.stdin);
    // Also save raw stream for debugging if needed, but ffmpeg expects webm/opus usually. 
    // Since main.js sends webm/opus via stdout, we can also pipe it to file:
    child.stdout.pipe(outputFile);

    ffmpeg.stderr.on('data', (data) => {
        logger.trace(`[${sessionId}] [ffmpeg] ${data.toString()}`);
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
                    const result = await transcriber(float32Array, { sampling_rate: 16000 });
                    if (result.text) {
                        logger.debug(`[${sessionId}] Raw text: "${result.text}"`);
                    }
                    const text = result.text.trim();
                    if (!text) return;

                    const session = state.get(sessionId);
                    const keywords = market['keywords'];

                    const words = text.split(' ');
                    for (const word of words) {
                        const token = word.replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '').toLowerCase();

                        // Fix: Check the *previous word in the transcript*, not keywords
                        const previousToken = session.transcript.at(-1);
                        const lastTwo = previousToken ? [previousToken, token].join(' ') : null;

                        logger.debug(`[${sessionId}] token: ${token}, lastTwo: ${lastTwo}`)

                        if (token in keywords) {
                            await handleSignal(kalshi, token, keywords[token], enableTrading);
                        } else if (lastTwo in keywords) {
                            await handleSignal(kalshi, lastTwo, keywords[lastTwo], enableTrading);
                        }

                        session.transcript.push(token);
                    }
                } catch (e) {
                    logger.error({ err: e }, `[${sessionId}] Transcription error`);
                }
            }
        }
    });

    child.on('close', (code) => {
        logger.info(`[${sessionId}] Child process exited with code ${code}`);

        process.exit(0);
    });

})();