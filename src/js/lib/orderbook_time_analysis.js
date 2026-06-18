// Show the best yes bid in 100ms increments around the time a word was detected.
// Usage: bun run lib/orderbook_time_analysis.js <word> [secondsBefore] [secondsAfter]
//   e.g. bun run lib/orderbook_time_analysis.js crowd 2 5

const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.resolve(__dirname, "..", "..", "..");
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
  for (const [p, q] of JSON.parse(snapshot.yes || "[]")) yes.set(p, q);
  for (const [p, q] of JSON.parse(snapshot.no || "[]")) no.set(p, q);

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

// ── load keyword→ticker map from nba.json ───────────────────────────────────

const marketData = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "nba.json"), "utf-8"),
);
const keywords = marketData.keywords;

// ── parse server.log for detections ─────────────────────────────────────────

const logPath = path.join(DATA_DIR, "logs", "remote", "server.log");
const logLines = fs.readFileSync(logPath, "utf-8").split("\n");

const detections = [];
for (const line of logLines) {
  const match = line.match(
    /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+).*\[SIGNAL\]\s*Detected:\s*"([^"]+)"/,
  );
  if (match) {
    const timestamp = match[1];
    const word = match[2];
    const ticker = keywords[word.toLowerCase()];
    if (!ticker) continue;
    detections.push({ timestamp, word, ticker });
  }
}

// ── args ─────────────────────────────────────────────────────────────────────

const targetWord = process.argv[2];
const BEFORE_SECS = parseFloat(process.argv[3] || "2");
const AFTER_SECS = parseFloat(process.argv[4] || "5");
const STEP_MS = 100;

if (!targetWord) {
  console.error(
    "Usage: bun run lib/orderbook_time_analysis.js <word> [secBefore] [secAfter]",
  );
  console.error("Available words:", detections.map((d) => d.word).join(", "));
  process.exit(1);
}

const det = detections.find(
  (d) => d.word.toLowerCase() === targetWord.toLowerCase(),
);
if (!det) {
  console.error(`Word "${targetWord}" not found in detections.`);
  console.error("Available:", detections.map((d) => d.word).join(", "));
  process.exit(1);
}

// ── main ─────────────────────────────────────────────────────────────────────

const detectMs = new Date(det.timestamp.replace(" ", "T") + "Z").getTime();
const startMs = detectMs - BEFORE_SECS * 1000;
const endMs = detectMs + AFTER_SECS * 1000;

console.log(`## "${det.word}" — ${det.ticker}`);
console.log(`Detected at: ${det.timestamp}`);
console.log(
  `Window: -${BEFORE_SECS}s to +${AFTER_SECS}s (${STEP_MS}ms steps)\n`,
);

console.log("| Offset | Time | Best Yes Bid | Upside | Yes Qty | No Qty |");
console.log("| :--- | :--- | :--- | :--- | :--- | :--- |");

for (let ms = startMs; ms <= endMs; ms += STEP_MS) {
  const sampleISO = new Date(ms).toISOString();
  const book = bookAt(det.ticker, sampleISO);

  const bestYes = book && book.yes.size > 0 ? Math.max(...book.yes.keys()) : 0;
  const yesQty = book ? [...book.yes.values()].reduce((a, b) => a + b, 0) : 0;
  const noQty = book ? [...book.no.values()].reduce((a, b) => a + b, 0) : 0;
  const upside = bestYes > 0 ? `${100 - bestYes}¢` : "—";

  const offsetMs = ms - detectMs;
  const offsetLabel =
    offsetMs === 0
      ? "**t=0**"
      : offsetMs > 0
        ? `+${(offsetMs / 1000).toFixed(1)}s`
        : `${(offsetMs / 1000).toFixed(1)}s`;
  const timeLabel = sampleISO.slice(11, 23);

  console.log(
    `| ${offsetLabel} | ${timeLabel} | ${bestYes}¢ | ${upside} | ${yesQty.toLocaleString()} | ${noQty.toLocaleString()} |`,
  );
}

db.close();
