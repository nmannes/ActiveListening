const WebSocket = require('ws');
const sqlite3 = require('sqlite3');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { KalshiAuth } = require('kalshi-typescript/dist/auth');
const { KALSHI_ENV } = require('./args');

const WS_URL = KALSHI_ENV === 'prod'
    ? 'wss://api.elections.kalshi.com/trade-api/ws/v2'
    : 'wss://demo-api.kalshi.co/trade-api/ws/v2';

const PING_INTERVAL_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

/**
 * Start tracking orderbooks for all tickers in a market.
 *
 * Connects to the Kalshi WebSocket, subscribes to orderbook_delta for every
 * ticker in market.keywords, and persists every snapshot & delta to a SQLite
 * database so the orderbook can be reconstructed at any past timestamp.
 *
 * @param {object} market - The market object (must have .keywords and .slug)
 * @returns {{ db, stop }} - db handle for queries; stop() to tear down
 */
function startOrderbookTracking(market) {
    const tickers = Object.values(market.keywords);

    if (tickers.length === 0) {
        logger.warn('[orderbook] No tickers found in market.keywords — nothing to track');
        return { db: null, stop: () => { } };
    }

    // ── SQLite setup ──────────────────────────────────────────────────
    const dbDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, `record.db`);
    const db = new sqlite3.Database(dbPath);

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

    const insertSnapshot = db.prepare(
        `INSERT INTO snapshots (ticker, ts, yes, no, seq) VALUES (?, ?, ?, ?, ?)`
    );
    const insertDelta = db.prepare(
        `INSERT INTO deltas (ticker, ts, side, price, delta, seq) VALUES (?, ?, ?, ?, ?, ?)`
    );

    // ── In-memory live orderbooks (ticker → { yes: Map<price,qty>, no: Map<price,qty> }) ──
    const books = new Map();

    // ── Auth ───────────────────────────────────────────────────────────
    const privateKey = fs.readFileSync(process.env.KALSHI_PRIVATE_KEY_PATH, 'utf8');
    const auth = new KalshiAuth(process.env.KALSHI_KEY_ID, privateKey);

    // ── WebSocket lifecycle ───────────────────────────────────────────
    let ws = null;
    let pingTimer = null;
    let stopped = false;
    let cmdId = 1;

    function connect() {
        if (stopped) return;

        const headers = auth.generateAuthHeaders('GET', '/trade-api/ws/v2');
        ws = new WebSocket(WS_URL, { headers });

        ws.on('open', () => {
            logger.info(`[orderbook] WebSocket connected — subscribing to ${tickers.length} tickers`);

            ws.send(JSON.stringify({
                id: cmdId++,
                cmd: 'subscribe',
                params: {
                    channels: ['orderbook_delta'],
                    market_tickers: tickers,
                },
            }));

            // Keep-alive pings
            pingTimer = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }, PING_INTERVAL_MS);
        });

        ws.on('message', (raw) => {
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                return;
            }

            if (data.type === 'orderbook_snapshot') {
                handleSnapshot(data);
            } else if (data.type === 'orderbook_delta') {
                handleDelta(data);
            } else if (data.type === 'error') {
                logger.error({ msg: data.msg }, '[orderbook] WS error');
            }
        });

        ws.on('close', (code) => {
            clearInterval(pingTimer);
            if (stopped) return;
            logger.warn(`[orderbook] WebSocket closed (code ${code}), reconnecting in ${RECONNECT_DELAY_MS / 1000}s...`);
            setTimeout(connect, RECONNECT_DELAY_MS);
        });

        ws.on('error', (err) => {
            logger.error({ err }, '[orderbook] WebSocket error');
        });
    }

    // ── Handlers ──────────────────────────────────────────────────────

    function handleSnapshot(data) {
        const { market_ticker, yes, no } = data.msg;
        const seq = data.seq;
        const ts = new Date().toISOString();

        // Persist
        insertSnapshot.run(market_ticker, ts, JSON.stringify(yes), JSON.stringify(no), seq);

        // Build in-memory book
        const yesMap = new Map();
        const noMap = new Map();
        if (yes) for (const [price, qty] of yes) yesMap.set(price, qty);
        if (no) for (const [price, qty] of no) noMap.set(price, qty);
        books.set(market_ticker, { yes: yesMap, no: noMap });

        logger.info(`[orderbook] Snapshot for ${market_ticker}: ${yesMap.size} yes levels, ${noMap.size} no levels`);
    }

    function handleDelta(data) {
        // console.dir(data.msg, { depth: null }); // Optional: uncomment if debugging payload
        const { market_ticker, side, ts } = data.msg;
        let { price, delta } = data.msg;
        const seq = data.seq;
        const deltaTs = ts || new Date().toISOString();

        // Handle Kalshi V2 WebSocket payload differences (e.g. price_dollars instead of price)
        if (price == null && data.msg.price_dollars != null) {
            price = Math.round(parseFloat(data.msg.price_dollars) * 100);
        }
        if (delta == null && data.msg.delta_fp != null) {
            delta = Math.round(parseFloat(data.msg.delta_fp));
        }

        if (price == null || delta == null) {
            logger.warn({ msg: data.msg }, '[orderbook] Received delta without unparseable price or delta');
            return;
        }

        // Persist
        insertDelta.run(market_ticker, deltaTs, side, price, delta, seq, (err) => {
            if (err) {
                logger.error({ msg: data.msg, error: err.message }, '[orderbook] Error persisting delta');
            }
        });

        // Update in-memory book
        const book = books.get(market_ticker);
        if (!book) return; // haven't received snapshot yet

        const sideMap = side === 'yes' ? book.yes : book.no;
        const current = sideMap.get(price) || 0;
        const updated = current + delta;
        if (updated <= 0) {
            sideMap.delete(price);
        } else {
            sideMap.set(price, updated);
        }
    }

    // ── Public helpers ────────────────────────────────────────────────

    /**
     * Get the current live orderbook for a ticker.
     */
    function getLiveBook(ticker) {
        const book = books.get(ticker);
        if (!book) return null;

        const sortedYes = [...book.yes.entries()].sort((a, b) => a[0] - b[0]);
        const sortedNo = [...book.no.entries()].sort((a, b) => a[0] - b[0]);
        return { yes: sortedYes, no: sortedNo };
    }

    /**
     * Reconstruct the orderbook for a ticker at a given timestamp by replaying
     * the most recent snapshot before that time, then applying all deltas up to
     * that time.
     *
     * @param {string} ticker
     * @param {string} asOfISO - ISO-8601 timestamp
     * @returns {Promise<{yes: Array, no: Array}|null>}
     */
    function getBookAt(ticker, asOfISO) {
        return new Promise((resolve, reject) => {
            // 1. Find the latest snapshot at or before asOfISO
            db.get(
                `SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`,
                [ticker, asOfISO],
                (err, snapshot) => {
                    if (err) return reject(err);
                    if (!snapshot) return resolve(null);

                    const yes = new Map();
                    const no = new Map();

                    for (const [p, q] of JSON.parse(snapshot.yes || '[]')) yes.set(p, q);
                    for (const [p, q] of JSON.parse(snapshot.no || '[]')) no.set(p, q);

                    // 2. Apply deltas between snapshot time and asOfISO
                    db.all(
                        `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`,
                        [ticker, snapshot.ts, asOfISO],
                        (err2, deltas) => {
                            if (err2) return reject(err2);

                            for (const d of deltas) {
                                const sideMap = d.side === 'yes' ? yes : no;
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
                        }
                    );
                }
            );
        });
    }

    function stop() {
        stopped = true;
        clearInterval(pingTimer);
        if (ws) ws.close();
        insertSnapshot.finalize();
        insertDelta.finalize();
        db.close();
        logger.info('[orderbook] Stopped tracking');
    }

    // ── Start ─────────────────────────────────────────────────────────
    connect();

    return { db, books, getLiveBook, getBookAt, stop };
}

module.exports = { startOrderbookTracking };
