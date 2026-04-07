const { Database } = require("bun:sqlite");
const fs = require("fs");
const path = require("path");

const HITS_FILE = "hits.json";
const TRACKING_DIR = "market_tracking";

if (!fs.existsSync(HITS_FILE)) {
  console.error(`Hits file not found: ${HITS_FILE}`);
  process.exit(1);
}

const hits = JSON.parse(fs.readFileSync(HITS_FILE, "utf-8"));

function getBookAt(db, ticker, ts) {
  const snapshot = db.query(
    `SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`
  ).get(ticker, ts);

  if (!snapshot) return null;

  const yes = new Map();
  const no = new Map();
  try {
    const yesData = JSON.parse(snapshot.yes || "[]");
    const noData = JSON.parse(snapshot.no || "[]");
    for (const [p, q] of yesData) yes.set(p, q);
    for (const [p, q] of noData) no.set(p, q);
  } catch (e) {}

  const deltas = db.query(
    `SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC`
  ).all(ticker, snapshot.ts, ts);

  for (const d of deltas) {
    const sideMap = d.side === "yes" ? yes : no;
    const cur = sideMap.get(d.price) || 0;
    const upd = cur + d.delta;
    if (upd <= 0) sideMap.delete(d.price);
    else sideMap.set(d.price, upd);
  }
  return { yes, no };
}

function getPotentialProfit(book) {
  if (!book || !book.no || book.no.size === 0) return 0;
  let totalProfitCents = 0;
  for (const [price, qty] of book.no) {
    totalProfitCents += price * qty;
  }
  return totalProfitCents / 100;
}

const offsets = [-100, -90, -80, -70, -60, -50, -40, -30, -20, -10, 0, 10, 30, 60, 90, 120];

const headerRow = [
  "Market Ticker", "Timestamp", "Keyword", 
  ...offsets.map(o => (o === 0 ? "T" : (o > 0 ? `T+${o}s` : `T${o}s`))), 
  "Profit Change (100s)"
];
console.log(`| ${headerRow.join(" | ")} |`);
console.log(`| ${headerRow.map(() => "---").join(" | ")} |`);

const processedHits = new Set();
const seenKeywords = new Set();

// Map keywords to expected ticker suffixes
const keywordMap = {
  "election": "ELEC",
  "jordan": "JORD",
  "transfer": "TRAN",
  "transferred": "TRAN",
  "ai": "AI",
  "prison": "PRIS",
  "playoff": "PLAY",
  "playoffs": "PLAY",
  "corruption": "CORR",
  "state farm": "STAT",
  "rescue": "RESC",
  "rescued": "RESC",
  "hormuz": "HORM",
  "china": "CHIN",
  "russia": "RUSS",
  "ankle": "ANKL",
  "all american": "ALLA",
  "mvp": "MVP",
  "crowd": "CROW",
  "draft pick": "DRAF",
  "elbow": "ELBO",
  "traded": "TRAD",
  "injury": "INJU",
  "fake news": "FAKE",
  "deal": "DEAL",
  "nuclear": "NUCL",
  "oil": "OIL",
  "gas": "GAS",
  "f 15": "F15",
  "trump": "TRUM",
  "khamenei": "KHAM",
  "hegseth": "HEGS",
  "epic fury": "EPIC",
  "venezuela": "VENE",
  "midnight hammer": "MIDN",
  "ground": "GROU"
};

for (const hit of hits) {
  const msg = hit["@message"];
  const match = msg.match(/\[([a-z0-9-]+)\]\[SIGNAL\] Detected for speaker \d+: "(.*?)"/);
  
  if (!match) continue;

  const marketId = match[1];
  const keyword = match[2];

  if (seenKeywords.has(keyword.toLowerCase())) continue;

  const detectionTsStr = msg.substring(0, 23);
  const detectionDate = new Date(detectionTsStr.replace(" ", "T") + "Z");
  if (isNaN(detectionDate.getTime())) continue;
  const detectionMs = detectionDate.getTime();

  const hitKey = `${marketId}-${detectionMs}-${keyword}`;
  if (processedHits.has(hitKey)) continue;
  processedHits.add(hitKey);

  const dbPath = path.join(TRACKING_DIR, `${marketId}.db`);
  if (!fs.existsSync(dbPath)) continue;

  const db = new Database(dbPath, { readonly: true });
  const tickers = db.query("SELECT DISTINCT ticker FROM snapshots").all().map(r => r.ticker);
  
  const suffix = keywordMap[keyword.toLowerCase()];
  
  for (const ticker of tickers) {
    if (suffix && !ticker.endsWith(suffix)) continue;
    if (!suffix && !ticker.includes(keyword.toUpperCase().substring(0, 4))) continue;

    const profits = [];
    let hasSomeProfit = false;
    for (const offset of offsets) {
      const ts = new Date(detectionMs + offset * 1000).toISOString();
      const book = getBookAt(db, ticker, ts);
      const profit = getPotentialProfit(book);
      profits.push(`$${profit.toFixed(2)}`);
      if (profit > 0) hasSomeProfit = true;
    }

    const tMinus100Profit = parseFloat(profits[0].substring(1));
    const t0Profit = parseFloat(profits[offsets.indexOf(0)].substring(1));
    const profitChange = t0Profit - tMinus100Profit;
    const profitChangeStr = profitChange >= 0 ? `+$${profitChange.toFixed(2)}` : `-$${Math.abs(profitChange).toFixed(2)}`;

    if (hasSomeProfit) {
      console.log(`| ${ticker} | ${detectionTsStr} | ${keyword} | ${profits.join(" | ")} | ${profitChangeStr} |`);
      seenKeywords.add(keyword.toLowerCase());
    }
  }
  db.close();
}
