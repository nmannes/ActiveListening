// Analyze the orderbook for a given ticker in the 10 seconds preceding a timestamp.
// Uses the record.db file created by orderbook_tracking.js.


// 4 seconds behind

const sqlite3 = require('sqlite3');
const path = require('path');

const TICKER = 'KXNCAABMENTION-26FEB27MICHILL-ANKL';
const END_EPOCH_MS = 1772241557141;
const WINDOW_SECS = 10;

const endISO = new Date(END_EPOCH_MS).toISOString();                    // target time
const startISO = new Date(END_EPOCH_MS - WINDOW_SECS * 1000).toISOString(); // 10 s before

const dbPath = path.join(__dirname, '..', 'logs', 'record.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) { console.error('Failed to open DB:', err); process.exit(1); }
});

// ── helpers ──────────────────────────────────────────────────────────────────

function query(sql, params = []) {
    return new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );
}

function queryOne(sql, params = []) {
    return new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
    );
}

/** Reconstruct the orderbook at a given ISO timestamp. */
async function bookAt(ts) {
    const snapshot = await queryOne(
        `SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`,
        [TICKER, ts]
    );
    if (!snapshot) return null;

    const yes = new Map();
    const no = new Map();
    for (const [p, q] of JSON.parse(snapshot.yes || '[]')) yes.set(p, q);
    for (const [p, q] of JSON.parse(snapshot.no || '[]')) no.set(p, q);

    const deltas = await query(
        `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`,
        [TICKER, snapshot.ts, ts]
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
    if (!book) { console.log(`${label}: no data`); return; }
    const fmtSide = (side) =>
        [...side.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([p, q]) => `  ${String(p).padStart(3)}¢  ${String(q).padStart(6)} contracts`)
            .join('\n');
    console.log(`\n═══ ${label} ═══`);
    console.log('YES (bids):');
    console.log(fmtSide(book.yes) || '  (empty)');
    console.log('NO  (bids):');
    console.log(fmtSide(book.no) || '  (empty)');
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
    console.log(`Ticker : ${TICKER}`);
    console.log(`Window : ${startISO}  →  ${endISO}`);
    console.log(`         (${WINDOW_SECS}s window ending at epoch ${END_EPOCH_MS})\n`);

    // 1. Orderbook at the START of the window (t-10s)
    const bookStart = await bookAt(startISO);
    printBook(`Orderbook at t-10s  (${startISO})`, bookStart);

    // 2. Orderbook at the END of the window (target time)
    const bookEnd = await bookAt(endISO);
    printBook(`Orderbook at target (${endISO})`, bookEnd);

    // 3. All deltas within the 10-second window
    const deltas = await query(
        `SELECT ts, side, price, delta, seq FROM deltas
         WHERE ticker = ? AND ts > ? AND ts <= ?
         ORDER BY ts ASC, seq ASC`,
        [TICKER, startISO, endISO]
    );

    console.log(`\n═══ Deltas in window (${deltas.length} total) ═══`);
    if (deltas.length === 0) {
        console.log('  (no deltas in this window)');
    } else {
        for (const d of deltas) {
            const sign = d.delta > 0 ? '+' : '';
            console.log(
                `  ${d.ts}  ${d.side.padEnd(3)}  ${String(d.price).padStart(3)}¢  ${sign}${d.delta}`
            );
        }
    }

    // 4. Summary: net changes per price level
    if (deltas.length > 0) {
        const net = {};
        for (const d of deltas) {
            const key = `${d.side}:${d.price}`;
            net[key] = (net[key] || 0) + d.delta;
        }
        console.log('\n═══ Net changes across window ═══');
        for (const [key, val] of Object.entries(net).sort()) {
            const [side, price] = key.split(':');
            const sign = val > 0 ? '+' : '';
            console.log(`  ${side.padEnd(3)}  ${price.padStart(3)}¢  ${sign}${val}`);
        }
    }

    db.close();
})();

