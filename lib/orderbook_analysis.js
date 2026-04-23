// Parse server.log for detected words and show the orderbook in the 5s before each detection.
// Uses the record.db file created by orderbook_tracking.js.

const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");
const dbPath = path.join(DATA_DIR, "logs", "record.db");
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
    [ticker, ts],
  );
  if (!snapshot) return null;

  const yes = new Map();
  const no = new Map();
  for (const [p, q] of JSON.parse(snapshot.yes || "[]")) {
    // Data is now stored as integer cents and quantities
    yes.set(p, q);
  }
  for (const [p, q] of JSON.parse(snapshot.no || "[]")) {
    // Data is now stored as integer cents and quantities
    no.set(p, q);
  }

  const deltas = query(
    `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`,
    [ticker, snapshot.ts, ts],
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

function printBook(label, book) {
  if (!book) {
    console.log(`  ${label}: no data`);
    return;
  }
  const fmtSide = (side) =>
    [...side.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([p, q]) =>
          `    ${String(p).padStart(3)}¢  ${String(q).padStart(6)} contracts`,
      )
      .join("\n");

  // Yes asks = 100 - each no bid price
  const yesAsks = new Map();
  for (const [p, q] of book.no.entries()) {
    yesAsks.set(100 - p, q);
  }
  const fmtAsks = [...yesAsks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(
      ([p, q]) =>
        `    ${String(p).padStart(3)}¢  ${String(q).padStart(6)} contracts`,
    )
    .join("\n");

  console.log(`  ── ${label} ──`);
  console.log("  YES bids:");
  console.log(fmtSide(book.yes) || "    (empty)");
  console.log("  YES asks (from NO bids):");
  console.log(fmtAsks || "    (empty)");
}

// ── load keyword→ticker map from nba.json ───────────────────────────────────

const marketData = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "oracle.json"), "utf-8"),
);
const keywords = marketData.keywords; // e.g. { "jordan": "KXNBAMENTION-26MAR03SASPHI-JORD", ... }

// ── parse client log for detections ─────────────────────────────────────────

const logPath = path.join(DATA_DIR, "app-prod.log");
const detected = new Map(); // ticker -> { word, timestamp }

if (fs.existsSync(logPath)) {
  const logLines = fs.readFileSync(logPath, "utf-8").split("\n");
  const tickerToWord = new Map();
  for (const [word, ticker] of Object.entries(keywords)) {
    tickerToWord.set(ticker, word);
  }

  for (const line of logLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.msg && entry.msg.includes("SIGNAL:")) {
        // Format: "[remote] SIGNAL: automation → KXEARNINGSMENTIONORCL-26JUN30-AUTO"
        const m = entry.msg.match(/SIGNAL:\s*(.+?)\s*→\s*(\S+)/);
        if (m) {
          const ticker = m[2];
          const word = m[1];
          if (tickerToWord.has(ticker) && !detected.has(ticker)) {
            detected.set(ticker, {
              word,
              timestamp: new Date(entry.time).toISOString(),
            });
          }
        }
      }
    } catch (e) {
      /* skip non-JSON lines */
    }
  }
}

// ── analyze all keywords ────────────────────────────────────────────────────

const now = new Date().toISOString();
const DELAY_SECS = parseFloat(process.argv[2] || "0");
const res = [];

for (const [word, ticker] of Object.entries(keywords)) {
  const det = detected.get(ticker);

  if (det) {
    // Already detected — show detection info with orderbook at that time
    const detectMs = new Date(det.timestamp).getTime();
    const targetMs = detectMs + DELAY_SECS * 1000;
    const detectISO = new Date(targetMs).toISOString();
    const bookDetect = bookAt(ticker, detectISO);

    let bestYes = 0,
      qty = 0,
      cost = "0.00",
      profit = "0.00",
      roi = "0.00";
    if (bookDetect && bookDetect.no.size > 0) {
      let totalCostCents = 0,
        totalQty = 0,
        totalProfitCents = 0;
      for (const [p, q] of bookDetect.no.entries()) {
        totalCostCents += q * (100 - p);
        totalQty += q;
        totalProfitCents += q * p;
      }
      bestYes =
        bookDetect.yes.size > 0 ? Math.max(...bookDetect.yes.keys()) : 0;
      qty = totalQty;
      cost = (totalCostCents / 100).toFixed(2);
      profit = (totalProfitCents / 100).toFixed(2);
      roi = ((totalProfitCents / totalCostCents) * 100).toFixed(2);
    }

    const d = new Date(det.timestamp);
    const localTime =
      d.toLocaleTimeString("en-US", {
        hour12: false,
        timeZone: "America/New_York",
      }) +
      "." +
      String(d.getMilliseconds()).padStart(3, "0");
    res.push({
      status: "✅ DETECTED",
      timestamp: localTime,
      word: det.word,
      ticker,
      best_yes_bid: bestYes,
      upside: 100 - bestYes,
      qty,
      cost,
      profit,
      roi_pct: roi,
    });
  } else {
    // Not yet detected — show current orderbook opportunity
    const bookNow = bookAt(ticker, now);
    if (bookNow && bookNow.no.size > 0) {
      let totalCostCents = 0,
        totalQty = 0,
        totalProfitCents = 0;
      for (const [p, q] of bookNow.no.entries()) {
        totalCostCents += q * (100 - p);
        totalQty += q;
        totalProfitCents += q * p;
      }
      const bestYes =
        bookNow.yes.size > 0 ? Math.max(...bookNow.yes.keys()) : 0;
      res.push({
        status: "⏳ pending",
        timestamp: "-",
        word,
        ticker,
        best_yes_bid: bestYes,
        upside: 100 - bestYes,
        qty: totalQty,
        cost: (totalCostCents / 100).toFixed(2),
        profit: (totalProfitCents / 100).toFixed(2),
        roi_pct: ((totalProfitCents / totalCostCents) * 100).toFixed(2),
      });
    } else {
      res.push({
        status: "❓ no book",
        timestamp: "-",
        word,
        ticker,
        best_yes_bid: 0,
        upside: 0,
        qty: 0,
        cost: "0.00",
        profit: "0.00",
        roi_pct: "0.00",
      });
    }
  }
}

// Print as Markdown Table
console.log(`### Orderbook Analysis — ${marketData.title}\n`);
console.log(
  "| Status | Detected At | Word | Best Yes Bid | Upside | Qty | Cost | Profit | ROI |",
);
console.log("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |");
let totalQty = 0,
  totalCost = 0,
  totalProfit = 0;
for (const r of res) {
  console.log(
    `| ${r.status} | ${r.timestamp} | ${r.word} | ${r.best_yes_bid}¢ | ${r.upside}¢ | ${r.qty.toLocaleString()} | $${r.cost} | $${r.profit} | ${r.roi_pct}% |`,
  );
  totalQty += r.qty;
  totalCost += parseFloat(r.cost);
  totalProfit += parseFloat(r.profit);
}
const totalRoi =
  totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(2) : "0.00";
console.log(
  `| **TOTAL** | | | | | **${totalQty.toLocaleString()}** | **$${totalCost.toFixed(2)}** | **$${totalProfit.toFixed(2)}** | **${totalRoi}%** |`,
);

db.close();
