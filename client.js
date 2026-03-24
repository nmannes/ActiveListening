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

const { execSync } = require("child_process");
const fs = require("fs");
const WebSocket = require("ws");
const baseLogger = require("./lib/logger");
const { applyWordConfigurations } = require("./lib/word_configurations");

// ── CLI args ─────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
  if (val.startsWith("--")) {
    const key = val.slice(2);
    const next = arr[i + 1];
    acc[key] = next && !next.startsWith("--") ? next : true;
  }
  return acc;
}, {});

// Initial logger with basic session ID if available via args
let logger = baseLogger.child({ sessionId: args.id || "startup" });

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
  --listen                  (tv only) Record 30s debug audio locally
  --help                    Show this message
`);
  process.exit(0);
}

// ── Remote IP discovery ──────────────────────────────────────────────
let REMOTE_IP_ADDRESS = args.ip;

try {
  logger.info("Discovery: Attempting to find running Kalshi worker...");
  REMOTE_IP_ADDRESS = execSync("./discover_instance.sh", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  logger.info(`Discovery: Found worker at ${REMOTE_IP_ADDRESS}`);
} catch (e) {
  logger.warn("Discovery: No running worker found via discover_instance.sh");
  REMOTE_IP_ADDRESS = null;
}

if (!REMOTE_IP_ADDRESS) {
  logger.warn("Error: Could not determine remote server IP. Using localhost");
  REMOTE_IP_ADDRESS = "127.0.0.1";
}

const REMOTE_URL = args.server || `ws://${REMOTE_IP_ADDRESS}:8090`;

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
  market.purchaseCount = parseInt(args.purchaseCount, 1);
}

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

// ── Logging ──────────────────────────────────────────────────────────
const sessionId = market.slug || args.id || new Date().getUTCSeconds();
logger = baseLogger.child({ sessionId });

logger.info(`Session ID: ${sessionId}`);
logger.info(`Provider: ${provider.name}`);
logger.info(`Market: ${market.title || market.slug}`);
logger.info(`Stream: ${STREAM_URL}`);
logger.info(`Remote: ${REMOTE_URL}`);

// ── Orderbook tracking (runs locally) ────────────────────────────────
const { startOrderbookTracking } = require("./lib/orderbook_tracking");
const orderbook = startOrderbookTracking(market);
logger.info("Orderbook tracking started locally");

// ── State ────────────────────────────────────────────────────────────
const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DURATION_MS = 2 * 60 * 1000; // 2 minutes
let isShuttingDown = false;
let ws = null;
let heartbeatInterval = null;
let reconnectStartTime = null;

// ── WebSocket connection with auto-reconnect ─────────────────────────
function connectWebSocket() {
  if (isShuttingDown) return;

  logger.info(`[ws] Connecting to ${REMOTE_URL}...`);
  ws = new WebSocket(REMOTE_URL);

  ws.on("open", () => {
    logger.info(`[ws] Connected to remote server`);
    reconnectStartTime = null;

    // Send handshake with market data
    const hello = { type: "hello", market };
    if (provider.audioOnly) hello.audioOnly = true;
    ws.send(JSON.stringify(hello));

    // Update provider's ws reference
    if (provider.updateWs) provider.updateWs(ws);

    // Start heartbeat
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      }
    }, 2000);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "signal") {
        logger.info(`SIGNAL: ${msg.keyword} → ${msg.ticker}`);
      } else if (msg.type === "transcript") {
        logger.info(`TRANSCRIPT: ${msg.text}`);
      } else if (msg.type === "pong") {
        const rtt = Date.now() - msg.ts;
        logger.info(`RTT: ${rtt}ms`);
      } else if (msg.type === "telemetry") {
        logger.info(
          `[remote] Buffer: ${msg.buffer_ms}ms | Proc: ${msg.last_proc_ms}ms`,
        );
      } else {
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
    logger.error(`[ws] Error: ${err.message}`);
  });
}

// ── Shutdown ─────────────────────────────────────────────────────────
function shutdown(reason) {
  if (isShuttingDown) return;
  logger.info(`${reason}, shutting down...`);
  isShuttingDown = true;
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  provider.stop();
  if (ws) ws.close();
  if (orderbook && orderbook.stop) orderbook.stop();
  process.exit(0);
}

// ── Startup ──────────────────────────────────────────────────────────
connectWebSocket();

// Small delay to let WS connect before starting the provider
setTimeout(async () => {
  try {
    await provider.start({
      ws,
      market,
      streamUrl: STREAM_URL,
      args,
      logger,
      isShuttingDown: () => isShuttingDown,
    });
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
    logger.error(`[${provider.name}] Critical error: ${err.message}`);
    process.exit(1);
  }
}, 500);

// Duration-based auto-shutdown
const durationMinutes = args.duration || 90;
const durationMs = parseInt(durationMinutes, 10) * 60 * 1000;
if (!isNaN(durationMs)) {
  logger.info(`Shutdown scheduled in ${durationMinutes} minutes`);
  setTimeout(() => shutdown("Duration reached"), durationMs);
}

// ── Cleanup signals ──────────────────────────────────────────────────
process.on("SIGINT", () => shutdown("Received SIGINT"));
process.on("SIGTERM", () => shutdown("Received SIGTERM"));
