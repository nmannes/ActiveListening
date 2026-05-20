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
    
    // 3. Downsample if too many points
    if (series.length > 400) {
      const step = Math.ceil(series.length / 400);
      return series.filter((d, i) => i % step === 0 || i === series.length - 1 || d.v === 0);
    }
    return series;
  } catch (e) {
    return [];
  }
}

// ── find most significant market change within ±30s of signal time ────────
function findMarketChange(db, ticker, signalIso) {
  try {
    const sigMs = new Date(signalIso).getTime();
    const windowMs = 30 * 1000;
    const windowStart = new Date(sigMs - windowMs).toISOString();
    const windowEnd = new Date(sigMs + windowMs).toISOString();

    // Get all snapshots up to window end (need full history to reconstruct book)
    const snapshots = db.query("SELECT ts, no, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, windowEnd);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, windowEnd);

    const events = [];
    for (const s of snapshots) events.push({ type: 'snapshot', ts: s.ts, no: s.no, seq: s.seq });
    for (const d of deltas) events.push({ type: 'delta', ts: d.ts, side: d.side, price: d.price, delta: d.delta, seq: d.seq });

    events.sort((a, b) => {
      const ta = new Date(a.ts).getTime();
      const tb = new Date(b.ts).getTime();
      if (ta !== tb) return ta - tb;
      if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq) return a.seq - b.seq;
      if (a.type !== b.type) return a.type === 'snapshot' ? -1 : 1;
      return 0;
    });

    const book = new Map();
    let prevTotalQty = 0;
    let bestChange = null; // { ts, absChange, price, totalQty }

    for (const e of events) {
      if (e.type === 'snapshot') {
        book.clear();
        try {
          const levels = JSON.parse(e.no || "[]");
          for (const [p, q] of levels) book.set(p, q);
        } catch {}
      } else {
        if (e.side === 'no') {
          const cur = book.get(e.price) || 0;
          const upd = cur + e.delta;
          if (upd <= 0) book.delete(e.price);
          else book.set(e.price, upd);
        }
      }

      const eMs = new Date(e.ts).getTime();

      // Only score events inside the ±30s window
      if (eMs >= sigMs - windowMs && eMs <= sigMs + windowMs && e.type === 'delta' && e.side === 'no') {
        let totalQty = 0;
        let bestPrice = null;
        for (const [p, q] of book.entries()) {
          if (q > 0) {
            totalQty += q;
            if (bestPrice === null || p < bestPrice) bestPrice = p;
          }
        }
        const absChange = Math.abs(totalQty - prevTotalQty);
        if (!bestChange || absChange > bestChange.absChange) {
          bestChange = { ts: e.ts, absChange, price: bestPrice, totalQty };
        }
        prevTotalQty = totalQty;
      } else {
        // Update running total for events outside window
        let totalQty = 0;
        for (const [, q] of book.entries()) { if (q > 0) totalQty += q; }
        prevTotalQty = totalQty;
      }
    }
    return bestChange;
  } catch (e) {
    return null;
  }
}

// ── get best NO price at specific ISO timestamp ─────────────────────────────
function getNoPriceAt(db, ticker, ts) {
  try {
    const snapshots = db.query("SELECT ts, no, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, ts);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, ts);

    const events = [];
    for (const s of snapshots) {
      events.push({ type: 'snapshot', ts: s.ts, no: s.no, seq: s.seq });
    }
    for (const d of deltas) {
      events.push({ type: 'delta', ts: d.ts, side: d.side, price: d.price, delta: d.delta, seq: d.seq });
    }

    events.sort((a, b) => {
      const ta = new Date(a.ts).getTime();
      const tb = new Date(b.ts).getTime();
      if (ta !== tb) return ta - tb;
      if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq) return a.seq - b.seq;
      if (a.type !== b.type) return a.type === 'snapshot' ? -1 : 1;
      return 0;
    });

    const book = new Map();
    for (const e of events) {
      if (e.type === 'snapshot') {
        book.clear();
        try {
          const levels = JSON.parse(e.no || "[]");
          for (const [p, q] of levels) {
            book.set(p, q);
          }
        } catch {}
      } else {
        if (e.side === 'no') {
          const cur = book.get(e.price) || 0;
          const upd = cur + e.delta;
          if (upd <= 0) book.delete(e.price);
          else book.set(e.price, upd);
        }
      }
    }

    let bestPrice = null;
    for (const [p, q] of book.entries()) {
      if (q > 0) {
        if (bestPrice === null || p < bestPrice) {
          bestPrice = p;
        }
      }
    }
    return bestPrice;
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
  if (ms === null || ms === undefined) return "n/a";
  const cs = ms / 10; // centiseconds (hundredths of a second)
  const sign = cs < 0 ? "-" : "+";
  return `${sign}${Math.abs(cs).toFixed(0)}`;
}

function formatDeltaHuman(ms) {
  if (ms === null || ms === undefined) return "n/a";
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

  const formatPriceChange = (s, c) => {
    if (s === null || s === undefined) return "n/a";
    const cStr = c !== null && c !== undefined ? `${c}c` : "PENDING";
    return `${s}c -> ${cStr}`;
  };

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
    matched: 0,
  };

  // Group signals by (resolved session, word)
  const signalGroups = new Map();
  for (const sig of signals) {
    let session = sig.session;
    if (session === "remote" && sig.target !== "undefined") {
      const parts = sig.target.split("-");
      if (parts.length >= 3) {
        session = parts.slice(0, -1).join("-").toLowerCase();
      }
    }
    const key = `${session}|${sig.word}`;
    if (!signalGroups.has(key)) signalGroups.set(key, []);
    signalGroups.get(key).push({ ...sig, resolvedSession: session });
  }

  const seen = new Set(signalGroups.keys());
  const now = new Date();

  for (const group of signalGroups.values()) {
    const firstSig = group[0];
    const session = firstSig.resolvedSession;

    const db = getDb(session);
    let tickers = [];
    let matchedTicker = null;
    if (db) {
      tickers = getTickers(db, session);
      if (tickers.length > 0) {
        matchedTicker = fuzzyMatchTicker(firstSig.word, tickers);
      }
    }

    if (!db || tickers.length === 0) {
      stats.noDb++;
    } else if (!matchedTicker) {
      stats.noTicker.add(`${session}:${firstSig.word}`);
    }

    // Output every unique detection
    const uniqueSigs = new Map();
    for (const sig of group) {
      if (!uniqueSigs.has(sig.timestamp)) {
        uniqueSigs.set(sig.timestamp, sig);
      }
    }

    for (const sig of uniqueSigs.values()) {
      const signalTime = parseSignalTs(sig.timestamp, sig.tz);
      const signalIso = signalTime.toISOString();

      // Find most significant market change within ±30s of this signal
      const mktChange = (db && matchedTicker) ? findMarketChange(db, matchedTicker, signalIso) : null;
      const mktChangeTs = mktChange ? mktChange.ts : null;
      const mktChangeTime = mktChangeTs ? parseDbTs(mktChangeTs) : null;

      let deltaMs = null;
      let status = "NO_CHANGE";
      let mktChangeVal = "—";

      if (mktChangeTime) {
        deltaMs = mktChangeTime.getTime() - signalTime.getTime();
        status = deltaMs > 0 ? "BEFORE" : "AFTER";
        mktChangeVal = mktChangeTs;
      }

      // Price at signal time and at market change time
      let signalPrice = null;
      let changePrice = null;
      let windowStartPrice = null;
      let windowEndPrice = null;

      if (db && matchedTicker) {
        signalPrice = getNoPriceAt(db, matchedTicker, signalIso);
        if (mktChange) {
          changePrice = mktChange.price;
        }
        const thirtySecMs = 30 * 1000;
        windowStartPrice = getNoPriceAt(db, matchedTicker, new Date(signalTime.getTime() - thirtySecMs).toISOString());
        windowEndPrice = getNoPriceAt(db, matchedTicker, new Date(signalTime.getTime() + thirtySecMs).toISOString());
      }

      results.push({
        session,
        title: slugToTitle.get(session.toLowerCase()) || session,
        mediaSource: mediaSources.get(session) || (session === 'remote' ? 'REMOTE' : session.split('-')[0]),
        word: sig.word,
        target: sig.target,
        ticker: matchedTicker || "",
        signalTs: sig.timestamp,
        signalIso: signalIso,
        mktChangeTs: mktChangeVal,
        mktChangeQty: mktChange ? mktChange.absChange : 0,
        deltaMs: deltaMs,
        status: status,
        volume: (db && matchedTicker) ? getNoLiquidity(db, matchedTicker, mktChangeTs || undefined) : [],
        signalPrice,
        changePrice,
        windowStartPrice,
        windowEndPrice
      });
      if (db && matchedTicker) {
        stats.matched++;
      }
    }
  }

  // Sort by signal time descending
  results.sort((a, b) => new Date(b.signalIso).getTime() - new Date(a.signalIso).getTime());

  // Print table
  const col = {
    title: 35,
    word: 15,
    ticker_suffix: 5,
    signal: 23,
    mkt_change: 28,
    price_change: 14,
    window_change: 15,
    qty_change: 8,
    delta: 12,
    status: 10,
  };

  console.log(
    [
      "Event Title".padEnd(col.title),
      "Word".padEnd(col.word),
      "Sfx".padEnd(col.ticker_suffix),
      "Signal Time".padEnd(col.signal),
      "Market Change".padEnd(col.mkt_change),
      "Price Chg".padEnd(col.price_change),
      "Window (±30s)".padEnd(col.window_change),
      "Qty Δ".padEnd(col.qty_change),
      "Delta".padEnd(col.delta),
      "Status".padEnd(col.status),
    ].join(" | ")
  );
  console.log("-".repeat(195));

  for (const r of results) {
    const suffix = r.ticker ? r.ticker.split("-").pop() : "???";
    try {
      console.log(
        [
          (r.title.length > col.title ? r.title.slice(0, col.title - 3) + "..." : r.title).padEnd(col.title),
          r.word.padEnd(col.word),
          suffix.padEnd(col.ticker_suffix),
          r.signalTs.padEnd(col.signal),
          (r.mktChangeTs === "—" ? "—" : r.mktChangeTs.slice(0, 26)).padEnd(col.mkt_change),
          formatPriceChange(r.signalPrice, r.changePrice).padEnd(col.price_change),
          formatPriceChange(r.windowStartPrice, r.windowEndPrice).padEnd(col.window_change),
          String(r.mktChangeQty).padEnd(col.qty_change),
          formatDelta(r.deltaMs).padEnd(col.delta),
          r.status.padEnd(col.status),
        ].join(" | ")
      );
    } catch {
      break;
    }
  }

  // Summary
  console.log("-".repeat(195));
  const before = results.filter((r) => r.status === "BEFORE").length;
  const after = results.filter((r) => r.status === "AFTER").length;
  const noChange = results.filter((r) => r.status === "NO_CHANGE").length;
  const resolvedCount = before + after;

  const beforeDeltas = results
    .filter((r) => r.status === "BEFORE")
    .map((r) => r.deltaMs);
  const avgBeforeMs = beforeDeltas.length
    ? beforeDeltas.reduce((a, b) => a + b, 0) / beforeDeltas.length
    : 0;
  const medianBeforeMs = beforeDeltas.length
    ? beforeDeltas.sort((a, b) => a - b)[Math.floor(beforeDeltas.length / 2)]
    : 0;

  console.log(`\nTotal unique (session, word) pairs: ${seen.size}`);
  console.log(`Total signals processed:            ${results.length}`);
  console.log(`Matched to market:                  ${stats.matched}`);
  console.log(
    `  BEFORE mkt change (WIN):          ${before} (${resolvedCount ? ((before / resolvedCount) * 100).toFixed(1) : 0}%)`
  );
  console.log(`  AFTER mkt change (LATE):          ${after}`);
  console.log(`  NO CHANGE in ±30s:                ${noChange}`);
  console.log(`  No DB found:                      ${stats.noDb}`);
  console.log(
    `  No ticker match:                  ${stats.noTicker.size}`
  );
  console.log(
    `\nAvg lead time (wins):               ${formatDeltaHuman(avgBeforeMs)}`
  );
  console.log(
    `Median lead time (wins):            ${formatDeltaHuman(medianBeforeMs)}`
  );

  // ── Write HTML table ──────────────────────────────────────────────────────
  const htmlPath = path.join(DATA_DIR, "signal_vs_no_closeout.html");
  const escH = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Signal vs Market Change</title>
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
  .no_change { color: #484f58; }
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
<h1>Signal vs Market Change — Timing Analysis</h1>
<p class="subtitle">Finds the most significant NO-side market change within ±30s of each signal. Delta = market_change_time − signal_time.</p>

<div id="chart-container">
  <div class="chart-header">
    <div class="chart-title" id="chart-title">Market Liquidity</div>
    <div id="chart-subtitle" style="color: #8b949e">Total NO Shares</div>
  </div>
  <canvas id="volChart"></canvas>
</div>

<div class="stats">
  <div class="stat"><div class="label">Total Signals</div><div class="value blue">${results.length}</div></div>
  <div class="stat"><div class="label">Before (WIN)</div><div class="value green">${before} (${resolvedCount ? ((before / resolvedCount) * 100).toFixed(1) : 0}%)</div></div>
  <div class="stat"><div class="label">After (LATE)</div><div class="value red">${after}</div></div>
  <div class="stat"><div class="label">No Change</div><div class="value" style="color: #8b949e">${noChange}</div></div>
  <div class="stat"><div class="label">Avg Lead (wins)</div><div class="value green">${formatDelta(avgBeforeMs)} cs</div></div>
  <div class="stat"><div class="label">Median Lead (wins)</div><div class="value green">${formatDelta(medianBeforeMs)} cs</div></div>
</div>

<div class="filter-bar">
  <input type="text" id="filter" placeholder="Filter by session or word..." />
  <select id="statusFilter">
    <option value="all">All</option>
    <option value="BEFORE">BEFORE only</option>
    <option value="AFTER">AFTER only</option>
    <option value="NO_CHANGE">NO_CHANGE only</option>
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
    <th data-col="5">Market Change (UTC)</th>
    <th data-col="6">Price Chg</th>
    <th data-col="7">Window (±30s)</th>
    <th data-col="8">Qty Δ</th>
    <th data-col="9">Delta (cs)</th>
    <th data-col="10">Human</th>
    <th data-col="11">Status</th>
  </tr>
</thead>
<tbody id="tbody">
`;

  for (const r of results) {
    const suffix = r.ticker ? r.ticker.split("-").pop() : "???";
    const cs = r.deltaMs !== null ? (r.deltaMs / 10).toFixed(0) : "...";
    const csSign = r.deltaMs !== null ? (r.deltaMs >= 0 ? "+" : "") : "";
    const cls = r.status.toLowerCase();
    
    // Serialize volume data for the row
    const volData = JSON.stringify(r.volume);
    const humanDelta = r.status === "NO_CHANGE" ? "—" : formatDeltaHuman(r.deltaMs);
    
    const mktChangeStr = r.mktChangeTs === "—" ? "—" : r.mktChangeTs.slice(0, 26);
    const mktChangeTimeAttr = r.mktChangeTs === "—" ? 999999999999 : new Date(r.mktChangeTs).getTime();
    
    // Sorting values
    const deltaSortVal = r.deltaMs !== null ? r.deltaMs : 999999999999;
    const priceChangeStr = formatPriceChange(r.signalPrice, r.changePrice);
    const priceDiff = (r.signalPrice !== null && r.changePrice !== null) ? (r.signalPrice - r.changePrice) : -999;
    const windowChangeStr = formatPriceChange(r.windowStartPrice, r.windowEndPrice);
    const windowDiff = (r.windowStartPrice !== null && r.windowEndPrice !== null) ? (r.windowStartPrice - r.windowEndPrice) : -999;

    html += `<tr data-session="${escH(r.session)}" data-word="${escH(r.word)}" data-status="${r.status}" 
                data-vol='${volData}' data-signal="${r.signalIso}" data-closeout="${r.mktChangeTs}"
                data-human="${escH(humanDelta)}">
  <td class="thumb-cell"><span class="thumb-icon">📈</span></td>
  <td class="session-info" title="${escH(r.session)}">
    <div class="source-id">${escH(r.mediaSource)}</div>
    <div class="event-title">${escH(r.title)}</div>
  </td>
  <td class="word">${escH(r.word)}</td>
  <td class="sfx">${escH(suffix)}</td>
  <td data-time="${new Date(r.signalIso).getTime()}">${escH(r.signalTs)}</td>
  <td data-time="${mktChangeTimeAttr}">${escH(mktChangeStr)}</td>
  <td data-time="${priceDiff}" style="color: #c9d1d9">${escH(priceChangeStr)}</td>
  <td data-time="${windowDiff}" style="color: #c9d1d9">${escH(windowChangeStr)}</td>
  <td data-time="${r.mktChangeQty}" style="color: #d2a8ff">${r.mktChangeQty || '—'}</td>
  <td class="delta" data-time="${deltaSortVal}"><span class="delta-val ${cls}">${csSign}${cs}</span></td>
  <td class="delta ${cls}" data-time="${deltaSortVal}">${humanDelta}</td>
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
    if (vol.length === 0) {
      chartContainer.style.display = 'none';
      return;
    }
    
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
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    
    // Find closest indices for markers
    const sigTime = new Date(sig).getTime();
    const cloTime = new Date(clo).getTime();
    
    const annotations = {};
    if (!isNaN(sigTime)) {
      annotations.signalLine = {
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
      };
    }
    if (zeroTime && !isNaN(zeroTime)) {
      annotations.zeroLine = {
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
      };
    }

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
            annotations: annotations
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

function sortColumn(th, asc) {
  const col = parseInt(th.dataset.col);
  if (isNaN(col)) return;
  th.dataset.sort = asc ? 'asc' : 'desc';
  rows.sort((a, b) => {
    const at = a.children[col].dataset.time;
    const bt = b.children[col].dataset.time;
    if (at && bt) return asc ? at - bt : bt - at;
    const ac = a.children[col].textContent.trim();
    const bc = b.children[col].textContent.trim();
    const an = parseFloat(ac.replace(/[^-0-9.]/g, '')), bn = parseFloat(bc.replace(/[^-0-9.]/g, ''));
    if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
    return asc ? ac.localeCompare(bc) : bc.localeCompare(ac);
  });
  for (const r of rows) tbody.appendChild(r);
}

// Column sorting click handlers
document.querySelectorAll('th').forEach(th => {
  th.addEventListener('click', () => {
    const asc = th.dataset.sort !== 'asc';
    sortColumn(th, asc);
  });
});

// Default sort by signal time descending on page load
sortColumn(document.querySelector('th[data-col="4"]'), false);
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
