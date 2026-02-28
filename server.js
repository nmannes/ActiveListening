const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const logger = require('./lib/logger');
const KalshiClient = require('./lib/kalshi');
const { buildKeywordIndex, findKeywordMatch, removeFromIndex } = require('./lib/matching');

const { args, KALSHI_ENV } = require('./lib/args');
const { randomBytes } = require('crypto');


async function init() {
    try {

        logger.info(`LOG_LEVEL: INFO`);
        logger.debug(`LOG_LEVEL: DEBUG`);
        logger.info(`Environment: ${KALSHI_ENV}`);
        logger.info('Spawning Python transcription worker...');
        const transcriber = await spawnTranscriber();
        logger.info('Python transcriber ready.');

        if (!process.env.KALSHI_KEY_ID) throw new Error("KALSHI_KEY_ID is missing from environment variables");
        if (!process.env.KALSHI_PRIVATE_KEY_PATH) throw new Error("KALSHI_PRIVATE_KEY_PATH is missing from environment variables");

        let market = null;
        if (args.fromFile) {
            market = JSON.parse(fs.readFileSync(args.fromFile, 'utf8'));
        } else if (args.matchJSON) {
            try {
                // Check if it looks like JSON, otherwise assume base64
                if (args.matchJSON.trim().startsWith('{')) {
                    market = JSON.parse(args.matchJSON);
                } else {
                    market = JSON.parse(Buffer.from(args.matchJSON, 'base64').toString());
                }
            } catch (e) {
                logger.error(`Failed to parse matchJSON: ${e.message}`);
                throw new Error(`Invalid matchJSON: ${e.message}`);
            }
            market.mediaStreamURL = market.mediaStreamURL || market.channelURL;
            logger.info(`Market: ${market.title} | Stream: ${market.mediaStreamURL}`);
        } else if (args.getFirst) {
            const data = fs.readFileSync(path.join(__dirname, 'final_markets_with_streams.json'), 'utf-8');
            market = JSON.parse(data).find(m => m['channelURL'] !== null);
            market.mediaStreamURL = market.channelURL;
            logger.info('Getting first market...');
        } else {
            throw new Error('No market provided via --matchJSON. This is required.');
        }



        const keywordIndex = buildKeywordIndex(market.keywords);


        fs.writeFileSync(`./debug/indexedKeywordsByLastWord-${market.slug}.json`, JSON.stringify(keywordIndex, null, 2));



        const kalshi = new KalshiClient(
            process.env.KALSHI_KEY_ID,
            process.env.KALSHI_PRIVATE_KEY_PATH,
            KALSHI_ENV
        );

        logger.info(`Trading enabled: ${process.env.TRADE_FOR_REAL || false}`);

        return {
            kalshi,
            market,
            transcriber,
            keywordIndex,
            buyCount: args.buyCount || 5,
            lastWordsCount: args.lastWordsCount || 7,
        }
    } catch (err) {
        logger.fatal({ err }, 'Initialization failed: ' + err.message);
        process.exit(1);
    }
};

function spawnTranscriber() {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [
            path.join(__dirname,
                'transcribe_worker.py'),
            '--model',
            process.env.WHISPER_MODEL,
            '--device',
            process.env.TRANSCRIPTION_HARDWARE || 'cpu'
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        proc.stderr.on('data', (data) => {
            data.toString().split('\n').filter(l => l.trim()).forEach(line => {
                logger.info(`[transcribe_worker] ${line}`);
            });
        });

        proc.on('error', (err) => reject(new Error(`Failed to spawn transcribe_worker: ${err.message}`)));
        proc.on('close', (code) => logger.warn(`[transcribe_worker] exited with code ${code}`));

        // Wait for the READY signal
        const rl = readline.createInterface({ input: proc.stdout });
        const lineHandler = (line) => {
            if (line.trim() === 'READY') {
                rl.removeListener('line', lineHandler);

                // Now, continuously listen for transcription results from Python
                rl.on('line', (responseLine) => {
                    try {
                        const result = JSON.parse(responseLine);
                        if (proc._onTranscript && result.text) {
                            proc._onTranscript(result.text);
                        }
                    } catch (e) {
                        logger.error(`Failed to parse worker response: ${responseLine}`);
                    }
                });

                const transcriber = {
                    write: (pcmBuffer) => proc.stdin.write(pcmBuffer),
                    onTranscript: (cb) => { proc._onTranscript = cb; },
                    kill: () => proc.kill()
                };
                resolve(transcriber);
            }
        };
        rl.on('line', lineHandler);

        // Timeout if worker doesn't become ready
        setTimeout(() => reject(new Error('Transcription worker did not become ready in 60s')), 60000);
    });
}

async function handleSignal(kalshi, word, ticker, buyCount) {
    if (process.env.TRADE_FOR_REAL || false) {

        const result = await kalshi.placeFillOrKillOrder({ ticker, count: buyCount });

        logger.info(result, `[TRADE] result`);
    } else {
        logger.info(`[TRADE] Not trading for real but ${word} was perceived at about ${new Date()}`)
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
    const { kalshi, market, transcriber, keywordIndex, lastWordsCount, buyCount } = await init();
    const state = new Map();

    const sessionId = market ? market.slug : `test-run-${randomBytes(4).toString('hex')}`;
    state.set(sessionId, { transcript: [], audioChunks: [] });

    logger.info(`[${sessionId}] Starting capture process...`);

    const streamsDir = path.join(__dirname, 'streams');
    if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir);

    const { startOrderbookTracking } = require('./lib/orderbook_tracking');
    const orderbook = startOrderbookTracking(market);

    const childArgs = [
        "./main.js",
        '--sessionId', sessionId,
        '--url', market.mediaStreamURL,
    ];

    const VAD_THRESHOLD = 0.005; // Lowered from 0.03 — quieter streams have RMS ~0.02
    const AUDIO_TIMEOUT_MS = 60_000; // 60 seconds with no audio = problem
    const RESPAWN_DELAY_MS = 3_000;

    function spawnPipeline() {
        let pcmBuffer = [];
        let lastAudioTime = Date.now();
        let isShuttingDown = false;

        const isTvHeadEnd = market.mediaStreamURL.includes('localhost:9981') || market.mediaStreamURL.includes('127.0.0.1:9981');

        logger.info(`[${sessionId}] Spawning main.js...`);

        const child = spawn("node", childArgs);

        // Cleanup on exit
        const sigintHandler = () => {
            isShuttingDown = true;
            child.kill();
            if (transcriber && transcriber.kill) transcriber.kill();
            if (orderbook && orderbook.stop) orderbook.stop();
            process.exit();
        };
        process.on('SIGINT', sigintHandler);

        // Handle logs from child
        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            lines.forEach(line => {
                if (line === '') {
                    return;
                } else if (line.includes('Ad state changed:')) {
                    logger.info(`[${sessionId}] [Child] ${line}`);
                } else {
                    logger.debug(`[${sessionId}] [Child] ${line}`);
                }
            });
        });

        // PCM source: either child.stdout directly (TVHeadEnd) or via ffmpeg decode (browser/WebM)
        let pcmSource;
        let ffmpeg = null;

        if (isTvHeadEnd) {
            // TVHeadEnd: child already outputs raw PCM (s16le, 16kHz, mono) — no ffmpeg needed
            logger.info(`[${sessionId}] TVHeadEnd mode: reading PCM directly from child (skipping ffmpeg decode)`);
            pcmSource = child.stdout;
            child.stdout.on('data', (chunk) => {
                logger.trace(`[${sessionId}] Received ${chunk.length} bytes PCM from child`);
            });
        } else {
            // Browser path: child outputs WebM/Opus, need ffmpeg to decode to PCM
            ffmpeg = spawn('ffmpeg', [
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-i', 'pipe:0',
                '-f', 's16le',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                'pipe:1'
            ]);
            pcmSource = ffmpeg.stdout;

            child.stdout.on('data', (chunk) => {
                logger.trace(`[${sessionId}] Received ${chunk.length} bytes from child`);
            });
            child.stdout.pipe(ffmpeg.stdin);

            ffmpeg.stderr.on('data', (data) => {
                logger.trace(`[${sessionId}] [ffmpeg] ${data.toString()}`);
            });
        }

        // Watchdog: detect if audio stops flowing
        let pcmChunkCount = 0;
        const watchdog = setInterval(() => {
            const silenceMs = Date.now() - lastAudioTime;
            logger.info(`[${sessionId}] [health] silenceSec=${(silenceMs / 1000).toFixed(0)} pcmChunks=${pcmChunkCount}`);
            if (silenceMs > AUDIO_TIMEOUT_MS) {
                logger.warn(`[${sessionId}] No audio received for ${(silenceMs / 1000).toFixed(0)}s — killing child to trigger restart`);
                child.kill();
            }
        }, 30_000);

        if (ffmpeg) ffmpeg.on('close', (code) => {
            logger.warn(`[${sessionId}] [server ffmpeg] exited with code ${code}`);
        });

        // Set up the continuous receiver for transcription sliding window
        if (transcriber) {
            transcriber.onTranscript(async (text) => {
                text = text.trim();
                if (!text) return;

                const session = state.get(sessionId);

                // Because Python yields the *entire* 3-second window every 300ms,
                // we see overlapping text. We only need to check if the keyword
                // popped up. The exact alignment logic isn't strictly necessary 
                // for simple keyword spotting since findKeywordMatch just checks the queue.
                const words = text.split(' ');
                for (const word of words) {
                    const token = word.replace(/[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g, '').toLowerCase();
                    if (!token) continue;

                    // Deduplicate adjacent identical tokens (rudimentary overlapping fix)
                    if (session.transcript.length > 0 && session.transcript[session.transcript.length - 1] === token) {
                        continue;
                    }

                    session.transcript.push(token);
                    if (session.transcript.length > 500) {
                        session.transcript.shift();
                    }

                    const matched = findKeywordMatch(keywordIndex, session.transcript, token);
                    if (matched) {
                        logger.info(`[${sessionId}][SIGNAL] Detected keyword: "${matched.key}"`);
                        await handleSignal(kalshi, matched.key.toLowerCase(), matched.value, buyCount);
                        removeFromIndex(keywordIndex, matched.key);
                        logger.info(`[${sessionId}][SIGNAL] last ${lastWordsCount} words: ${session.transcript.slice(-lastWordsCount).join(' ')}`);
                    }

                    if (session.transcript.length % lastWordsCount === 0) {
                        logger.info(`[${sessionId}] last ${lastWordsCount} words: ${session.transcript.slice(-lastWordsCount).join(' ')}`);
                    }
                }
            });
        }

        let vadSkipCount = 0;
        let vadBuffer = [];
        let vadBufferLen = 0;
        // 16000 hz * 2 bytes = 32000 bytes/sec. We'll check VAD every 0.1 seconds (3200 bytes)
        const VAD_CHUNK_SIZE = 3200;

        pcmSource.on('data', (chunk) => {
            lastAudioTime = Date.now();
            pcmChunkCount++;

            vadBuffer.push(chunk);
            vadBufferLen += chunk.length;

            if (vadBufferLen >= VAD_CHUNK_SIZE) {
                const fullBuffer = Buffer.concat(vadBuffer);
                vadBuffer = [];
                vadBufferLen = 0;

                const rms = calculateRMS(fullBuffer);
                if (rms < VAD_THRESHOLD) {
                    vadSkipCount++;
                    if (vadSkipCount % 50 === 1) {
                        logger.debug(`[${sessionId}] VAD silence skip #${vadSkipCount} (RMS: ${rms.toFixed(4)})`);
                    }
                    return;
                }

                // Active speech
                vadSkipCount = 0;
                if (transcriber) {
                    transcriber.write(fullBuffer);
                }
            }
        });

        child.on('close', (code) => {
            clearInterval(watchdog);
            process.removeListener('SIGINT', sigintHandler);

            if (isShuttingDown) {
                logger.info(`[${sessionId}] Child exited with code ${code} (shutdown)`);
                process.exit(0);
            }

            logger.warn(`[${sessionId}] Child exited with code ${code}, respawning in ${RESPAWN_DELAY_MS / 1000}s...`);
            setTimeout(() => spawnPipeline(), RESPAWN_DELAY_MS);
        });
    }

    spawnPipeline();
})();