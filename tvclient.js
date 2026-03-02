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


market.mediaStreamURL = market.mediaStreamURL || market.channelURL || STREAM_URL;
logger.info(`Market: ${market.title || market.slug}`);
logger.info(`Stream: ${STREAM_URL}`);
logger.info(`Remote: ${REMOTE_URL}`);

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
                logger.info(`[remote] Lag: ${msg.vad_lag_ms}ms (VAD) + ${msg.decoder_lag_ms}ms (Decoder) | Last Proc: ${msg.last_proc_ms}ms`);
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
        // Minimize latency
        '-fflags', 'nobuffer+genpts+discardcorrupt',
        '-flags', 'low_delay',
        '-probesize', '32',
        '-analyzeduration', '0',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', STREAM_URL,
        // Output: raw AAC over UDP (matches RTP latency, no SDP required)
        '-map', '0:a:0',
        '-c:a', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-f', 's16le', `udp://${new URL(REMOTE_URL).hostname}:8092`
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
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

// ── Startup ──────────────────────────────────────────────────────────
let ffmpegProc = null;

connectWebSocket();

// Small delay to let WS connect before starting audio, but don't block on it
setTimeout(() => {
    ffmpegProc = spawnFFmpeg();
}, 500);

// ── Cleanup ──────────────────────────────────────────────────────────
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    isShuttingDown = true;
    if (ffmpegProc) ffmpegProc.kill();
    if (ws) ws.close();
    if (orderbook && orderbook.stop) orderbook.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    isShuttingDown = true;
    if (ffmpegProc) ffmpegProc.kill();
    if (ws) ws.close();
    if (orderbook && orderbook.stop) orderbook.stop();
    process.exit(0);
});
