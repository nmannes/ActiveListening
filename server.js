const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const logger = require('./lib/logger');
const KalshiClient = require('./lib/kalshi');

const { args, KALSHI_ENV } = require('./lib/args');


async function init() {
    try {
        const modelName = process.env.WHISPER_MODEL || 'Xenova/whisper-base.en';
        logger.info(`Loading transcription model (${modelName})...`);
        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
            cache_dir: './models',
        });
        logger.info('Model loaded.');

        if (!process.env.KALSHI_KEY_ID) throw new Error("KALSHI_KEY_ID is missing from environment variables");
        if (!process.env.KALSHI_PRIVATE_KEY_PATH) throw new Error("KALSHI_PRIVATE_KEY_PATH is missing from environment variables");

        const markets = []//await frontPageMarkets();

        const kalshi = new KalshiClient(
            process.env.KALSHI_KEY_ID,
            process.env.KALSHI_PRIVATE_KEY_PATH,
            KALSHI_ENV
        );

        return {
            kalshi,
            markets,
            isDryRun: args.dryRun || false, // Use args.dryRun if available or default to false
            transcriber,
        }
    } catch (err) {
        logger.fatal('Initialization failed', err);
        process.exit(1);
    }
};

async function handleSignal(word, sessionId, market, isDryRun) {
    if (isDryRun) {
        logger.info('Dry run, not placing bet');
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
        "link": "https://demo.kalshi.co/markets/kxstarmermentionb/kier-starmer/kxstarmermentionb-26feb19",
        "slug": "kxstarmermentionb-26feb19",
        "eventStartTimeTS": 1771415100000,
        "eventStartTime": "2/18/2026, 6:45:00 AM",
        "mediaStreamURL": "https://www.youtube.com/watch?v=AxxVM_Vfcck",
        "keywords": {
            "introduce": "KXSTARMERMENTIONB-26FEB19-ELEC"
        }
    }
    // const exampleMarket = {
    //     "link": "https://kalshi.com/markets/kxncaabmention/college-basketball/kxncaabmention-26feb16syrduke",
    //     "slug": "kxncaabmention-26feb16syrduke",
    //     "eventStartTimeTS": 1771286400000,
    //     "eventStartTime": "2/16/2026, 7:00:00 PM",
    //     "keywords": {
    //         "Overtime": "KXNCAABMENTION-26FEB16SYRDUKE-OVER",
    //         "Transfer": "KXNCAABMENTION-26FEB16SYRDUKE-TRAN",
    //         "Transferred": "KXNCAABMENTION-26FEB16SYRDUKE-TRAN",
    //         "Walk On": "KXNCAABMENTION-26FEB16SYRDUKE-WALK",
    //         "Ankle": "KXNCAABMENTION-26FEB16SYRDUKE-ANKL",
    //         "March Madness": "KXNCAABMENTION-26FEB16SYRDUKE-MARC",
    //         "Alley-oop": "KXNCAABMENTION-26FEB16SYRDUKE-ALLE",
    //         "Airball": "KXNCAABMENTION-26FEB16SYRDUKE-AIRB",
    //         "Airballs": "KXNCAABMENTION-26FEB16SYRDUKE-AIRB",
    //         "Airballed": "KXNCAABMENTION-26FEB16SYRDUKE-AIRB",
    //         "Recruit": "KXNCAABMENTION-26FEB16SYRDUKE-RECR",
    //         "Recruited": "KXNCAABMENTION-26FEB16SYRDUKE-RECR",
    //         "Recruitment": "KXNCAABMENTION-26FEB16SYRDUKE-RECR",
    //         "Draft": "KXNCAABMENTION-26FEB16SYRDUKE-DRAF",
    //         "Schedule": "KXNCAABMENTION-26FEB16SYRDUKE-SCHE",
    //         "NIL": "KXNCAABMENTION-26FEB16SYRDUKE-NIL",
    //         "Double Double": "KXNCAABMENTION-26FEB16SYRDUKE-DOUB",
    //         "Record": "KXNCAABMENTION-26FEB16SYRDUKE-RECO",
    //         "All American": "KXNCAABMENTION-26FEB16SYRDUKE-ALL",
    //         "Elbow": "KXNCAABMENTION-26FEB16SYRDUKE-ELBO",
    //         "Cameron Indoor": "KXNCAABMENTION-26FEB16SYRDUKE-CAME"
    //     },
    //     mediaStreamURL: 'https://www.espn.com/watch/player/_/id/03609cd5-1180-4a1c-9c6c-2b743405846e'
    // }

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
        logger.debug(`[${sessionId}] [ffmpeg] ${data.toString()}`);
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