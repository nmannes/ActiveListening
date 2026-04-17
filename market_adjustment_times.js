// Finds the first timestamp when the no-side order book empties for each word/ticker.
// This represents when the market has fully adjusted to detecting that a word is said.
//
// Usage: bun market_adjustment_times.js <path-to-db-file>

const { Database } = require("bun:sqlite");
const path = require("path");

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Usage: bun market_adjustment_times.js <path-to-db-file>");
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Get all tickers
const tickers = db
  .query("SELECT DISTINCT ticker FROM snapshots ORDER BY ticker")
  .all()
  .map((r) => r.ticker);

const results = [];

for (const ticker of tickers) {
  // Extract the word suffix from the ticker (last segment after the final dash)
  const word = ticker.split("-").pop();

  // Load the initial snapshot
  const snapshot = db
    .query("SELECT * FROM snapshots WHERE ticker = ? ORDER BY ts ASC LIMIT 1")
    .get(ticker);

  if (!snapshot) continue;

  // Build the initial no-side order book
  const noBook = new Map();
  try {
    const noData = JSON.parse(snapshot.no || "[]");
    for (const [p, q] of noData) noBook.set(p, q);
  } catch (e) {}

  // If the no side is already empty at the start, record the snapshot time
  if (noBook.size === 0) {
    results.push({ ticker, word, adjustmentTime: snapshot.ts, note: "empty at start" });
    continue;
  }

  // Walk through all no-side deltas chronologically
  const deltas = db
    .query(
      "SELECT * FROM deltas WHERE ticker = ? AND side = 'no' ORDER BY seq ASC, ts ASC"
    )
    .all(ticker);

  let adjustmentTime = null;

  for (const d of deltas) {
    const cur = noBook.get(d.price) || 0;
    const upd = cur + d.delta;
    if (upd <= 0) noBook.delete(d.price);
    else noBook.set(d.price, upd);

    if (noBook.size === 0) {
      adjustmentTime = d.ts;
      break;
    }
  }

  results.push({ ticker, word, adjustmentTime });
}

// Sort by adjustment time (nulls at bottom)
results.sort((a, b) => {
  if (!a.adjustmentTime && !b.adjustmentTime) return 0;
  if (!a.adjustmentTime) return 1;
  if (!b.adjustmentTime) return -1;
  return a.adjustmentTime.localeCompare(b.adjustmentTime);
});

// Print results as a table
console.log(`\nMarket Adjustment Times — ${path.basename(dbPath)}\n`);
console.log("| Word | Adjustment Time (UTC) | Ticker |");
console.log("| :--- | :--- | :--- |");

for (const r of results) {
  const ts = r.adjustmentTime || "never (no side never emptied)";
  const note = r.note ? ` (${r.note})` : "";
  console.log(`| ${r.word} | ${ts}${note} | ${r.ticker} |`);
}

db.close();
