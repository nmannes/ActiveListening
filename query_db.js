const { Database } = require("bun:sqlite");
const fs = require("fs");

const dbPath = "market_tracking/kxmentionearnfdx-26mar19.db";
if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
}
const db = new Database(dbPath, { readonly: true });

function query(sql, params = []) {
  return db.query(sql).all(...params);
}

function queryOne(sql, params = []) {
  return db.query(sql).get(...params);
}

function bookAt(ticker, ts) {
  const snapshot = queryOne(
    `SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`,
    [ticker, ts]
  );
  if (!snapshot) return null;

  const yes = new Map();
  const no = new Map();
  try {
    for (const [p, q] of JSON.parse(snapshot.yes || "[]")) yes.set(p, q);
    for (const [p, q] of JSON.parse(snapshot.no || "[]")) no.set(p, q);
  } catch(e) {}

  const deltas = query(
    `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`,
    [ticker, snapshot.ts, ts]
  );
  for (const d of deltas) {
    const sideMap = d.side === "yes" ? yes : no;
    const cur = sideMap.get(d.price) || 0;
    const upd = cur + d.delta;
    if (upd <= 0) sideMap.delete(d.price);
    else sideMap.set(d.price, upd);
  }
  return { yes, no };
}

function printMaxYes(ticker, detectMs) {
    console.log(`\n=== Timeline for ${ticker} ===`);
    console.log(`Detection time: ${new Date(detectMs).toISOString()}`);
    // Check from -2s to +15s in 1s intervals
    for (let offset = -2; offset <= 15; offset++) {
        const ms = detectMs + offset * 1000;
        const iso = new Date(ms).toISOString();
        const book = bookAt(ticker, iso);
        let bestYes = 0;
        if (book && book.yes.size > 0) {
            bestYes = Math.max(...book.yes.keys());
        }
        console.log(`[${offset > 0 ? '+' : ''}${offset}s] ${iso} : Max Yes = ${bestYes}¢`);
    }
}

// dividend detected: 1773957736304
printMaxYes("KXMENTIONEARNFDX-26MAR19-DIVI", 1773957736304);

// inventory detected: 1773956534209
printMaxYes("KXMENTIONEARNFDX-26MAR19-INVE", 1773956534209);
