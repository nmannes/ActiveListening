#!/usr/bin/env bun
// signal_vs_no_closeout.js
//
// Parses signals.log, fuzzy-matches each signal word to a market ticker
// in the corresponding session DB, then finds when the NO side closed out
// (i.e. YES hit 99 / NO hit 1 → word WAS mentioned, YES wins).
// Reports the delta between signal detection and NO closeout.

const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");

const DATA_DIR = process.env.KALSHI_DATA_DIR || __dirname;
const MARKET_TRACKING_DIR = path.join(DATA_DIR, "market_tracking");
const SCHEDULE_LOG = path.join(DATA_DIR, "schedule_run.log");

const LOG_FILES = [
  path.join(DATA_DIR, "signals.log"),
  path.join(DATA_DIR, "app-prod.log")
];
const CACHE_DIR = path.join(DATA_DIR, "cache");
const CACHE_FILES = [
  path.join(CACHE_DIR, "matched_markets.json"),
  path.join(CACHE_DIR, "unmatched_markets.json"),
  path.join(CACHE_DIR, "manual_matches.json")
];

// ── strip ANSI escape codes ─────────────────────────────────────────────────
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── parse log files ─────────────────────────────────────────────────────────
function parseLogFiles() {
  const signals = [];
  
  for (const logFile of LOG_FILES) {
    if (!fs.existsSync(logFile)) continue;
    
    const rawContent = fs.readFileSync(logFile, "utf-8");
    const lines = rawContent.split("\n");
    
    for (const line of lines) {
      if (!line.trim()) continue;

      // Try JSON (Pino)
      if (line.trim().startsWith("{")) {
        try {
          const j = JSON.parse(line);
          if (j.msg && j.msg.includes("SIGNAL: ")) {
            const signalPart = j.msg.split("SIGNAL: ")[1];
            const parts = signalPart.split(" → ");
            const word = parts[0].trim().toLowerCase();
            const target = parts[1] ? parts[1].trim() : "undefined";
            
            const date = new Date(j.time);
            const timestamp = date.toISOString().replace("T", " ").replace("Z", "").slice(0, 23);
            
            signals.push({
              timestamp,
              tz: "+0000", // JSON logs are already in UTC
              session: (j.sessionId || "unknown").toLowerCase(),
              word,
              target,
              speaker: "?"
            });
          }
          continue;
        } catch (e) {}
      }

      const content = stripAnsi(line);
      
      const re1 = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) ([+-]\d{4})\].*?\[(\S+?)\] SIGNAL:\s+(.+?)\s+→\s+(\S+)/;
      const m1 = content.match(re1);
      if (m1) {
        signals.push({
          timestamp: m1[1],
          tz: m1[2],
          session: m1[3].toLowerCase().replace(/[\[\]]/g, ""),
          word: m1[4].trim().toLowerCase(),
          target: m1[5].trim(),
          speaker: "?"
        });
        continue;
      }

      const re2 = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s*(?:[+-]\d{4})?\s*\]\s*\[(\S+?)\]\[SIGNAL\] Detected for speaker (\d+): "(.*?)"/;
      const m2 = content.match(re2);
      if (m2) {
        signals.push({
          timestamp: m2[1],
          tz: "+0000", // Log timestamps in this format are already in UTC (usually from server.py)
          session: m2[2].toLowerCase().replace(/[\[\]]/g, ""),
          speaker: m2[3],
          word: m2[4].trim().toLowerCase(),
          target: "undefined"
        });
        continue;
      }
    }
  }
  
  return signals;
}

// ── load market titles ──────────────────────────────────────────────────────
function loadMarketTitles() {
  const slugToTitle = new Map();
  for (const file of CACHE_FILES) {
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      for (const entry of data) {
        const market = entry.market || entry;
        if (market.slug && market.title) {
          slugToTitle.set(market.slug.toLowerCase(), market.title);
        }
      }
    } catch (e) {
      console.error(`Error loading cache file ${file}: ${e.message}`);
    }
  }
  return slugToTitle;
}

// ── fuzzy match a keyword to a ticker suffix ────────────────────────────────
// Ticker suffixes are typically 4 uppercase chars from the beginning of the keyword.
// e.g. "crowd" → "CROW", "injury" → "INJU", "triple double" → "TRIP"
function fuzzyMatchTicker(keyword, tickers) {
  const kw = keyword.toUpperCase().replace(/[^A-Z]/g, "");
  
  // Strategy 1: exact suffix match on first 4 chars
  const prefix4 = kw.slice(0, 4);
  for (const t of tickers) {
    const suffix = t.split("-").pop();
    if (suffix === prefix4) return t;
  }

  // Strategy 2: first 3 chars
  const prefix3 = kw.slice(0, 3);
  for (const t of tickers) {
    const suffix = t.split("-").pop();
    if (suffix === prefix3) return t;
  }

  // Strategy 3: suffix starts with prefix or prefix starts with suffix
  for (const t of tickers) {
    const suffix = t.split("-").pop();
    if (suffix.length >= 3 && kw.startsWith(suffix)) return t;
    if (kw.length >= 3 && suffix.startsWith(kw.slice(0, Math.min(4, kw.length)))) return t;
  }

  // Strategy 4: special cases
  const specialMap = {
    "ARTIFICIALINTELLIGENCE": "AI",
    "MVP": "MVP",
    "AI": "AI",
    "FDA": "FDA",
    "TSA": "TSA",
    "ICE": "ICE",
    "EV": "EV",
    "NIO": "NIO",
    "MSG": "MSG",
    "DJ": "DJ",
    "JD": "JD",
  };
  const mapped = specialMap[kw];
  if (mapped) {
    for (const t of tickers) {
      const suffix = t.split("-").pop();
      if (suffix === mapped) return t;
    }
  }

  return null;
}

// ── get NO liquidity (total shares) over time reconstructed from deltas ─────
function getNoLiquidity(db, ticker, closeoutTs) {
  try {
    // 1. Get initial total from first snapshot
    const initialRow = db.query("SELECT no, ts FROM snapshots WHERE ticker = ? ORDER BY ts ASC LIMIT 1").get(ticker);
    let currentTotal = 0;
    let startTs = null;
    
    if (initialRow) {
      startTs = initialRow.ts;
      try {
        const levels = JSON.parse(initialRow.no || "[]");
        for (const [p, q] of levels) currentTotal += q;
      } catch {}
    }
    
    // 2. Get all deltas for NO side
    const deltas = db.query(
      `SELECT ts, delta FROM deltas WHERE ticker = ? AND side = 'no' ORDER BY ts ASC`
    ).all(ticker);
    
    if (deltas.length === 0 && !initialRow) return [];
    
    const series = [];
    if (startTs) {
      const t = startTs.includes('T') ? startTs : startTs.replace(' ', 'T');
      series.push({ t: t.endsWith('Z') ? t : t + 'Z', v: currentTotal });
    }
    
    let runningTotal = currentTotal;
    for (const d of deltas) {
      runningTotal += d.delta;
      if (runningTotal < 0) runningTotal = 0;
      const t = d.ts.includes('T') ? d.ts : d.ts.replace(' ', 'T');
      series.push({ t: t.endsWith('Z') ? t : t + 'Z', v: runningTotal });
    }
    
    // Always add a final point at closeout to ensure a line is drawn
    if (closeoutTs) {
      const t = closeoutTs.includes('T') ? closeoutTs : closeoutTs.replace(' ', 'T');
      series.push({ t: t.endsWith('Z') ? t : t + 'Z', v: runningTotal });
    }
    
    // 3. Downsample if too many points
    if (series.length > 400) {
      const step = Math.ceil(series.length / 400);
      return series.filter((_, i) => i % step === 0 || i === series.length - 1);
    }
    return series;
  } catch (e) {
    return [];
  }
}

// ── find NO closeout time (first time price hits 1/99 or liq hits 0) ────────
function findNoCloseout(db, ticker) {
  try {
    // 1. Get initial NO total
    const initialRow = db.query("SELECT no FROM snapshots WHERE ticker = ? ORDER BY ts ASC LIMIT 1").get(ticker);
    let runningTotal = 0;
    if (initialRow) {
      const levels = JSON.parse(initialRow.no || "[]");
      for (const [p, q] of levels) runningTotal += q;
    }

    // 2. Scan deltas for the moment it hits 0
    const deltas = db.query(`
      SELECT ts, delta, price, side 
      FROM deltas 
      WHERE ticker = ? 
      ORDER BY ts ASC
    `).all(ticker);

    if (runningTotal === 0 && initialRow) return initialRow.ts;

    for (const d of deltas) {
      if (d.side === 'no') {
        runningTotal += d.delta;
        if (d.price === 1) return d.ts;
      }
      if (d.side === 'yes' && d.price === 99) return d.ts;
      if (runningTotal <= 0) return d.ts;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ── parse ISO timestamp from DB ─────────────────────────────────────────────
function parseDbTs(ts) {
  return new Date(ts);
}

// ── parse signal timestamp (already in ET, treat as UTC for delta calc) ─────
function parseSignalTs(ts, tz) {
  // ts = "2026-04-13 18:07:08.127", tz = "-0400"
  const sign = tz[0] === "+" ? 1 : -1;
  const hours = parseInt(tz.slice(1, 3), 10);
  const mins = parseInt(tz.slice(3, 5), 10);
  const offsetMs = sign * (hours * 60 + mins) * 60 * 1000;
  const utcMs = new Date(ts.replace(" ", "T") + "Z").getTime() - offsetMs;
  return new Date(utcMs);
}

// ── parse schedule_run.log for media sources ────────────────────────────────
function parseMediaSources() {
  const sources = new Map();
  if (!fs.existsSync(SCHEDULE_LOG)) return sources;
  
  const content = fs.readFileSync(SCHEDULE_LOG, "utf-8");
  const re = /\[(kx\S+?)\] Stream: (https?:\/\/\S+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const session = m[1].toLowerCase();
    const url = m[2];
    let name = "Other";
    if (session.includes("ftn")) name = "CBS";
    else if (url.includes("youtube.com")) name = "YouTube TV";
    else if (url.includes("amazon.com")) name = "Amazon Prime";
    else if (url.includes("espn.com")) name = "ESPN";
    else if (url.includes("live-video.net")) name = "IVS";
    else if (url.includes("media-server.com")) name = "Media-Server";
    else if (url.includes("localhost") || url.includes("127.0.0.1")) name = "OTA";
    
    sources.set(session, name);
  }
  return sources;
}

// ── get market start time (first snapshot for ticker) ───────────────────────
function getMarketStartTime(db, ticker) {
  try {
    const row = db.query("SELECT MIN(ts) as start FROM snapshots WHERE ticker = ?").get(ticker);
    return row ? row.start : null;
  } catch {
    return null;
  }
}

// ── format ms delta in hundredths of a second ──────────────────────────────
function formatDelta(ms) {
  const cs = ms / 10; // centiseconds (hundredths of a second)
  const sign = cs < 0 ? "-" : "+";
  return `${sign}${Math.abs(cs).toFixed(0)}`;
}

function formatDeltaHuman(ms) {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? "-" : "+";
  if (abs < 1000) return `${sign}${abs.toFixed(0)}ms`;
  if (abs < 60000) return `${sign}${(abs / 1000).toFixed(1)}s`;
  if (abs < 3600000) return `${sign}${(abs / 60000).toFixed(1)}m`;
  return `${sign}${(abs / 3600000).toFixed(1)}h`;
}

// ── main ────────────────────────────────────────────────────────────────────
function main() {
  const slugToTitle = loadMarketTitles();
  const signals = parseLogFiles();
  console.log(`Parsed ${signals.length} signals from log files\n`);

  const mediaSources = parseMediaSources();
  console.log(`Loaded ${mediaSources.size} media source mappings from schedule_run.log\n`);

  // DB cache
  const dbCache = new Map();
  const tickerCache = new Map();

  function getDb(session) {
    if (dbCache.has(session)) return dbCache.get(session);
    const dbPath = path.join(MARKET_TRACKING_DIR, `${session}.db`);
    if (!fs.existsSync(dbPath)) {
      dbCache.set(session, null);
      return null;
    }
    try {
      const db = new Database(dbPath, { readonly: true });
      dbCache.set(session, db);
      return db;
    } catch {
      dbCache.set(session, null);
      return null;
    }
  }

  function getTickers(db, session) {
    if (tickerCache.has(session)) return tickerCache.get(session);
    try {
      const rows = db.query("SELECT DISTINCT ticker FROM snapshots").all();
      const tickers = rows.map((r) => r.ticker);
      tickerCache.set(session, tickers);
      return tickers;
    } catch {
      tickerCache.set(session, []);
      return [];
    }
  }

  // Results
  const results = [];
  const stats = {
    noDb: 0,
    noTicker: new Set(),
    noCloseout: new Set(),
    matched: 0,
  };

  // Deduplicate: only take first signal per (session, word)
  const seen = new Set();
  const now = new Date();

  for (const sig of signals) {
    const key = `${sig.session}|${sig.word}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // For "remote" sessions, try to match from the target
    let session = sig.session;
    if (session === "remote" && sig.target !== "undefined") {
      // e.g. target = "KXNBAMENTION-26MAR17CLEMIL-PLAY"
      // session should be the part before the last dash, lowercased
      const parts = sig.target.split("-");
      if (parts.length >= 3) {
        session = parts.slice(0, -1).join("-").toLowerCase();
      }
    }

    const db = getDb(session);
    if (!db) {
      stats.noDb++;
      continue;
    }

    const tickers = getTickers(db, session);
    if (tickers.length === 0) {
      stats.noDb++;
      continue;
    }

    const matchedTicker = fuzzyMatchTicker(sig.word, tickers);
    if (!matchedTicker) {
      stats.noTicker.add(`${session}:${sig.word}`);
      continue;
    }

    const closeoutTs = findNoCloseout(db, matchedTicker);
    if (!closeoutTs) {
      stats.noCloseout.add(`${session}:${sig.word}`);
      // Don't continue; we want to see live signals too
    }

    const signalTime = parseSignalTs(sig.timestamp, sig.tz);
    const closeoutTime = closeoutTs ? parseDbTs(closeoutTs) : null;
    const deltaMs = closeoutTime ? closeoutTime.getTime() - signalTime.getTime() : null;

    if (deltaMs !== null && Math.abs(deltaMs) > 24 * 3600000) continue; // 24 hours max for a match

    // Get market start for duration calculation
    const startTs = getMarketStartTime(db, matchedTicker);
    let sessionDurationMs = null;
    if (startTs && closeoutTime) {
      sessionDurationMs = closeoutTime.getTime() - parseDbTs(startTs).getTime();
    }

    results.push({
      session,
      title: slugToTitle.get(session.toLowerCase()) || session,
      mediaSource: mediaSources.get(session) || (session === 'remote' ? 'REMOTE' : session.split('-')[0]),
      word: sig.word,
      target: sig.target,
      ticker: matchedTicker,
      signalTs: sig.timestamp,
      signalIso: signalTime.toISOString(),
      closeoutTs: closeoutTs || (now - signalTime > 24 * 3600000 ? "EXPIRED" : "LIVE"),
      deltaMs,
      sessionDurationMs,
      status: deltaMs === null ? (now - signalTime > 24 * 3600000 ? "EXPIRED" : "LIVE") : (deltaMs > 0 ? "BEFORE" : "AFTER"),
      volume: getNoLiquidity(db, matchedTicker, closeoutTs || undefined)
    });
    stats.matched++;
  }

  // Sort by session then signal time
  results.sort((a, b) => {
    if (a.session !== b.session) return a.session.localeCompare(b.session);
    return a.signalTs.localeCompare(b.signalTs);
  });

  // Sort results by signal time (ascending)
  results.sort((a, b) => new Date(a.signalIso).getTime() - new Date(b.signalIso).getTime());

  // Print table
  const col = {
    title: 45,
    word: 22,
    ticker_suffix: 6,
    signal: 23,
    closeout: 28,
    delta: 12,
    status: 7,
  };

  console.log(
    [
      "Event Title".padEnd(col.title),
      "Word".padEnd(col.word),
      "Sfx".padEnd(col.ticker_suffix),
      "Signal Time".padEnd(col.signal),
      "NO Closeout".padEnd(col.closeout),
      "Delta".padEnd(col.delta),
      "Status".padEnd(col.status),
    ].join(" | ")
  );
  console.log("-".repeat(165));

  for (const r of results) {
    const suffix = r.ticker.split("-").pop();
    try {
      console.log(
        [
          (r.title.length > col.title ? r.title.slice(0, col.title - 3) + "..." : r.title).padEnd(col.title),
          r.word.padEnd(col.word),
          suffix.padEnd(col.ticker_suffix),
          r.signalTs.padEnd(col.signal),
          r.closeoutTs.slice(0, 26).padEnd(col.closeout),
          formatDelta(r.deltaMs).padEnd(col.delta),
          r.status.padEnd(col.status),
        ].join(" | ")
      );
    } catch {
      break;
    }
  }

  // Summary
  console.log("-".repeat(155));
  const wins = results.filter((r) => r.status === "BEFORE").length;
  const losses = results.length - wins;
  const winDeltas = results
    .filter((r) => r.status === "BEFORE")
    .map((r) => r.deltaMs);
  const avgWinMs = winDeltas.length
    ? winDeltas.reduce((a, b) => a + b, 0) / winDeltas.length
    : 0;
  const medianWinMs = winDeltas.length
    ? winDeltas.sort((a, b) => a - b)[Math.floor(winDeltas.length / 2)]
    : 0;

  console.log(`\nTotal unique (session, word) pairs: ${seen.size}`);
  console.log(`Matched to market + closeout:       ${stats.matched}`);
  console.log(
    `  BEFORE closeout (WIN):            ${wins} (${results.length ? ((wins / results.length) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  AFTER closeout (LATE):            ${losses}`);
  console.log(`  No DB found:                      ${stats.noDb}`);
  console.log(
    `  No ticker match:                  ${stats.noTicker.size}`
  );
  console.log(
    `  No closeout found:                ${stats.noCloseout.size}`
  );
  console.log(
    `\nAvg lead time (wins):               ${formatDeltaHuman(avgWinMs)}`
  );
  console.log(
    `Median lead time (wins):            ${formatDeltaHuman(medianWinMs)}`
  );

  // ── Write HTML table ──────────────────────────────────────────────────────
  const htmlPath = path.join(DATA_DIR, "signal_vs_no_closeout.html");
  const escH = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Signal vs NO Closeout</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Menlo', 'Consolas', monospace; background: #0d1117; color: #c9d1d9; padding: 24px; }
  h1 { font-size: 18px; color: #58a6ff; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #8b949e; margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 20px; }
  .stat { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px 14px; }
  .stat .label { font-size: 11px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat .value { font-size: 22px; font-weight: 700; color: #e6edf3; margin-top: 2px; }
  .stat .value.green { color: #3fb950; }
  .stat .value.red { color: #f85149; }
  .stat .value.blue { color: #58a6ff; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { position: sticky; top: 0; z-index: 10; }
  th { background: #161b22; color: #8b949e; text-align: left; padding: 10px 12px; border-bottom: 2px solid #30363d;
       font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; cursor: pointer; user-select: none; }
  th:hover { color: #58a6ff; }
  td { padding: 8px 12px; border-bottom: 1px solid #21262d; white-space: nowrap; }
  tr:hover td { background: #1c2128; cursor: pointer; }
  .before { color: #3fb950; font-weight: 700; }
  .after { color: #f85149; }
  .live { color: #58a6ff; font-style: italic; }
  .expired { color: #484f58; }
  .delta { text-align: right; font-variant-numeric: tabular-nums; }
  .delta-val { font-weight: 600; }
  .session-info { color: #8b949e; display: flex; flex-direction: column; gap: 2px; }
  .source-id { font-size: 10px; color: #484f58; text-transform: uppercase; }
  .event-title { color: #c9d1d9; font-weight: 500; white-space: normal; max-width: 400px; line-height: 1.2; }
  .word { color: #d2a8ff; font-weight: 600; }
  .sfx { color: #79c0ff; }
  .filter-bar { margin-bottom: 12px; display: flex; gap: 8px; align-items: center; }
  .filter-bar input { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; color: #c9d1d9;
                      padding: 6px 10px; font-size: 12px; font-family: inherit; width: 260px; }
  .filter-bar input:focus { outline: none; border-color: #58a6ff; }
  .filter-bar select { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; color: #c9d1d9;
                       padding: 6px 8px; font-size: 12px; font-family: inherit; }
  
  /* Modal / Thumbnail style */
  #chart-container { 
    position: fixed; display: none; 
    background: #161b22; border: 1px solid #30363d; border-radius: 8px; 
    box-shadow: 0 8px 32px rgba(0,0,0,0.6); 
    padding: 20px; width: 800px; height: 500px; z-index: 100;
    pointer-events: auto; /* Enable tooltips */
  }
  .chart-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; }
  .chart-title { color: #e6edf3; font-weight: 600; }
  
  .thumb-cell { width: 40px; text-align: center; }
  .thumb-icon { font-size: 16px; opacity: 0.5; }
  tr:hover .thumb-icon { opacity: 1; color: #58a6ff; }
</style>
</head>
<body>
<h1>Signal vs NO Closeout — Timing Analysis</h1>
<p class="subtitle">Delta shown in hundredths of a second (centiseconds). Hover rows to see NO Liquidity graph.</p>

<div id="chart-container">
  <div class="chart-header">
    <div class="chart-title" id="chart-title">Market Liquidity</div>
    <div id="chart-subtitle" style="color: #8b949e">Total NO Shares</div>
  </div>
  <canvas id="volChart"></canvas>
</div>

<div class="stats">
  <div class="stat"><div class="label">Total Matched</div><div class="value blue">${stats.matched}</div></div>
  <div class="stat"><div class="label">Before (WIN)</div><div class="value green">${wins} (${results.length ? ((wins / results.length) * 100).toFixed(1) : 0}%)</div></div>
  <div class="stat"><div class="label">After (LATE)</div><div class="value red">${losses}</div></div>
  <div class="stat"><div class="label">Avg Lead (wins)</div><div class="value green">${formatDelta(avgWinMs)} cs</div></div>
  <div class="stat"><div class="label">Median Lead (wins)</div><div class="value green">${formatDelta(medianWinMs)} cs</div></div>
  <div class="stat"><div class="label">No Ticker Match</div><div class="value">${stats.noTicker.size}</div></div>
</div>

<div class="filter-bar">
  <input type="text" id="filter" placeholder="Filter by session or word..." />
  <select id="statusFilter">
    <option value="all">All</option>
    <option value="BEFORE">BEFORE only</option>
    <option value="AFTER">AFTER only</option>
    <option value="LIVE">LIVE only</option>
    <option value="EXPIRED">EXPIRED only</option>
  </select>
</div>

<table>
<thead>
  <tr>
    <th></th>
    <th data-col="1">Event / Source</th>
    <th data-col="2">Word</th>
    <th data-col="3">Suffix</th>
    <th data-col="4">Signal Time</th>
    <th data-col="5">NO Closeout (UTC)</th>
    <th data-col="6">Market Duration</th>
    <th data-col="7">Delta (cs)</th>
    <th data-col="8">Human</th>
    <th data-col="9">Status</th>
  </tr>
</thead>
<tbody id="tbody">
`;

  for (const r of results) {
    const suffix = r.ticker.split("-").pop();
    const cs = r.deltaMs !== null ? (r.deltaMs / 10).toFixed(0) : "...";
    const csSign = r.deltaMs !== null ? (r.deltaMs >= 0 ? "+" : "") : "";
    const cls = r.status.toLowerCase();
    
    // Session Duration
    const durationHuman = r.sessionDurationMs !== null ? formatDeltaHuman(r.sessionDurationMs).replace('+', '') : '-';
    
    // Serialize volume data for the row
    const volData = JSON.stringify(r.volume);
    const humanDelta = r.deltaMs !== null ? formatDeltaHuman(r.deltaMs) : (r.status === "EXPIRED" ? "EXPIRED" : "LIVE");
    
    const closeoutStr = r.status === "LIVE" || r.status === "EXPIRED" ? r.status : r.closeoutTs.slice(0, 26);
    const closeoutTimeAttr = r.status === "LIVE" || r.status === "EXPIRED" ? Date.now() : new Date(r.closeoutTs).getTime();

    html += `<tr data-session="${escH(r.session)}" data-word="${escH(r.word)}" data-status="${r.status}" 
                data-vol='${volData}' data-signal="${r.signalIso}" data-closeout="${r.closeoutTs}"
                data-human="${escH(humanDelta)}">
  <td class="thumb-cell"><span class="thumb-icon">📈</span></td>
  <td class="session-info" title="${escH(r.session)}">
    <div class="source-id">${escH(r.mediaSource)}</div>
    <div class="event-title">${escH(r.title)}</div>
  </td>
  <td class="word">${escH(r.word)}</td>
  <td class="sfx">${escH(suffix)}</td>
  <td data-time="${new Date(r.signalIso).getTime()}">${escH(r.signalTs)}</td>
  <td data-time="${closeoutTimeAttr}">${escH(closeoutStr)}</td>
  <td style="color: #8b949e">${durationHuman}</td>
  <td class="delta"><span class="delta-val ${cls}">${csSign}${cs}</span></td>
  <td class="delta ${cls}">${humanDelta}</td>
  <td class="${cls}">${r.status}</td>
</tr>\n`;
  }

  html += `</tbody>
</table>

<script>
const tbody = document.getElementById('tbody');
const rows = [...tbody.querySelectorAll('tr')];
const filter = document.getElementById('filter');
const statusFilter = document.getElementById('statusFilter');
const chartContainer = document.getElementById('chart-container');
const chartTitle = document.getElementById('chart-title');
const ctx = document.getElementById('volChart').getContext('2d');

let myChart = null;

function applyFilters() {
  const q = filter.value.toLowerCase();
  const sf = statusFilter.value;
  for (const row of rows) {
    const session = row.dataset.session;
    const word = row.dataset.word;
    const status = row.dataset.status;
    const textMatch = !q || session.includes(q) || word.includes(q);
    const statusMatch = sf === 'all' || status === sf;
    row.style.display = textMatch && statusMatch ? '' : 'none';
  }
}
filter.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);

// Tooltip Chart Logic
for (const row of rows) {
  row.addEventListener('mouseenter', (e) => {
    const vol = JSON.parse(row.dataset.vol || '[]');
    if (vol.length === 0) return;
    
    const sig = row.dataset.signal;
    const clo = row.dataset.closeout;
    const word = row.dataset.word;
    const human = row.dataset.human;
    const status = row.dataset.status;
    
    // Find when liquidity drops to 0
    const zeroPoint = vol.find(d => d.v === 0);
    const zeroTs = zeroPoint ? zeroPoint.t : null;
    const zeroTime = zeroTs ? new Date(zeroTs).getTime() : null;
    
    chartTitle.innerText = "NO Liquidity: " + word;
    const sub = document.getElementById('chart-subtitle');
    sub.innerText = "Lead/Lag: " + human;
    sub.style.color = status === 'BEFORE' ? '#3fb950' : '#f85149';
    
    chartContainer.style.display = 'block';
    
    // Position modal near mouse
    const move = (ev) => {
      // Offset more to the right/down to avoid flicker
      chartContainer.style.left = (ev.clientX + 30) + 'px';
      chartContainer.style.top = (ev.clientY - 250) + 'px';
    };
    move(e);
    row.onmousemove = move;
    
    row.addEventListener('mouseleave', () => {
      chartContainer.style.display = 'none';
      row.onmousemove = null;
    });

    if (myChart) myChart.destroy();
    
    // Find closest indices for markers
    const sigTime = new Date(sig).getTime();
    const cloTime = new Date(clo).getTime();
    
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Total NO Shares',
          data: vol.map(d => ({ x: d.t, y: d.v })),
          borderColor: '#d2a8ff',
          backgroundColor: 'rgba(210, 168, 255, 0.1)',
          fill: true,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: { enabled: true },
          annotation: {
            annotations: {
              signalLine: {
                type: 'line',
                xMin: sigTime,
                xMax: sigTime,
                borderColor: '#3fb950',
                borderWidth: 2,
                label: {
                  display: true,
                  content: 'SIGNAL',
                  position: 'start',
                  backgroundColor: '#3fb950',
                  color: '#fff',
                  font: { size: 10 }
                }
              },
              closeLine: {
                type: 'line',
                xMin: cloTime,
                xMax: cloTime,
                borderColor: '#f85149',
                borderDash: [5, 5],
                borderWidth: 1,
                label: {
                  display: true,
                  content: 'CLOSEOUT',
                  position: 'end',
                  backgroundColor: '#f85149',
                  color: '#fff',
                  font: { size: 9 }
                }
              },
              zeroLine: zeroTime ? {
                type: 'line',
                xMin: zeroTime,
                xMax: zeroTime,
                borderColor: '#ff7b72',
                borderWidth: 3,
                label: {
                  display: true,
                  content: 'ZERO LIQ',
                  position: 'center',
                  backgroundColor: '#ff7b72',
                  color: '#fff',
                  font: { size: 10, weight: 'bold' }
                }
              } : null
            }
          }
        },
        scales: {
          x: { 
            display: true, 
            type: 'time',
            time: {
              unit: 'minute',
              stepSize: 5,
              displayFormats: {
                minute: 'HH:mm'
              }
            },
            grid: { color: '#30363d', borderDash: [2, 2] },
            ticks: { color: '#8b949e', font: { size: 9 } }
          },
          y: { 
            display: true, 
            grid: { color: '#30363d' },
            ticks: { color: '#8b949e', font: { size: 9 } }
          }
        }
      }
    });
  });
  
  row.addEventListener('mouseleave', () => {
    chartContainer.style.display = 'none';
    row.onmousemove = null;
  });
}

// Column sorting
document.querySelectorAll('th').forEach(th => {
  th.addEventListener('click', () => {
    const col = parseInt(th.dataset.col);
    if (isNaN(col)) return;
    // ... sorting logic ...
    const sortAsc = th.dataset.sort !== 'asc';
    th.dataset.sort = sortAsc ? 'asc' : 'desc';
    
    rows.sort((a, b) => {
      const at = a.children[col].dataset.time;
      const bt = b.children[col].dataset.time;
      if (at && bt) return sortAsc ? at - bt : bt - at;

      const ac = a.children[col].textContent.trim();
      const bc = b.children[col].textContent.trim();
      const an = parseFloat(ac.replace(/[^-0.9.]/g, '')), bn = parseFloat(bc.replace(/[^-0.9.]/g, ''));
      if (!isNaN(an) && !isNaN(bn)) return sortAsc ? an - bn : bn - an;
      return sortAsc ? ac.localeCompare(bc) : bc.localeCompare(ac);
    });
    for (const r of rows) tbody.appendChild(r);
  });
});
</script>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html);
  console.log(`\nHTML table written to ${htmlPath}`);

  // Close DBs
  for (const db of dbCache.values()) {
    if (db) db.close();
  }
}

main();
