#!/usr/bin/env bun
// fetch_resolutions.js
//
// Scans all session DBs in market_tracking/ to collect unique tickers,
// fetches resolution (yes/no) from the Kalshi API for each, and caches
// the results to cache/resolutions.json.

const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");
const MARKET_TRACKING_DIR = path.join(DATA_DIR, "market_tracking");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const RESOLUTIONS_PATH = path.join(CACHE_DIR, "resolutions.json");

const KALSHI_BASE = process.env.KALSHI_BASE_DOMAIN || "https://api.elections.kalshi.com/trade-api/v2";

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Load existing cache
function loadCache() {
  if (fs.existsSync(RESOLUTIONS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(RESOLUTIONS_PATH, "utf8"));
    } catch { }
  }
  return {};
}

// Collect all unique tickers from market_tracking DBs
function collectTickers() {
  const tickers = new Set();

  if (!fs.existsSync(MARKET_TRACKING_DIR)) {
    console.error(`market_tracking dir not found: ${MARKET_TRACKING_DIR}`);
    return tickers;
  }

  const files = fs.readdirSync(MARKET_TRACKING_DIR).filter(f => f.endsWith(".db"));
  console.log(`Scanning ${files.length} session databases...`);

  for (const file of files) {
    const dbPath = path.join(MARKET_TRACKING_DIR, file);
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db.query("SELECT DISTINCT ticker FROM snapshots").all();
      for (const row of rows) {
        if (row.ticker) tickers.add(row.ticker);
      }
      db.close();
    } catch (e) {
      console.error(`  Error reading ${file}: ${e.message}`);
    }
  }

  return tickers;
}

async function fetchMarket(ticker) {
  const url = `${KALSHI_BASE}/markets/${ticker}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`  ${ticker}: HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const market = data.market || data;
    return {
      status: market.status || "unknown",
      result: market.result || null,
      close_time: market.close_time || null,
    };
  } catch (e) {
    console.error(`  ${ticker}: ${e.message}`);
    return null;
  }
}

async function main() {
  const cache = loadCache();
  const tickers = collectTickers();
  console.log(`Found ${tickers.size} unique tickers\n`);

  let fetched = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const tickerList = [...tickers].sort();

  for (let i = 0; i < tickerList.length; i++) {
    const ticker = tickerList[i];
    const existing = cache[ticker];

    // Skip if already fetched and settled
    if (existing && existing.status === "settled") {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${tickerList.length}] ${ticker}...`);

    const result = await fetchMarket(ticker);
    if (result) {
      cache[ticker] = {
        ...existing,
        ...result,
        fetched_at: new Date().toISOString(),
      };
      fetched++;
      if (result.status === "settled") updated++;
    } else {
      errors++;
    }

    // Save periodically
    if (fetched % 10 === 0) {
      fs.writeFileSync(RESOLUTIONS_PATH, JSON.stringify(cache, null, 2));
    }

    // Rate limit: 100ms between requests
    await new Promise(r => setTimeout(r, 100));
  }

  // Final save
  fs.writeFileSync(RESOLUTIONS_PATH, JSON.stringify(cache, null, 2));

  console.log(`\nDone. Fetched: ${fetched}, Settled: ${updated}, Skipped (cached): ${skipped}, Errors: ${errors}`);
  console.log(`Cache written to ${RESOLUTIONS_PATH}`);
}

main().catch(console.error);
