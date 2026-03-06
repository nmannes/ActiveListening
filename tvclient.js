#!/usr/bin/env node
/**
 * tvclient.js — Local TVHeadEnd audio streamer
 *
 * Captures audio from a TVHeadEnd MPEG-TS stream via ffmpeg,
 * demuxes the audio track (no transcoding), and streams the
 * compressed audio over WebSocket to the remote server.
 *
 * Usage:
 *   node tvclient.js --url <tvheadend-stream-url> --server <ws://remote:port> --matchJSON <base64-or-json>
 *   node tvclient.js --url <tvheadend-stream-url> --server <ws://remote:port> --fromFile market.json
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const logger = require('./lib/logger');

// ── CLI args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
    if (val.startsWith('--')) {
        const key = val.slice(2);
        const next = arr[i + 1];
        acc[key] = (next && !next.startsWith('--')) ? next : true;
    }
    return acc;
}, {});


let REMOTE_IP_ADDRESS = args.ip;
if (fs.existsSync('remote_server_ip.txt')) {
    REMOTE_IP_ADDRESS = fs.readFileSync('remote_server_ip.txt', 'utf8').trim();
}


const REMOTE_URL = args.server || `ws://${REMOTE_IP_ADDRESS}:8090`;

// ── Parse market data ────────────────────────────────────────────────
let market = null;
if (args.fromFile) {
    market = JSON.parse(fs.readFileSync(args.fromFile, 'utf8'));
} else if (args.matchJSON) {
    try {
        if (args.matchJSON.trim().startsWith('{')) {
            market = JSON.parse(args.matchJSON);
        } else {
            market = JSON.parse(Buffer.from(args.matchJSON, 'base64').toString());
        }
    } catch (e) {
        console.error(`Failed to parse matchJSON: ${e.message}`);
        process.exit(1);
    }
} else {
    console.error('Must provide --matchJSON or --fromFile with market data');
    process.exit(1);
}

let STREAM_URL = args.url || market.mediaStreamURL || market.channelURL;
if (!STREAM_URL) {
    console.error('Usage: node tvclient.js --url <tvheadend-url> --server <ws://host:port> --matchJSON <json>');
    process.exit(1);
}


const LISTEN = !!args.listen;

market.mediaStreamURL = market.mediaStreamURL || market.channelURL || STREAM_URL;
logger.info(`Market: ${market.title || market.slug}`);
logger.info(`Stream: ${STREAM_URL}`);
logger.info(`Remote: ${REMOTE_URL}`);
if (LISTEN) logger.info(`[listen] Local audio playback enabled`);

// ── Orderbook tracking (runs locally) ────────────────────────────────
const { startOrderbookTracking } = require('./lib/orderbook_tracking');
const orderbook = startOrderbookTracking(market);
logger.info('Orderbook tracking started locally');

// ── Constants ────────────────────────────────────────────────────────
const RECONNECT_DELAY_MS = 3_000;
const AUDIO_TIMEOUT_MS = 60_000;
const RESPAWN_DELAY_MS = 3_000;

let isShuttingDown = false;

// ── WebSocket connection with auto-reconnect ─────────────────────────
let ws = null;

function connectWebSocket() {
    if (isShuttingDown) return;

    logger.info(`[ws] Connecting to ${REMOTE_URL}...`);
    ws = new WebSocket(REMOTE_URL);

    ws.on('open', () => {
        logger.info(`[ws] Connected to remote server`);

        // Send handshake with market data
        ws.send(JSON.stringify({
            type: 'hello',
            market,
        }));

        // Start heartbeat
        this.heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
        }, 2000);
    });

    ws.on('message', (data) => {
        // Log any messages from the server (transcripts, signals, etc.)
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'signal') {
                logger.info(`[remote] SIGNAL: ${msg.keyword} → ${msg.ticker}`);
            } else if (msg.type === 'transcript') {
                logger.debug(`[remote] transcript: ${msg.text}`);
            } else if (msg.type === 'pong') {
                const rtt = Date.now() - msg.ts;
                logger.info(`[ws] RTT: ${rtt}ms`);
            } else if (msg.type === 'telemetry') {
                logger.info(`[remote] Buffer: ${msg.buffer_ms}ms | Proc: ${msg.last_proc_ms}ms`);
            } else {
                logger.debug(`[remote] ${JSON.stringify(msg)}`);
            }
        } catch (e) {
            logger.debug(`[remote] data error: ${e.message}`);
        }
    });

    ws.on('close', (code) => {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (isShuttingDown) return;
        logger.warn(`[ws] Connection closed (code ${code}), reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
        setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
    });

    ws.on('error', (err) => {
        logger.error(`[ws] Error: ${err.message}`);
        // 'close' event will fire after this and trigger reconnect
    });
}

// ── FFmpeg pipeline ──────────────────────────────────────────────────
function spawnFFmpeg() {
    if (isShuttingDown) return;

    logger.info(`[ffmpeg] Spawning: ${STREAM_URL}`);

    const ffmpegArgs = [
        '-y',
        // Minimize latency (but probe enough to detect AC3 stream params)
        '-fflags', 'nobuffer+genpts+discardcorrupt',
        '-flags', 'low_delay',
        '-probesize', '1000000',
        '-analyzeduration', '1000000',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', STREAM_URL,
        // Output: raw PCM to stdout — send over WebSocket (reliable TCP)
        '-map', '0:a:0',
        '-c:a', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-f', 's16le', 'pipe:1'
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Send PCM audio to remote server over WebSocket (binary frames)
    ffmpeg.stdout.on('data', (data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ffmpeg.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
            logger.trace(`[ffmpeg] ${line}`);
        }
    });

    ffmpeg.on('close', (code) => {
        if (isShuttingDown) {
            logger.info(`[ffmpeg] Exited (code ${code}) — shutting down`);
            return;
        }
        logger.warn(`[ffmpeg] Exited (code ${code}), respawning in ${RESPAWN_DELAY_MS / 1000}s...`);
        setTimeout(spawnFFmpeg, RESPAWN_DELAY_MS);
    });

    ffmpeg.on('error', (err) => {
        logger.error(`[ffmpeg] Spawn error: ${err.message}`);
    });

    return ffmpeg;
}

// ── Video frame grabber (1 frame every 2s) ──────────────────────────
let frameGrabberProc = null;

function spawnFrameGrabber() {
    if (isShuttingDown) return;

    logger.info(`[frames] Starting frame grabber: ${STREAM_URL}`);

    const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-fflags', 'nobuffer+genpts+discardcorrupt+lowdelay',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', STREAM_URL,
        '-vf', 'fps=0.5',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-q:v', '5',
        'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let jpegBuffer = Buffer.alloc(0);

    ffmpeg.stdout.on('data', (data) => {
        jpegBuffer = Buffer.concat([jpegBuffer, data]);

        // Extract complete JPEG frames (SOI FF D8 … EOI FF D9)
        let endIdx;
        while ((endIdx = jpegBuffer.indexOf(Buffer.from([0xFF, 0xD9]))) !== -1) {
            // Find the JPEG start-of-image marker
            const startIdx = jpegBuffer.indexOf(Buffer.from([0xFF, 0xD8]));
            if (startIdx === -1 || startIdx > endIdx) {
                // No valid SOI before this EOI — discard up to past the EOI
                jpegBuffer = jpegBuffer.slice(endIdx + 2);
                continue;
            }

            const frame = jpegBuffer.slice(startIdx, endIdx + 2);
            jpegBuffer = jpegBuffer.slice(endIdx + 2);

            if (ws && ws.readyState === WebSocket.OPEN) {
                // Tag with 4-byte magic header so server can distinguish from audio
                // "FRM\x01" — unlikely to appear in PCM audio data
                const header = Buffer.from([0x46, 0x52, 0x4D, 0x01]);
                ws.send(Buffer.concat([header, frame]));
                logger.info(`[frames] Sent frame: ${frame.length} bytes`);
            }
        }
    });

    ffmpeg.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
            logger.trace(`[frames] ${line}`);
        }
    });

    ffmpeg.on('close', (code) => {
        if (isShuttingDown) {
            logger.info(`[frames] Exited (code ${code}) — shutting down`);
            return;
        }
        logger.warn(`[frames] Exited (code ${code}), respawning in ${RESPAWN_DELAY_MS / 1000}s...`);
        setTimeout(spawnFrameGrabber, RESPAWN_DELAY_MS);
    });

    ffmpeg.on('error', (err) => {
        logger.error(`[frames] Spawn error: ${err.message}`);
    });

    frameGrabberProc = ffmpeg;
    return ffmpeg;
}

// ── Local audio debug recording (--listen) ──────────────────────────
let listenProc = null;
function spawnListener() {
    if (!LISTEN || isShuttingDown) return;
    const outFile = path.join(__dirname, 'debug_audio.wav');
    logger.info(`[listen] Recording 30s of audio to ${outFile}`);
    listenProc = spawn('ffmpeg', [
        '-y',
        '-probesize', '1000000',
        '-analyzeduration', '1000000',
        '-i', STREAM_URL,
        '-map', '0:a:0',
        '-c:a', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-t', '30',
        outFile,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    listenProc.stderr.on('data', () => { });
    listenProc.on('close', (code) => {
        logger.info(`[listen] Saved debug audio to ${outFile} (exit ${code})`);
    });
}

// ── Startup ──────────────────────────────────────────────────────────
let ffmpegProc = null;

connectWebSocket();

// Small delay to let WS connect before starting audio, but don't block on it
setTimeout(() => {
    ffmpegProc = spawnFFmpeg();
    spawnFrameGrabber();
    if (LISTEN) spawnListener();
}, 500);

// ── Cleanup ──────────────────────────────────────────────────────────
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    isShuttingDown = true;
    if (ffmpegProc) ffmpegProc.kill();
    if (frameGrabberProc) frameGrabberProc.kill();
    if (listenProc) listenProc.kill();
    if (ws) ws.close();
    if (orderbook && orderbook.stop) orderbook.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    isShuttingDown = true;
    if (ffmpegProc) ffmpegProc.kill();
    if (frameGrabberProc) frameGrabberProc.kill();
    if (listenProc) listenProc.kill();
    if (ws) ws.close();
    if (orderbook && orderbook.stop) orderbook.stop();
    process.exit(0);
});
