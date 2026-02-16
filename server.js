require('dotenv').config();
const WebSocket = require('ws');
const fs = require('fs');
const { spawn } = require('child_process');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const logger = require('./lib/logger');
const db = require('./lib/db');
const KalshiClient = require('./lib/kalshi');
const { frontPageMarkets } = require('./lib/discover_markets');


const modelName = process.env.WHISPER_MODEL || 'Xenova/whisper-base.en';
const port = process.env.WS_PORT || 7654;
const isDryRun = process.env.DRY_RUN === 'true';

// Initialize Components
let transcriber;
const kalshi = new KalshiClient(
    process.env.KALSHI_KEY_ID,
    process.env.KALSHI_PRIVATE_KEY_PATH,
    process.env.KALSHI_ENV
);

let markets;

const init = async () => {
    try {
        logger.info(`Loading transcription model (${modelName})...`);
        transcriber = await pipeline('automatic-speech-recognition', modelName, {
            cache_dir: './models',
        });
        logger.info('Model loaded.');

        if (!isDryRun) {
            logger.info('Authentication initialized via RSA keys.');
        } else {
            logger.info('Running in DRY RUN mode. No trades will be placed.');
        }

        markets = await frontPageMarkets();
        logger.info(`Markets loaded: ${markets.length}`);

        const newKeywords = markets.map(market => {
            const title = market.title;
            // Extract stuff in quotes or fallback to first part of title
            const match = title.match(/'([^']+)'/) || title.match(/"([^"]+)"/);
            let keyword = match ? match[1] : title.split(' mentions ')[0];

            return {
                word: keyword,
                ticker: market.slug.toUpperCase(),
                side: 'yes'
            };
        }).filter(k => k.word);

        matcher.setKeywords(newKeywords);
        logger.debug(markets);
    } catch (err) {
        logger.error('Initialization failed', err);
        process.exit(1);
    }
};

init();



const wss = new WebSocket.Server({ port });
logger.info(`WebSocket server listening on ws://localhost:${port}`);

const sessionState = new Map();

wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const sessionId = urlParams.get('id') || 'unknown';

    logger.info(`[${sessionId}] Client connected`);

    if (!sessionState.has(sessionId)) {
        sessionState.set(sessionId, { transcript: "", audioChunks: [] });
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
                    const text = result.text.trim();
                    if (!text) return;

                    logger.info(`[${sessionId}] Transcribed: ${text}`);

                    // Record in session
                    const state = sessionState.get(sessionId);
                    state.transcript += " " + text;

                    // Match Signals
                    const signals = matcher.match(text);
                    for (const signal of signals) {
                        await handleSignal(sessionId, signal);
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

async function handleSignal(sessionId, signal) {
    logger.info(`[${sessionId}] Handling signal for ${signal.ticker}...`);

    let actionTaken = isDryRun ? 'DRY_RUN_LOGGED' : 'TRADE_PLACED';
    let tradeId = null;

    if (!isDryRun) {
        try {
            // Logic for price/size would go here (e.g. fetch order book first)
            const order = await kalshi.placeOrder({
                ticker: signal.ticker,
                side: signal.side,
                count: 1, // Start small
                price: 90, // $0.90 limit as per strategy
            });
            tradeId = order.order_id;

            // Save to DB
            db.run(`INSERT INTO trades (id, ticker, side, price, size, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [tradeId, signal.ticker, signal.side, 90, 1, 'placed']);

        } catch (err) {
            logger.error(`Failed to place trade for ${signal.ticker}`, err);
            actionTaken = 'TRADE_FAILED';
        }
    }

    // Log signal to DB
    db.run(`INSERT INTO signals (session_id, keyword, confidence, transcript, action_taken, trade_id) 
          VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, signal.word, signal.confidence, signal.matchedText, actionTaken, tradeId]);
    // }

    // Start visual market scanner
    const scannerArgs = ['discover_markets.js'];
    if (logger.level) {
        scannerArgs.push(`--log-level=${logger.level}`);
    }
    const scanner = spawn('node', scannerArgs, {
        stdio: 'inherit',
        detached: false
    });
    scanner.on('error', (err) => {
        logger.error('Failed to start market scanner:', err);
    });
    logger.info('Visual market scanner started.');

    process.on('SIGINT', () => {
        logger.info('Shutting down server...');
        if (wss) wss.close();
        if (scanner) scanner.kill();
        // db.close() isn't a function on the sqlite3 db object directly usually, 
        // but if it is wrapped in lib/db.js it might be. 
        // Checking lib/db.js usage in server.js: const db = require('./lib/db');
        // Usually standardized to process.exit()
        process.exit();
    });
};