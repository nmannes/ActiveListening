const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const logger = require('./lib/logger');
const KalshiClient = require('./lib/kalshi');

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



        // const indexedKeywordsByLastWord = {};
        // for (const [key, value] of Object.entries(market.keywords)) {
        //     const words = key.toLowerCase().split(' ');
        //     const lastWord = words[words.length - 1];
        //     if (!indexedKeywordsByLastWord[lastWord]) {
        //         indexedKeywordsByLastWord[lastWord] = [];
        //     }
        //     indexedKeywordsByLastWord[lastWord].push({ key, words, value });
        // }


        // fs.writeFileSync('indexedKeywordsByLastWord.json', JSON.stringify(indexedKeywordsByLastWord, null, 2));



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
                // Set up the persistent line reader for transcription responses
                const responseLines = [];
                let responseResolve = null;
                rl.on('line', (responseLine) => {
                    if (responseResolve) {
                        const cb = responseResolve;
                        responseResolve = null;
                        cb(responseLine);
                    } else {
                        responseLines.push(responseLine);
                    }
                });
                const transcribe = (pcmBuffer) => {
                    return new Promise((res, rej) => {
                        try {
                            const header = `AUDIO ${pcmBuffer.length}\n`;
                            proc.stdin.write(header);
                            proc.stdin.write(pcmBuffer);
                            // Wait for the JSON response line
                            if (responseLines.length > 0) {
                                const line = responseLines.shift();
                                res(JSON.parse(line));
                            } else {
                                responseResolve = (line) => {
                                    try { res(JSON.parse(line)); } catch (e) { rej(e); }
                                };
                            }
                        } catch (e) {
                            rej(e);
                        }
                    });
                };
                transcribe.kill = () => proc.kill();
                transcribe.process = proc;
                resolve(transcribe);
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

        logger.info(`[TRADE] result: ${result}`);
    } else {
        logger.info(`[TRADE] Not trading for real but ${word} was said`)
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
    const { kalshi, market, transcriber, lastWordsCount, buyCount } = await init();
    const state = new Map();

    const sessionId = market ? market.slug : `test-run-${randomBytes(4).toString('hex')}`;
    state.set(sessionId, { transcript: [], audioChunks: [] });

    logger.info(`[${sessionId}] Starting capture process...`);

    const streamsDir = path.join(__dirname, 'streams');
    if (!fs.existsSync(streamsDir)) fs.mkdirSync(streamsDir);
    const outputFile = fs.createWriteStream(path.join(streamsDir, `${(new Date()).getTime()}-${sessionId}.webm`));

    // Spawn main.js

    logger.info(`[${sessionId}] Spawning main.js...`);

    let args = [
        "./main.js",
        '--sessionId', sessionId,
        '--url', market.mediaStreamURL,
    ]

    const child = spawn("node", args)
    // Cleanup on exit
    process.on('SIGINT', () => {
        child.kill();
        if (transcriber && transcriber.kill) transcriber.kill();
        process.exit();
    });

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

            if (transcriber) {
                try {
                    // Send raw PCM buffer to Python worker
                    const result = await transcriber(fullBuffer);
                    const text = (result.text || '').trim();

                    if (!text) return;

                    const session = state.get(sessionId);
                    const keywords = market['keywords'];

                    const words = text.split(' ');
                    for (const word of words) {
                        const token = word.replace(/[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g, '').toLowerCase();
                        if (!token) continue;

                        session.transcript.push(token)
                        if (session.transcript.length > 500) {
                            session.transcript.shift();
                        }

                        for (const [key, value] of Object.entries(keywords)) {
                            const keyLower = key.toLowerCase();
                            const keyWords = keyLower.split(' ');
                            const keyLen = keyWords.length;

                            // Only check if we have enough words in transcript
                            if (session.transcript.length >= keyLen) {
                                const transcriptTail = session.transcript.slice(-keyLen).join(' ');
                                if (keyLower === transcriptTail) {
                                    logger.info(`[${sessionId}][SIGNAL] Detected keyword: "${key}"`);
                                    await handleSignal(kalshi, keyLower, value, buyCount);
                                    delete keywords[keyLower];
                                    logger.info(`[${sessionId}][SIGNAL] last ${lastWordsCount} words: ${session.transcript.slice(-lastWordsCount).join(' ')}`)
                                }
                            }
                        }


                        if (session.transcript.length % lastWordsCount === 0) {
                            logger.info(`[${sessionId}] last ${lastWordsCount} words: ${session.transcript.slice(-lastWordsCount).join(' ')}`)
                        }
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