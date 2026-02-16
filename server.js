require('dotenv').config();
const WebSocket = require('ws');
const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const logger = require('./lib/logger');
const KalshiClient = require('./lib/kalshi');
const { frontPageMarkets } = require('./lib/discover_markets');




async function initListeningSession(market) {
    spawn(
        "node", [
        "./main.js",
        "--id", market.slug,
        "--url", market.mediaStreamURL,
    ])
}


async function init() {
    try {
        const modelName = process.env.WHISPER_MODEL || 'Xenova/whisper-base.en';
        const port = process.env.WS_PORT || 7654;
        const isDryRun = process.env.DRY_RUN === 'true';
        logger.info(`Loading transcription model (${modelName})...`);
        const transcriber = await pipeline('automatic-speech-recognition', modelName, {
            cache_dir: './models',
        });
        logger.info('Model loaded.');


        const markets = []; //await frontPageMarkets();

        const kalshi = new KalshiClient(
            process.env.KALSHI_KEY_ID,
            process.env.KALSHI_PRIVATE_KEY_PATH,
            process.env.KALSHI_ENV
        );

        return {
            port,
            kalshi,
            markets,
            isDryRun,
            transcriber,
        }
    } catch (err) {
        logger.fatal('Initialization failed', err);
    }
};

async function handleSignal(word, sessionId, market) {
    logger.fatal(`[${sessionId}] Handling signal: ${word} for ${market.link}...`);
};



(async () => {


    const { port, kalshi, markets, isDryRun, transcriber } = await init();

    const sessionState = new Map();
    const marketMap = new Map();


    for (const market of markets) {
        marketMap.set(market.slug, market);
    }

    const exampleMarket = {
        "link": "https://kalshi.com/markets/kxwomention/winter-olympics/kxwomention-26feb17",
        "slug": "hello-world",
        "eventStartTimeTS": 1771266600000,
        "eventStartTime": "2/16/2026, 1:30:00 PM",
        "mediaStreamURL": "https://www.youtube.com/watch?v=AxxVM_Vfcck",
        "keywords": {
            "tonight": "hello"
        }
    }
    if (exampleMarket) {
        marketMap.set(exampleMarket.slug, exampleMarket);
    }




    // Initialize Components


    const wss = new WebSocket.Server({ port });
    logger.info(`WebSocket server listening on ws://localhost:${port}`);




    wss.on('connection', (ws, req) => {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const sessionId = urlParams.get('id') || 'unknown';

        logger.info(`[${sessionId}] Client connected`);

        if (!sessionState.has(sessionId)) {
            sessionState.set(sessionId, { transcript: [], audioChunks: [] });
        }

        const streamsDir = path.join(__dirname, 'streams');
        if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir);
        const outputFile = fs.createWriteStream(path.join(streamsDir, `received_${sessionId}.webm`));

        const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',
            '-f', 's16le',
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            'pipe:1'
        ]);

        let pcmBuffer = [];
        const CHUNK_THRESHOLD = 16000 * 2 * 2; // ~2 seconds

        ffmpeg.stdout.on('data', async (chunk) => {
            pcmBuffer.push(chunk);
            const totalLength = pcmBuffer.reduce((acc, c) => acc + c.length, 0);

            if (totalLength >= CHUNK_THRESHOLD) {
                const fullBuffer = Buffer.concat(pcmBuffer);
                pcmBuffer = [];

                const float32Array = new Float32Array(fullBuffer.length / 2);
                for (let i = 0; i < float32Array.length; i++) {
                    float32Array[i] = fullBuffer.readInt16LE(i * 2) / 32768.0;
                }

                if (transcriber) {
                    try {
                        const result = await transcriber(float32Array);
                        const text = result.text;
                        if (!text) return;

                        const state = sessionState.get(sessionId);
                        const keywords = marketMap.get(sessionId)['keywords'];

                        const words = text.split(' ');
                        for (const word of words) {
                            logger.debug(`[${sessionId}] Transcribed: ${text}`);
                            if (Object.hasOwn(keywords, word)) {
                                await handleSignal(word, sessionId, marketMap.get(sessionId));
                            }
                            state.transcript.push(word);
                        }



                    } catch (e) {
                        logger.error(`[${sessionId}] Transcription error:`, e);
                    }
                }
            }
        });

        ws.on('message', (message) => {
            if (typeof message === 'string' || Buffer.isBuffer(message)) {
                try {
                    const text = message.toString();
                    if (text.startsWith('{') && text.endsWith('}')) {
                        const data = JSON.parse(text);
                        if (data.type === 'get_transcript') {
                            ws.send(JSON.stringify({
                                type: 'transcript',
                                sessionId,
                                text: sessionState.get(sessionId).transcript
                            }));
                            return;
                        }
                    }
                } catch (err) { }
            }
            outputFile.write(message);
            ffmpeg.stdin.write(message);
        });

        ws.on('close', () => {
            logger.info(`[${sessionId}] Client disconnected`);
            ffmpeg.stdin.end();
            outputFile.end();
        });

        ws.on('error', (error) => {
            logger.error(`[${sessionId}] WebSocket error:`, error);
            ffmpeg.stdin.end();
            outputFile.end();
        });
    });


    initListeningSession(exampleMarket);
})();