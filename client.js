#!/usr/bin/env node
/**
 * client.js — Unified streaming client
 *
 * Handles all shared boilerplate (CLI args, IP discovery, market parsing,
 * WebSocket connection, orderbook tracking, shutdown) and delegates
 * media-specific capture to a swappable provider module.
 *
 * Usage:
 *   node client.js --provider tv      --fromFile market.json [--duration 30] [--listen]
 *   node client.js --provider browser  --fromFile market.json [--duration 30]
 *   node client.js --fromFile market.json   (auto-detects provider from stream URL)
 */

const crypto = require("crypto");
const path = require("path");
const { execSync } = require("child_process");
const net = require("net");
const fs = require("fs");
const WebSocket = require("ws");
const baseLogger = require("./lib/logger");
const { applyWordConfigurations } = require("./lib/word_configurations");
const { waitIfNecessary, waitUntilEnded } = require("./lib/event_started_yet");
const { sendTelegram } = require("./lib/telegram");
const config = require("./lib/config");

// ── CLI args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
  if (val.startsWith("--")) {
    const key = val.slice(2);
    const next = arr[i + 1];
    acc[key] = next && !next.startsWith("--") ? next : true;
  }
  return acc;
}, {});

const runUUID = crypto.randomUUID();

// ── Help ─────────────────────────────────────────────────────────────
if (args.help) {
  console.log(`
Usage: node client.js [options]

Options:
  --provider <tv|browser>   Stream provider (auto-detected if omitted)
  --url <stream-url>        Media stream URL
  --ip <ip>                 Remote server IP
  --server <ws://host:port> Remote WebSocket URL
  --matchJSON <json|base64> Market data as JSON or base64
  --fromFile <file.json>    Market data from file
  --duration <minutes>      Auto-shutdown after N minutes (default 90)
  --purchasePrice <price>   Optional purchase price for market
  --purchaseCount <count>   Optional purchase count for market
  --local                   Force connection to localhost (skip discovery)
  --listen                  (tv only) Record 30s debug audio locally
  --help                    Show this message
`);
  process.exit(0);
}

// ── Parse market data ────────────────────────────────────────────────
let market = null;
if (args.fromFile) {
  market = JSON.parse(fs.readFileSync(args.fromFile, "utf8"));
} else if (args.matchJSON) {
  try {
    if (args.matchJSON.trim().startsWith("{")) {
      market = JSON.parse(args.matchJSON);
    } else {
      market = JSON.parse(Buffer.from(args.matchJSON, "base64").toString());
    }
  } catch (e) {
    console.error(`Failed to parse matchJSON: ${e.message}`);
    process.exit(1);
  }
} else {
  console.error("Must provide --matchJSON or --fromFile with market data");
  process.exit(1);
}

if (args.purchasePrice !== undefined) {
  market.purchasePrice = parseFloat(args.purchasePrice);
}
if (args.purchaseCount !== undefined) {
  market.purchaseCount = parseInt(args.purchaseCount, 10);
}

// ── Session ID & Logger ──────────────────────────────────────────────
const sessionId = market.slug || args.id || new Date().getUTCSeconds().toString();

// Create the per-run logger (owns the file transport for this run)
const runLogger = baseLogger.createLogger({ runUUID, sessionId });
let logger = runLogger.child({ sessionId, runUUID });

const DATA_DIR = process.env.KALSHI_DATA_DIR || __dirname;
const LOCK_DIR = path.join(DATA_DIR, "locks");
if (!fs.existsSync(LOCK_DIR)) {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
}

const lockPath = path.join(LOCK_DIR, `${sessionId}.lock`);

try {
  // Atomic write with 'wx' flag (create and fail if exists)
  fs.writeFileSync(lockPath, process.pid.toString(), { flag: "wx" });
  logger.info(`[client] Lockfile created: ${lockPath}`);
} catch (err) {
  if (err.code === "EEXIST") {
    let existingPid;
    try {
      existingPid = fs.readFileSync(lockPath, "utf8").trim();
    } catch (readErr) {
      logger.error(`[client] Lockfile exists but could not be read: ${readErr.message}`);
      process.exit(1);
    }

    // Check if the process is actually running
    try {
      process.kill(parseInt(existingPid, 10), 0);
      // If no error, the process exists
      logger.error(
        `[client] Lockfile exists for session "${sessionId}" (PID: ${existingPid}). Another instance is running. Exiting.`,
      );
      process.exit(1);
    } catch (killErr) {
      if (killErr.code === "ESRCH") {
        logger.warn(
          `[client] Stale lockfile found for PID ${existingPid}. Overwriting...`,
        );
        fs.writeFileSync(lockPath, process.pid.toString());
        logger.info(`[client] Lockfile created (stale overwritten): ${lockPath}`);
      } else {
        logger.error(
          `[client] Lockfile exists (PID: ${existingPid}) and status check failed: ${killErr.message}`,
        );
        process.exit(1);
      }
    }
  } else {
    logger.error(`[client] Failed to create lockfile: ${err.message}`);
    process.exit(1);
  }
}

// ── Remote IP discovery ──────────────────────────────────────────────
let REMOTE_IP_ADDRESS = args.ip;

if (args.local) {
  logger.info("Local mode: forcing connection to localhost");
  REMOTE_IP_ADDRESS = "localhost";
} else if (!REMOTE_IP_ADDRESS) {
  try {
    logger.info("Discovery: Attempting to find running Kalshi worker...");
    REMOTE_IP_ADDRESS = execSync("./discover_instance.sh", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    logger.info(`Discovery: Found worker at ${REMOTE_IP_ADDRESS}`);
  } catch (e) {
    logger.warn(
      "Discovery: No running worker found via discover_instance.sh. Falling back to localhost.",
    );
    REMOTE_IP_ADDRESS = "localhost";
  }
}

const formattedIP = net.isIPv6(REMOTE_IP_ADDRESS) ? `[${REMOTE_IP_ADDRESS}]` : REMOTE_IP_ADDRESS;
const REMOTE_URL = args.server || `ws://${formattedIP}:8090`;

let STREAM_URL = args.url || market.mediaStreamURL || market.channelURL;
if (!STREAM_URL) {
  console.error(
    "No stream URL found. Use --url or include mediaStreamURL/channelURL in market data.",
  );
  process.exit(1);
}

// Auto-fix URLs missing a protocol scheme (e.g. "localhost:9981/..." → "http://localhost:9981/...")
if (STREAM_URL && !STREAM_URL.match(/^[a-zA-Z]+:\/\//)) {
  STREAM_URL = `http://${STREAM_URL}`;
  logger.warn(`Stream URL was missing protocol, fixed to: ${STREAM_URL}`);
}

market.mediaStreamURL =
  market.mediaStreamURL || market.channelURL || STREAM_URL;

// Apply custom word configurations (substitutions & custom buy amounts)
market = applyWordConfigurations(market);

// ── Auto-detect provider ─────────────────────────────────────────────
let providerName = args.provider;
if (!providerName) {
  if (STREAM_URL.includes("localhost:9981")) {
    providerName = "tv";
  } else if (STREAM_URL.includes("espn.com")) {
    providerName = "espn";
  } else if (
    (STREAM_URL.includes("youtube.com") || STREAM_URL.includes("youtu.be")) && !STREAM_URL.includes("tv.youtube.com")
  ) {
    providerName = "youtube";
  } else if (STREAM_URL.includes("tv.youtube.com")) {
    providerName = "yttv";
  } else if (STREAM_URL.includes("amazon.com")) {
    providerName = "amazon";
  } else {
    providerName = "browser";
  }
  logger.info(`Auto-detected provider: ${providerName}`);
}

let provider;
try {
  provider = require(`./providers/${providerName}`);
} catch (e) {
  console.error(`Unknown provider "${providerName}". Available: tv, browser`);
  console.error(`  Error: ${e.message}`);
  process.exit(1);
}

logger.info(`Session ID: ${sessionId}`);
logger.info(`Provider: ${provider.name}`);
logger.info(`Market: ${market.title || market.slug}`);
logger.info(`Stream: ${STREAM_URL}`);
logger.info(`Remote: ${REMOTE_URL}`);

// ── Orderbook tracking (runs locally) ────────────────────────────────
const { startOrderbookTracking } = require("./lib/orderbook_tracking");
const orderbook = startOrderbookTracking(market);
const channelDisplay = market.mediaSourceCommonName || STREAM_URL;
const msg = [
  `[client] Tracking "${market.title || market.slug}" for ${args.duration || 90} minutes`,
  `Channel: ${channelDisplay}`,
  `Source: ${STREAM_URL}`,
].join("\n");
logger.info(msg);
sendTelegram(msg).catch((err) =>
  logger.error(`[client] Failed to send Telegram: ${err.message || String(err)}`),
);

// ── State ────────────────────────────────────────────────────────────
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const TRANSCRIPT_TIMEOUT_SEC = parseInt(args.transcriptTimeout, 10) || 1800;
const TRANSCRIPT_CHECK_INTERVAL_MS = 5_000;
let isShuttingDown = false;
let ws = null;
let heartbeatInterval = null;
let transcriptCheckInterval = null;
let reconnectStartTime = null;
let lastTranscriptTime = Date.now();
let providerStarted = false;

// ── WebSocket connection with auto-reconnect ─────────────────────────
function connectWebSocket() {
  if (isShuttingDown) return;

  logger.info(`[ws] Connecting to ${REMOTE_URL}...`);
  ws = new WebSocket(REMOTE_URL);

  ws.on("open", () => {
    logger.info(`[ws] Connected to remote server`);
    reconnectStartTime = null;

    // Send handshake with market data
    const hello = { type: "hello", market, runUUID };
    if (provider.audioOnly) hello.audioOnly = true;
    if (market.clipProfile !== undefined)
      hello.clipProfile = market.clipProfile;
    ws.send(JSON.stringify(hello));

    // Update provider's ws reference
    if (provider.updateWs) provider.updateWs(ws);

    // Start heartbeat
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      }
    }, 2000);

    // Start transcript inactivity check
    if (!transcriptCheckInterval) {
      transcriptCheckInterval = setInterval(() => {
        if (!providerStarted) return;
        const elapsed = (Date.now() - lastTranscriptTime) / 1000;
        if (elapsed > TRANSCRIPT_TIMEOUT_SEC) {
          logger.warn(
            `No transcript for ${elapsed.toFixed(0)}s (timeout: ${TRANSCRIPT_TIMEOUT_SEC}s), ending stream`,
          );
          shutdown("Transcript timeout");
        }
      }, TRANSCRIPT_CHECK_INTERVAL_MS);
    }
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "signal") {
        logger.info(`SIGNAL: ${msg.keyword} → ${msg.ticker}`);
      } else if (msg.type === "transcript") {
        lastTranscriptTime = Date.now();
        logger.info(`TRANSCRIPT: ${msg.text}`);
      } else if (msg.type === "speaker_identified") {
        const topScores = Object.entries(msg.scores)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([name, score]) => `  ${name}: ${score.toFixed(4)}`)
          .join("\n");
        if (msg.entity) {
          logger.info(`SPEAKER IDENTIFIED: speaker ${msg.speaker_id} → ${msg.entity}\n${topScores}`);
        } else {
          logger.info(`SPEAKER SCORES: speaker ${msg.speaker_id} (no match above threshold)\n${topScores}`);
        }
      } else if (msg.type === "pong") {
        const rtt = Date.now() - msg.ts;
        logger.info(`RTT: ${rtt}ms`);
      } else if (msg.type === "telemetry") {
        delete msg.type;
        logger.info(`[remote] ${JSON.stringify(msg)}`);
      } else {
        delete msg.image;
        logger.debug(`[OTHER] ${JSON.stringify(msg)}`);
      }
    } catch (e) {
      logger.debug(`data error: ${e.message}`);
    }
  });

  ws.on("close", (code) => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (isShuttingDown) return;

    if (!reconnectStartTime) {
      reconnectStartTime = Date.now();
    } else if (Date.now() - reconnectStartTime > MAX_RECONNECT_DURATION_MS) {
      logger.error("[ws] Failed to reconnect after 2 minutes. Giving up.");
      shutdown("WebSocket given up reconnecting");
      return;
    }

    logger.warn(
      `[ws] Connection closed (code ${code}), reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`,
    );
    setTimeout(connectWebSocket, RECONNECT_DELAY_MS);
  });

  ws.on("error", (err) => {
    logger.error(`[ws] Error: ${err.message || String(err)}`);
  });
}

// ── Shutdown ─────────────────────────────────────────────────────────
function shutdown(reason, exitCode = 0) {
  if (isShuttingDown) return;
  logger.info(`${reason}, shutting down...`);
  isShuttingDown = true;
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (transcriptCheckInterval) clearInterval(transcriptCheckInterval);
  provider.stop();
  if (ws) ws.close();
  if (orderbook && orderbook.stop) orderbook.stop();

  if (typeof lockPath !== "undefined" && lockPath && fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
    logger.info(`[client] Lockfile removed: ${lockPath}`);
  }

  // Queue log sync for after CloudWatch ingestion
  try {
    const { logSyncQueue } = require("./lib/queues");
    logSyncQueue.add("sync-logs", { runUUID, sessionId }, { delay: 5 * 60 * 1000 }).catch(() => {});
  } catch (e) { /* best-effort */ }

  process.exit(exitCode);
}

// ── Startup ──────────────────────────────────────────────────────────
connectWebSocket();

// Small delay to let WS connect before starting the provider
setTimeout(async () => {
  try {
    // Wait for the event to start, get sport-based duration suggestion
    const waitResult = await waitIfNecessary(market, logger).catch((err) => {
      logger.error(`Error in waitIfNecessary: ${err.message}`);
      return null;
    });
    const suggestedDuration = waitResult?.suggestedDurationMinutes;

    // Use the highest available duration estimate as a safety floor
    const durationMinutes = Math.max(args.duration || 0, suggestedDuration || 0, config.durations.clientFallbackMinutes);
    const durationMs = durationMinutes * 60 * 1000;
    logger.info(`Fallback shutdown in ${durationMinutes} min${suggestedDuration ? ` (sport: ${suggestedDuration}m)` : ""}`);
    setTimeout(() => shutdown("Duration reached"), durationMs);

    await provider.start({
      ws,
      market,
      streamUrl: STREAM_URL,
      args,
      logger,
      isShuttingDown: () => isShuttingDown,
    });
    // Reset transcript timeout now that the provider is actually streaming
    providerStarted = true;
    lastTranscriptTime = Date.now();
  } catch (err) {
    // Graceful browser session endings are expected
    if (
      err.message.includes("Session closed") ||
      err.message.includes("Target closed") ||
      err.message.includes("Execution context was destroyed") ||
      err.message.includes("Protocol error") ||
      err.message.includes("Navigating frame was detached")
    ) {
      logger.info(`[${provider.name}] Session ended gracefully.`);
      return;
    }
    logger.error(`[${provider.name}] Critical error: ${err.message || String(err)}`);
    shutdown(`Critical error: ${err.message || String(err)}`, 1);
  }
}, 500);

// Watch for game end and shut down when it finishes
waitUntilEnded(market, logger)
  .then(() => shutdown("Game ended"))
  .catch((err) => logger.error(`Error in waitUntilEnded: ${err.message}`));

// ── Cleanup signals ──────────────────────────────────────────────────
process.on("SIGINT", () => shutdown("Received SIGINT"));
process.on("SIGTERM", () => shutdown("Received SIGTERM"));
