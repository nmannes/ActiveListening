// Parse server.log for detected words and show the orderbook in the 5s before each detection.
// Uses the record.db file created by orderbook_tracking.js.

const fs = require('fs');
const path = require('path');
const { Database } = require('bun:sqlite');

const dbPath = path.join(__dirname, '..', 'logs', 'record.db');
const db = new Database(dbPath, { readonly: true });

// ── helpers ──────────────────────────────────────────────────────────────────

function query(sql, params = []) {
    return db.query(sql).all(...params);
}

function queryOne(sql, params = []) {
    return db.query(sql).get(...params);
}

/** Reconstruct the orderbook at a given ISO timestamp for a specific ticker. */
function bookAt(ticker, ts) {
    const snapshot = queryOne(
        `SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`,
        [ticker, ts]
    );
    if (!snapshot) return null;

    const yes = new Map();
    const no = new Map();
    for (const [p, q] of JSON.parse(snapshot.yes || '[]')) yes.set(p, q);
    for (const [p, q] of JSON.parse(snapshot.no || '[]')) no.set(p, q);

    const deltas = query(
        `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`,
        [ticker, snapshot.ts, ts]
    );
    for (const d of deltas) {
        const sideMap = d.side === 'yes' ? yes : no;
        const cur = sideMap.get(d.price) || 0;
        const upd = cur + d.delta;
        if (upd <= 0) sideMap.delete(d.price);
        else sideMap.set(d.price, upd);
    }
    return { yes, no };
}

function printBook(label, book) {
    if (!book) { console.log(`  ${label}: no data`); return; }
    const fmtSide = (side) =>
        [...side.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([p, q]) => `    ${String(p).padStart(3)}¢  ${String(q).padStart(6)} contracts`)
            .join('\n');

    // Yes asks = 100 - each no bid price
    const yesAsks = new Map();
    for (const [p, q] of book.no.entries()) {
        yesAsks.set(100 - p, q);
    }
    const fmtAsks = [...yesAsks.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([p, q]) => `    ${String(p).padStart(3)}¢  ${String(q).padStart(6)} contracts`)
        .join('\n');

    console.log(`  ── ${label} ──`);
    console.log('  YES bids:');
    console.log(fmtSide(book.yes) || '    (empty)');
    console.log('  YES asks (from NO bids):');
    console.log(fmtAsks || '    (empty)');
}

// ── load keyword→ticker map from nba.json ───────────────────────────────────

const marketData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'nba.json'), 'utf-8'));
const keywords = marketData.keywords;   // e.g. { "jordan": "KXNBAMENTION-26MAR03SASPHI-JORD", ... }

// ── parse server.log for detections ─────────────────────────────────────────

const logPath = path.join(__dirname, '..', 'logs', 'remote', 'server.log');
const logLines = fs.readFileSync(logPath, 'utf-8').split('\n');

const detections = [];
for (const line of logLines) {
    // Example: 2026-03-04 01:01:28.753 INFO [MainThread] [kxnbamention-26mar03sasphi][SIGNAL] Detected: "jordan"
    const match = line.match(
        /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+).*\[SIGNAL\]\s*Detected:\s*"([^"]+)"/
    );
    if (match) {
        const timestamp = match[1];
        const word = match[2];
        const ticker = keywords[word.toLowerCase()];
        if (!ticker) {
            console.warn(`  ⚠ No ticker found for "${word}", skipping`);
            continue;
        }
        detections.push({ timestamp, word, ticker });
    }
}

// ── main ────────────────────────────────────────────────────────────────────

// ── main ────────────────────────────────────────────────────────────────────

const res = [];

for (const { timestamp, word, ticker } of detections) {
    const detectMs = new Date(timestamp.replace(' ', 'T') + 'Z').getTime();
    const detectISO = new Date(detectMs).toISOString();
    const bookDetect = bookAt(ticker, detectISO);

    if (bookDetect && bookDetect.no.size > 0) {
        let totalCostCents = 0;
        let totalQty = 0;
        let totalProfitCents = 0;

        for (const [p, q] of bookDetect.no.entries()) {
            const yesAskPrice = 100 - p;
            totalCostCents += q * yesAskPrice;
            totalQty += q;
            totalProfitCents += q * p;
        }

        const bestYes = bookDetect.yes.size > 0 ? Math.max(...bookDetect.yes.keys()) : 0;
        const roi = ((totalProfitCents / totalCostCents) * 100).toFixed(2);

        res.push({
            timestamp,
            word,
            ticker,
            best_yes_bid: bestYes,
            upside: 100 - bestYes,
            qty: totalQty,
            cost: (totalCostCents / 100).toFixed(2),
            profit: (totalProfitCents / 100).toFixed(2),
            roi_pct: roi
        });
    }
}

// Print as Markdown Table
if (res.length > 0) {
    console.log('| Timestamp | Word | Ticker | Best Yes Bid | Upside | Qty | Cost | Profit | ROI |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    let totalQty = 0;
    let totalCost = 0;
    let totalProfit = 0;
    for (const r of res) {
        console.log(`| ${r.timestamp} | ${r.word} | ${r.ticker} | ${r.best_yes_bid}¢ | ${r.upside}¢ | ${r.qty.toLocaleString()} | $${r.cost} | $${r.profit} | ${r.roi_pct}% |`);
        totalQty += r.qty;
        totalCost += parseFloat(r.cost);
        totalProfit += parseFloat(r.profit);
    }
    const totalRoi = ((totalProfit / totalCost) * 100).toFixed(2);
    console.log(`| **TOTAL** | | | | | **${totalQty.toLocaleString()}** | **$${totalCost.toFixed(2)}** | **$${totalProfit.toFixed(2)}** | **${totalRoi}%** |`);
}

db.close();
