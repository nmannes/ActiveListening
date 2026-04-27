const WebSocket = require("ws");
const sqlite3 = require("sqlite3");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { KalshiAuth } = require("kalshi-typescript/dist/auth");
const { KALSHI_ENV } = require("./args");
const { json } = require("stream/consumers");

const WS_URL =
  KALSHI_ENV === "prod"
    ? "wss://api.elections.kalshi.com/trade-api/ws/v2"
    : "wss://demo-api.kalshi.co/trade-api/ws/v2";

const PING_INTERVAL_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

/**
 * Start tracking orderbooks for all tickers in multiple markets.
 *
 * Connects to the Kalshi WebSocket, subscribes to orderbook_delta for every
 * ticker in all markets, and persists every snapshot & delta to a separate
 * SQLite database for each market.
 *
 * @param {Array<object>} markets - List of market objects
 * @returns {{ stops, getLiveBook, getBookAt, stopAll }}
 */
function startOrderbookTracking(markets) {
  const marketList = Array.isArray(markets) ? markets : [markets];
  const allTickers = [];
  const tickerToMarkets = new Map(); // ticker -> [marketSlug]
  const marketContexts = new Map(); // marketSlug -> { db, insertSnapshot, insertDelta, books }

  for (const market of marketList) {
    const tickers = Object.values(market.keywords);
    if (tickers.length === 0) continue;

    allTickers.push(...tickers);
    for (const t of tickers) {
      const list = tickerToMarkets.get(t) || [];
      list.push(market.slug);
      tickerToMarkets.set(t, list);
    }

    // ── SQLite setup ──────────────────────────────────────────────────
    const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");
    const dbDir = path.join(DATA_DIR, "market_tracking");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, `${market.slug}.db`);
    const db = new sqlite3.Database(dbPath);

    db.configure("busyTimeout", 30000);
    db.run("PRAGMA journal_mode = WAL;");

    db.serialize(() => {
      db.run(`
                CREATE TABLE IF NOT EXISTS snapshots (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker      TEXT    NOT NULL,
                    ts          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                    yes         TEXT,
                    no          TEXT,
                    seq         INTEGER
                )
            `);
      db.run(`
                CREATE TABLE IF NOT EXISTS deltas (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker      TEXT    NOT NULL,
                    ts          TEXT    NOT NULL,
                    side        TEXT    NOT NULL,
                    price       INTEGER NOT NULL,
                    delta       INTEGER NOT NULL,
                    seq         INTEGER
                )
            `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_ticker_ts ON snapshots(ticker, ts)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_deltas_ticker_ts    ON deltas(ticker, ts)`);
    });

    marketContexts.set(market.slug, {
      db,
      insertSnapshot: db.prepare(`INSERT INTO snapshots (ticker, ts, yes, no, seq) VALUES (?, ?, ?, ?, ?)`),
      insertDelta: db.prepare(`INSERT INTO deltas (ticker, ts, side, price, delta, seq) VALUES (?, ?, ?, ?, ?, ?)`),
      books: new Map(), // ticker -> { yes: Map, no: Map }
    });
  }

  if (allTickers.length === 0) {
    logger.warn("[orderbook] No tickers found in markets — nothing to track");
    return { stopAll: () => {} };
  }

  // ── Auth ───────────────────────────────────────────────────────────
  const privateKey = fs.readFileSync(
    process.env.KALSHI_PRIVATE_KEY_PATH,
    "utf8",
  );
  const auth = new KalshiAuth(process.env.KALSHI_KEY_ID, privateKey);

  // ── WebSocket lifecycle ───────────────────────────────────────────
  let ws = null;
  let pingTimer = null;
  let stopped = false;
  let cmdId = 1;

  function connect() {
    if (stopped) return;

    const headers = auth.generateAuthHeaders("GET", "/trade-api/ws/v2");
    ws = new WebSocket(WS_URL, { headers });

    ws.on("open", () => {
      logger.info(
        `[orderbook] WebSocket connected — subscribing to ${allTickers.length} tickers across ${marketContexts.size} markets`,
      );

      ws.send(
        JSON.stringify({
          id: cmdId++,
          cmd: "subscribe",
          params: {
            channels: ["orderbook_delta"],
            market_tickers: allTickers,
          },
        }),
      );

      // Keep-alive pings
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, PING_INTERVAL_MS);
    });

    ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }

      if (data.type === "orderbook_snapshot") {
        handleSnapshot(data);
      } else if (data.type === "orderbook_delta") {
        handleDelta(data);
      } else if (data.type === "error") {
        logger.error({ msg: data.msg }, "[orderbook] Kalshi WS error");
      }
    });

    ws.on("close", (code) => {
      clearInterval(pingTimer);
      if (stopped) return;
      logger.warn(
        `[orderbook] WebSocket closed (code ${code}), reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`,
      );
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    ws.on("error", (err) => {
      logger.error({ err }, "[orderbook] WebSocket error");
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────

  function handleSnapshot(data) {
    const { market_ticker, yes_dollars_fp, no_dollars_fp } = data.msg;
    const seq = data.seq;
    const ts = new Date().toISOString();

    const yesLevels = yes_dollars_fp
      ? yes_dollars_fp.map(([priceStr, qtyStr]) => [Math.round(parseFloat(priceStr) * 100), parseInt(qtyStr)])
      : [];
    const noLevels = no_dollars_fp
      ? no_dollars_fp.map(([priceStr, qtyStr]) => [Math.round(parseFloat(priceStr) * 100), parseInt(qtyStr)])
      : [];

    const slugs = tickerToMarkets.get(market_ticker) || [];
    for (const slug of slugs) {
      const ctx = marketContexts.get(slug);
      if (!ctx) continue;

      ctx.insertSnapshot.run(market_ticker, ts, JSON.stringify(yesLevels), JSON.stringify(noLevels), seq);

      const yesMap = new Map();
      const noMap = new Map();
      for (const [price, qty] of yesLevels) yesMap.set(price, qty);
      for (const [price, qty] of noLevels) noMap.set(price, qty);
      ctx.books.set(market_ticker, { yes: yesMap, no: noMap });

      logger.info(`[orderbook][${slug}] Snapshot for ${market_ticker}: ${yesMap.size} yes levels, ${noMap.size} no levels`);
    }
  }

  function handleDelta(data) {
    const { market_ticker, side, ts } = data.msg;
    let { price, delta } = data.msg;
    const seq = data.seq;
    const deltaTs = ts || new Date().toISOString();

    if (price == null && data.msg.price_dollars != null) {
      price = Math.round(parseFloat(data.msg.price_dollars) * 100);
    }
    if (delta == null && data.msg.delta_fp != null) {
      delta = Math.round(parseFloat(data.msg.delta_fp));
    }

    if (price == null || delta == null) return;

    const slugs = tickerToMarkets.get(market_ticker) || [];
    for (const slug of slugs) {
      const ctx = marketContexts.get(slug);
      if (!ctx) continue;

      ctx.insertDelta.run(market_ticker, deltaTs, side, price, delta, seq, (err) => {
        if (err) logger.error({ slug, ticker: market_ticker, error: err.message }, "[orderbook] Error persisting delta");
      });

      const book = ctx.books.get(market_ticker);
      if (!book) continue;

      const sideMap = side === "yes" ? book.yes : book.no;
      const current = sideMap.get(price) || 0;
      const updated = current + delta;
      if (updated <= 0) {
        sideMap.delete(price);
      } else {
        sideMap.set(price, updated);
      }
    }
  }

  // ── Public helpers ────────────────────────────────────────────────

  /**
   * Get the current live orderbook for a ticker in a specific market.
   */
  function getLiveBook(slug, ticker) {
    const ctx = marketContexts.get(slug);
    if (!ctx) return null;
    const book = ctx.books.get(ticker);
    if (!book) return null;

    const sortedYes = [...book.yes.entries()].sort((a, b) => a[0] - b[0]);
    const sortedNo = [...book.no.entries()].sort((a, b) => a[0] - b[0]);
    return { yes: sortedYes, no: sortedNo };
  }

  /**
   * Reconstruct the orderbook for a ticker in a specific market at a given timestamp.
   *
   * @param {string} slug
   * @param {string} ticker
   * @param {string} asOfISO - ISO-8601 timestamp
   * @returns {Promise<{yes: Array, no: Array}|null>}
   */
  function getBookAt(slug, ticker, asOfISO) {
    const ctx = marketContexts.get(slug);
    if (!ctx) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      ctx.db.get(
        `SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`,
        [ticker, asOfISO],
        (err, snapshot) => {
          if (err) return reject(err);
          if (!snapshot) return resolve(null);

          const yes = new Map();
          const no = new Map();

          for (const [p, q] of JSON.parse(snapshot.yes || "[]")) yes.set(p, q);
          for (const [p, q] of JSON.parse(snapshot.no || "[]")) no.set(p, q);

          ctx.db.all(
            `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`,
            [ticker, snapshot.ts, asOfISO],
            (err2, deltas) => {
              if (err2) return reject(err2);

              for (const d of deltas) {
                const sideMap = d.side === "yes" ? yes : no;
                const current = sideMap.get(d.price) || 0;
                const updated = current + d.delta;
                if (updated <= 0) {
                  sideMap.delete(d.price);
                } else {
                  sideMap.set(d.price, updated);
                }
              }

              resolve({
                yes: [...yes.entries()].sort((a, b) => a[0] - b[0]),
                no: [...no.entries()].sort((a, b) => a[0] - b[0]),
              });
            },
          );
        },
      );
    });
  }

  function stopAll() {
    stopped = true;
    clearInterval(pingTimer);
    if (ws) ws.close();
    for (const ctx of marketContexts.values()) {
      ctx.insertSnapshot.finalize();
      ctx.insertDelta.finalize();
      ctx.db.close();
    }
    logger.info(`[orderbook] Stopped tracking ${marketContexts.size} markets`);
  }

  // ── Start ─────────────────────────────────────────────────────────
  connect();

  return { tickerToMarkets, marketContexts, getLiveBook, getBookAt, stopAll };
}

module.exports = { startOrderbookTracking };

if (require.main === module) {
  // Run as script (Example updated for multiple markets)
  const marketPath = "/home/nathan/kalshi/scheduled/kxncaabmention-26mar13isuariz.json";
  if (fs.existsSync(marketPath)) {
    const market = JSON.parse(fs.readFileSync(marketPath, "utf8"));
    const tracker = startOrderbookTracking([market]);
    console.log(`Orderbook tracking started for ${market.slug}`);
    // Close after 10s for demo
    setTimeout(() => tracker.stopAll(), 10000);
  } else {
    console.log("Mock market file not found for script run");
  }
}
