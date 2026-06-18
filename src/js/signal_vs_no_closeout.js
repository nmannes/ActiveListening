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

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.resolve(__dirname, "..");
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

// ── load resolution cache ───────────────────────────────────────────────────
const RESOLUTIONS_PATH = path.join(CACHE_DIR, "resolutions.json");
function loadResolutions() {
  if (fs.existsSync(RESOLUTIONS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(RESOLUTIONS_PATH, "utf8"));
    } catch (e) {
      console.error(`Error loading resolutions: ${e.message}`);
    }
  }
  return {};
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

// ── get NO ask OHLC candles over full market lifetime ──────────────────────
function getNoAskSeries(db, ticker) {
  try {
    const snapshots = db.query("SELECT ts, no, seq FROM snapshots WHERE ticker = ? ORDER BY ts ASC").all(ticker);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? ORDER BY ts ASC").all(ticker);

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
    const raw = [];

    for (const e of events) {
      if (e.type === 'snapshot') {
        book.clear();
        try {
          const levels = JSON.parse(e.no || "[]");
          for (const [p, q] of levels) book.set(p, q);
        } catch {}
      } else if (e.side === 'no') {
        const cur = book.get(e.price) || 0;
        const upd = cur + e.delta;
        if (upd <= 0) book.delete(e.price);
        else book.set(e.price, upd);
      }

      let bestAsk = null;
      for (const [p, q] of book.entries()) {
        if (q > 0 && (bestAsk === null || p < bestAsk)) bestAsk = p;
      }
      const t = e.ts.includes('T') ? e.ts : e.ts.replace(' ', 'T');
      raw.push({ t: new Date(t.endsWith('Z') ? t : t + 'Z').getTime(), v: bestAsk });
    }

    if (raw.length === 0) return [];

    // Aggregate into OHLC candles (30s buckets)
    const BUCKET_MS = 30000;
    const firstTime = raw[0].t;
    const lastTime = raw[raw.length - 1].t;
    const firstBucket = Math.floor(firstTime / BUCKET_MS) * BUCKET_MS;

    const candles = [];
    let prevClose = null;
    // Seed prevClose from first non-null raw price
    for (const pt of raw) { if (pt.v !== null) { prevClose = pt.v; break; } }
    let ri = 0;

    for (let bucketStart = firstBucket; bucketStart <= lastTime + BUCKET_MS; bucketStart += BUCKET_MS) {
      const bucketEnd = bucketStart + BUCKET_MS;
      const prices = [];

      while (ri < raw.length && raw[ri].t < bucketStart) {
        if (raw[ri].v !== null) prevClose = raw[ri].v;
        ri++;
      }

      while (ri < raw.length && raw[ri].t < bucketEnd) {
        prices.push(raw[ri].v);
        ri++;
      }

      const open = prevClose;
      const close = prices.length > 0 ? prices[prices.length - 1] : prevClose;
      let high = null;
      let low = null;

      for (const p of prices) {
        if (p !== null) {
          high = high === null ? p : Math.max(high, p);
          low = low === null ? p : Math.min(low, p);
        }
      }

      // Fill null open/close from first/last non-null price in bucket
      let o = open, c = close;
      if (o === null) {
        for (const p of prices) { if (p !== null) { o = p; break; } }
      }
      if (c === null) {
        for (let i = prices.length - 1; i >= 0; i--) { if (prices[i] !== null) { c = prices[i]; break; } }
      }

      if (o !== null) { high = high === null ? o : Math.max(high, o); low = low === null ? o : Math.min(low, o); }
      if (c !== null) { high = high === null ? c : Math.max(high, c); low = low === null ? c : Math.min(low, c); }

      if (high !== null) {
        candles.push({ x: bucketStart, o: o, h: high, l: low, c: c });
      }

      prevClose = close;
      if (ri >= raw.length) break;
    }

    // Deduplicate consecutive identical candles
    const deduped = [candles[0]];
    for (let i = 1; i < candles.length; i++) {
      const prev = deduped[deduped.length - 1];
      const cur = candles[i];
      if (cur.o !== prev.o || cur.h !== prev.h || cur.l !== prev.l || cur.c !== prev.c) {
        deduped.push(cur);
      }
    }

    if (deduped.length > 400) {
      const step = Math.ceil(deduped.length / 400);
      return deduped.filter((_, i) => i % step === 0 || i === deduped.length - 1);
    }
    return deduped;
  } catch (e) {
    return [];
  }
}

// ── get YES best bid OHLC candles over full market lifetime ───────────────
function getYesBidSeries(db, ticker) {
  try {
    const snapshots = db.query("SELECT ts, yes, seq FROM snapshots WHERE ticker = ? ORDER BY ts ASC").all(ticker);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? ORDER BY ts ASC").all(ticker);

    const events = [];
    for (const s of snapshots) events.push({ type: 'snapshot', ts: s.ts, yes: s.yes, seq: s.seq });
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
    const raw = [];

    for (const e of events) {
      if (e.type === 'snapshot') {
        book.clear();
        try { for (const [p, q] of JSON.parse(e.yes || "[]")) book.set(p, q); } catch {}
      } else if (e.side === 'yes') {
        const cur = book.get(e.price) || 0;
        const upd = cur + e.delta;
        if (upd <= 0) book.delete(e.price);
        else book.set(e.price, upd);
      }

      let bestBid = null;
      for (const [p, q] of book.entries()) {
        if (q > 0 && (bestBid === null || p > bestBid)) bestBid = p;
      }
      const t = e.ts.includes('T') ? e.ts : e.ts.replace(' ', 'T');
      raw.push({ t: new Date(t.endsWith('Z') ? t : t + 'Z').getTime(), v: bestBid });
    }

    if (raw.length === 0) return [];

    const BUCKET_MS = 30000;
    const firstBucket = Math.floor(raw[0].t / BUCKET_MS) * BUCKET_MS;
    const lastTime = raw[raw.length - 1].t;

    const candles = [];
    let prevClose = null;
    for (const pt of raw) { if (pt.v !== null) { prevClose = pt.v; break; } }
    let ri = 0;

    for (let bucketStart = firstBucket; bucketStart <= lastTime + BUCKET_MS; bucketStart += BUCKET_MS) {
      const bucketEnd = bucketStart + BUCKET_MS;
      const prices = [];

      while (ri < raw.length && raw[ri].t < bucketStart) {
        if (raw[ri].v !== null) prevClose = raw[ri].v;
        ri++;
      }
      while (ri < raw.length && raw[ri].t < bucketEnd) {
        prices.push(raw[ri].v);
        ri++;
      }

      const close = prices.length > 0 ? prices[prices.length - 1] : prevClose;
      let high = null, low = null;
      for (const p of prices) {
        if (p !== null) { high = high === null ? p : Math.max(high, p); low = low === null ? p : Math.min(low, p); }
      }
      let o = prevClose, c = close;
      if (o === null) { for (const p of prices) { if (p !== null) { o = p; break; } } }
      if (c === null) { for (let i = prices.length-1; i >= 0; i--) { if (prices[i] !== null) { c = prices[i]; break; } } }
      if (o !== null) { high = high === null ? o : Math.max(high, o); low = low === null ? o : Math.min(low, o); }
      if (c !== null) { high = high === null ? c : Math.max(high, c); low = low === null ? c : Math.min(low, c); }

      if (high !== null) candles.push({ x: bucketStart, o: o, h: high, l: low, c: c });
      prevClose = close;
      if (ri >= raw.length) break;
    }

    const deduped = [candles[0]];
    for (let i = 1; i < candles.length; i++) {
      const prev = deduped[deduped.length - 1];
      const cur = candles[i];
      if (cur.o !== prev.o || cur.h !== prev.h || cur.l !== prev.l || cur.c !== prev.c) deduped.push(cur);
    }
    if (deduped.length > 400) {
      const step = Math.ceil(deduped.length / 400);
      return deduped.filter((_, i) => i % step === 0 || i === deduped.length - 1);
    }
    return deduped;
  } catch (e) {
    return [];
  }
}

// ── find most significant market change within ±30s of signal ─────────────
// Scans both YES and NO sides. Returns { ts, absChange, price, totalQty, side }
function findMarketChange(db, ticker, signalIso) {
  try {
    const sigMs = new Date(signalIso).getTime();
    const windowMs = 30 * 1000;
    const windowEnd = new Date(sigMs + windowMs).toISOString();

    const snapshots = db.query("SELECT ts, yes, no, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, windowEnd);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, windowEnd);

    const events = [];
    for (const s of snapshots) events.push({ type: 'snapshot', ts: s.ts, yes: s.yes, no: s.no, seq: s.seq });
    for (const d of deltas) events.push({ type: 'delta', ts: d.ts, side: d.side, price: d.price, delta: d.delta, seq: d.seq });

    events.sort((a, b) => {
      const ta = new Date(a.ts).getTime();
      const tb = new Date(b.ts).getTime();
      if (ta !== tb) return ta - tb;
      if (a.seq !== undefined && b.seq !== undefined && a.seq !== b.seq) return a.seq - b.seq;
      if (a.type !== b.type) return a.type === 'snapshot' ? -1 : 1;
      return 0;
    });

    const noBook = new Map();
    const yesBook = new Map();
    let prevTotalQty = 0;
    let bestChange = null;

    for (const e of events) {
      if (e.type === 'snapshot') {
        noBook.clear(); yesBook.clear();
        try { for (const [p, q] of JSON.parse(e.no || "[]")) noBook.set(p, q); } catch {}
        try { for (const [p, q] of JSON.parse(e.yes || "[]")) yesBook.set(p, q); } catch {}
      } else {
        const book = e.side === 'yes' ? yesBook : noBook;
        const cur = book.get(e.price) || 0;
        const upd = cur + e.delta;
        if (upd <= 0) book.delete(e.price);
        else book.set(e.price, upd);
      }

      const eMs = new Date(e.ts).getTime();

      if (eMs >= sigMs - windowMs && eMs <= sigMs + windowMs && e.type === 'delta') {
        // Compute total quantity across both books
        let totalQty = 0;
        let bestNoAsk = null, bestYesBid = null;
        for (const [p, q] of noBook.entries()) {
          if (q > 0) { totalQty += q; if (bestNoAsk === null || p < bestNoAsk) bestNoAsk = p; }
        }
        for (const [p, q] of yesBook.entries()) {
          if (q > 0) { totalQty += q; if (bestYesBid === null || p > bestYesBid) bestYesBid = p; }
        }
        const absChange = Math.abs(totalQty - prevTotalQty);
        if (!bestChange || absChange > bestChange.absChange) {
          const side = e.side;
          const price = side === 'yes' ? bestYesBid : bestNoAsk;
          bestChange = { ts: e.ts, absChange, price, totalQty, side };
        }
        prevTotalQty = totalQty;
      } else {
        let totalQty = 0;
        for (const [, q] of noBook.entries()) { if (q > 0) totalQty += q; }
        for (const [, q] of yesBook.entries()) { if (q > 0) totalQty += q; }
        prevTotalQty = totalQty;
      }
    }
    return bestChange;
  } catch (e) {
    return null;
  }
}

// ── get best YES bid at specific ISO timestamp ──────────────────────────────
function getYesPriceAt(db, ticker, ts) {
  try {
    const snapshots = db.query("SELECT ts, yes, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, ts);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, ts);
    const events = [];
    for (const s of snapshots) events.push({ type: 'snapshot', ts: s.ts, yes: s.yes, seq: s.seq });
    for (const d of deltas) events.push({ type: 'delta', ts: d.ts, side: d.side, price: d.price, delta: d.delta, seq: d.seq });
    events.sort((a, b) => {
      const ta = new Date(a.ts).getTime(), tb = new Date(b.ts).getTime();
      if (ta !== tb) return ta - tb;
      if (a.seq !== undefined && b.seq !== undefined) return a.seq - b.seq;
      return a.type === 'snapshot' ? -1 : 1;
    });
    const book = new Map();
    for (const e of events) {
      if (e.type === 'snapshot') { book.clear(); try { for (const [p,q] of JSON.parse(e.yes||'[]')) book.set(p,q); } catch {} }
      else if (e.side === 'yes') { const cur = book.get(e.price)||0; const upd = cur+e.delta; if (upd<=0) book.delete(e.price); else book.set(e.price, upd); }
    }
    let best = null;
    for (const [p,q] of book.entries()) { if (q>0 && (best===null || p>best)) best = p; }
    return best;
  } catch { return null; }
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
  const resolutions = loadResolutions();
  const signals = parseLogFiles();
  console.log(`Parsed ${signals.length} signals from log files\n`);

  const mediaSources = parseMediaSources();
  console.log(`Loaded ${mediaSources.size} media source mappings from schedule_run.log\n`);

  const formatPriceChange = (s, c, side) => {
    if (s === null || s === undefined) return "n/a";
    const cStr = c !== null && c !== undefined ? `${c}c` : "PENDING";
    const label = side === 'yes' ? '(Y)' : side === 'no' ? '(N)' : '';
    return `${s}c${label} → ${cStr}`;
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

      let changeSide = "—";
      if (db && matchedTicker) {
        signalPrice = getNoPriceAt(db, matchedTicker, signalIso);
        if (mktChange) {
          changePrice = mktChange.price;
          changeSide = mktChange.side || "no";
          // If change was on YES side, also get YES signal price for context
          if (changeSide === 'yes') {
            signalPrice = getYesPriceAt(db, matchedTicker, signalIso);
          }
        }
        const thirtySecMs = 30 * 1000;
        windowStartPrice = getNoPriceAt(db, matchedTicker, new Date(signalTime.getTime() - thirtySecMs).toISOString());
        windowEndPrice = getNoPriceAt(db, matchedTicker, new Date(signalTime.getTime() + thirtySecMs).toISOString());
      }

      // Resolution status from Kalshi
      let resolution = "PENDING";
      let resolutionResult = null;
      if (matchedTicker && resolutions[matchedTicker]) {
        const res = resolutions[matchedTicker];
        if (res.status === "settled" && res.result) {
          resolution = res.result.toUpperCase();
          resolutionResult = res.result;
        }
      }

      results.push({
        session,
        title: slugToTitle.get(session.toLowerCase()) || session,
        mediaSource: mediaSources.get(session) || (session === 'remote' ? 'REMOTE' : session.split('-')[0]),
        word: sig.word,
        target: sig.target,
        ticker: matchedTicker || "",
        suffix: matchedTicker ? matchedTicker.split("-").pop() : "???",
        signalTs: sig.timestamp,
        signalIso: signalIso,
        mktChangeTs: mktChangeVal,
        mktChangeQty: mktChange ? mktChange.absChange : 0,
        deltaMs: deltaMs,
        status: status,
        changeSide,
        noAskSeries: (db && matchedTicker) ? getNoAskSeries(db, matchedTicker) : [],
        yesBidSeries: (db && matchedTicker) ? getYesBidSeries(db, matchedTicker) : [],
        signalPrice,
        changePrice,
        windowStartPrice,
        windowEndPrice,
        deltaCount: 0,
        resolution,
        resolutionResult,
      });
      if (db && matchedTicker) {
        stats.matched++;
        const dc = db.query("SELECT COUNT(*) as c FROM deltas WHERE ticker = ?").get(matchedTicker);
        results[results.length - 1].deltaCount = dc ? dc.c : 0;
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
    book_delta: 8,
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
      "Book Δ".padEnd(col.book_delta),
      "Delta".padEnd(col.delta),
      "Status".padEnd(col.status),
    ].join(" | ")
  );
  console.log("-".repeat(205));

  for (const r of results) {
    try {
      console.log(
        [
          (r.title.length > col.title ? r.title.slice(0, col.title - 3) + "..." : r.title).padEnd(col.title),
          r.word.padEnd(col.word),
          r.suffix.padEnd(col.ticker_suffix),
          r.signalTs.padEnd(col.signal),
          (r.mktChangeTs === "—" ? "—" : r.mktChangeTs.slice(0, 26)).padEnd(col.mkt_change),
          formatPriceChange(r.signalPrice, r.changePrice, r.changeSide).padEnd(col.price_change),
          formatPriceChange(r.windowStartPrice, r.windowEndPrice).padEnd(col.window_change),
          String(r.mktChangeQty).padEnd(col.qty_change),
          String(r.deltaCount).padEnd(col.book_delta),
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

  const resolvedYes = results.filter(r => r.resolution === "YES").length;
  const resolvedNo = results.filter(r => r.resolution === "NO").length;
  const resolvedPending = results.filter(r => r.resolution === "PENDING").length;
  const resolvedTotal = resolvedYes + resolvedNo;

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
  console.log(`\nResolved YES:                      ${resolvedYes}`);
  console.log(`Resolved NO:                       ${resolvedNo}`);
  console.log(`Pending resolution:                ${resolvedPending}`);

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
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.1.0/dist/chartjs-plugin-annotation.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial@0.2.1/dist/chartjs-chart-financial.min.js"></script>
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
  .resolved-yes { color: #3fb950; font-weight: 700; }
  .resolved-no { color: #f85149; font-weight: 700; }
  .resolved-pending { color: #484f58; }
  .event-title a { color: #c9d1d9; text-decoration: none; }
  .event-title a:hover { color: #58a6ff; text-decoration: underline; }
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
    <div>
      <div class="chart-title" id="chart-title">Market Liquidity</div>
      <div id="chart-subtitle" style="color: #8b949e">NO Best Ask — full market lifetime</div>
    </div>
    <div>
      <button id="chart-toggle-no" style="background:#f85149;color:#fff;border:none;border-radius:4px 0 0 4px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:700">NO</button><button id="chart-toggle-yes" style="background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:0 4px 4px 0;padding:4px 10px;font-size:11px;cursor:pointer">YES</button>
    </div>
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
  <div class="stat"><div class="label">Resolved YES</div><div class="value green">${resolvedYes}</div></div>
  <div class="stat"><div class="label">Resolved NO</div><div class="value red">${resolvedNo}</div></div>
  <div class="stat"><div class="label">Pending</div><div class="value" style="color: #8b949e">${resolvedPending}</div></div>
</div>

<div class="filter-bar">
  <input type="text" id="filter" placeholder="Filter by session or word..." />
  <select id="statusFilter">
    <option value="all">All</option>
    <option value="BEFORE">BEFORE only</option>
    <option value="AFTER">AFTER only</option>
    <option value="NO_CHANGE">NO_CHANGE only</option>
  </select>
  <select id="resolutionFilter">
    <option value="all">All resolutions</option>
    <option value="YES">YES only</option>
    <option value="NO">NO only</option>
    <option value="PENDING">PENDING only</option>
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
    <th data-col="9">Book Δ</th>
    <th data-col="10">Delta (cs)</th>
    <th data-col="11">Human</th>
    <th data-col="12">Status</th>
    <th data-col="13">Resolved</th>
  </tr>
</thead>
<tbody id="tbody">
`;

  for (const r of results) {
    const suffix = r.ticker ? r.ticker.split("-").pop() : "???";
    const cs = r.deltaMs !== null ? (r.deltaMs / 10).toFixed(0) : "...";
    const csSign = r.deltaMs !== null ? (r.deltaMs >= 0 ? "+" : "") : "";
    const cls = r.status.toLowerCase();
    
    // Serialize NO ask and YES bid data for the row
    const noAskData = JSON.stringify(r.noAskSeries);
    const yesBidData = JSON.stringify(r.yesBidSeries);
    const humanDelta = r.status === "NO_CHANGE" ? "—" : formatDeltaHuman(r.deltaMs);
    
    const mktChangeStr = r.mktChangeTs === "—" ? "—" : r.mktChangeTs.slice(0, 26);
    const mktChangeTimeAttr = r.mktChangeTs === "—" ? 999999999999 : new Date(r.mktChangeTs).getTime();
    
    // Sorting values
    const deltaSortVal = r.deltaMs !== null ? r.deltaMs : 999999999999;
    const priceChangeStr = formatPriceChange(r.signalPrice, r.changePrice, r.changeSide);
    const priceDiff = (r.signalPrice !== null && r.changePrice !== null) ? (r.signalPrice - r.changePrice) : -999;
    const windowChangeStr = formatPriceChange(r.windowStartPrice, r.windowEndPrice);
    const windowDiff = (r.windowStartPrice !== null && r.windowEndPrice !== null) ? (r.windowStartPrice - r.windowEndPrice) : -999;

    const resCls = r.resolution === "YES" ? "resolved-yes" : r.resolution === "NO" ? "resolved-no" : "resolved-pending";

    html += `<tr data-session="${escH(r.session)}" data-word="${escH(r.word)}" data-status="${r.status}" data-resolution="${r.resolution}"
                data-noask='${noAskData}' data-yes='${yesBidData}' data-signal="${r.signalIso}" data-closeout="${r.mktChangeTs}"
                data-human="${escH(humanDelta)}">
  <td class="thumb-cell"><span class="thumb-icon">📈</span></td>
  <td class="session-info" title="${escH(r.session)}">
    <div class="source-id">${escH(r.mediaSource)}</div>
    <div class="event-title"><a href="/session/${escH(r.session)}">${escH(r.title)}</a></div>
  </td>
  <td class="word">${escH(r.word)}</td>
  <td class="sfx">${escH(suffix)}</td>
  <td data-time="${new Date(r.signalIso).getTime()}">${escH(r.signalTs)}</td>
  <td data-time="${mktChangeTimeAttr}">${escH(mktChangeStr)}</td>
  <td data-time="${priceDiff}" style="color: #c9d1d9">${escH(priceChangeStr)}</td>
  <td data-time="${windowDiff}" style="color: #c9d1d9">${escH(windowChangeStr)}</td>
  <td data-time="${r.mktChangeQty}" style="color: #d2a8ff">${r.mktChangeQty || '—'}</td>
  <td data-time="${r.deltaCount}" style="color: ${r.deltaCount === 0 ? '#484f58' : r.deltaCount < 10 ? '#d29922' : r.deltaCount < 100 ? '#c9d1d9' : '#3fb950'}">${r.deltaCount}</td>
  <td class="delta" data-time="${deltaSortVal}"><span class="delta-val ${cls}">${csSign}${cs}</span></td>
  <td class="delta ${cls}" data-time="${deltaSortVal}">${humanDelta}</td>
  <td class="${cls}">${r.status}</td>
  <td class="${resCls}">${r.resolution}</td>
</tr>\n`;
  }

  html += `</tbody>
</table>

<script>
const tbody = document.getElementById('tbody');
const rows = [...tbody.querySelectorAll('tr')];
const filter = document.getElementById('filter');
const statusFilter = document.getElementById('statusFilter');
const resolutionFilter = document.getElementById('resolutionFilter');
const chartContainer = document.getElementById('chart-container');
const chartTitle = document.getElementById('chart-title');
const ctx = document.getElementById('volChart').getContext('2d');

let myChart = null;

function applyFilters() {
  const q = filter.value.toLowerCase();
  const sf = statusFilter.value;
  const rf = resolutionFilter.value;
  for (const row of rows) {
    const session = row.dataset.session;
    const word = row.dataset.word;
    const status = row.dataset.status;
    const resolution = row.dataset.resolution;
    const textMatch = !q || session.includes(q) || word.includes(q);
    const statusMatch = sf === 'all' || status === sf;
    const resMatch = rf === 'all' || resolution === rf;
    row.style.display = textMatch && statusMatch && resMatch ? '' : 'none';
  }
}
filter.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);
resolutionFilter.addEventListener('change', applyFilters);

	// Chart state
	let currentSide = 'no';
	let currentRow = null;
	const toggleNo = document.getElementById('chart-toggle-no');
	const toggleYes = document.getElementById('chart-toggle-yes');

	function buildAnnotations(sigTime) {
	  const annotations = {};
	  if (!isNaN(sigTime)) {
	    const ws = sigTime - 120000;
	    const we = sigTime + 120000;
	    annotations.signalLine = {
	      type: 'line', xMin: sigTime, xMax: sigTime,
	      borderColor: '#3fb950', borderWidth: 2,
	      label: { display: true, content: 'SIGNAL', position: 'start',
	               backgroundColor: '#3fb950', color: '#fff', font: { size: 10 } }
	    };
	    annotations.windowBox = {
	      type: 'box', xMin: ws, xMax: we,
	      backgroundColor: 'rgba(88, 166, 255, 0.06)',
	      borderColor: 'rgba(88, 166, 255, 0.2)', borderWidth: 0,
	      label: { display: true, content: '±2m window', position: 'start',
	               color: '#58a6ff', font: { size: 9 } }
	    };
	  }
	  return annotations;
	}

	function drawChart() {
	  if (!currentRow) return;
	  const existingChart = Chart.getChart(ctx);
	  if (existingChart) existingChart.destroy();

	  const side = currentSide;
	  const attr = side === 'no' ? 'noask' : 'yes';
	  const data = JSON.parse(currentRow.dataset[attr] || '[]');
	  if (data.length === 0) { chartContainer.style.display = 'none'; return; }

	  const sigTime = new Date(currentRow.dataset.signal).getTime();
	  const windowStart = sigTime - 120000;
	  const windowEnd = sigTime + 120000;
	  const times = data.map(d => d.x);
	  const xMin = Math.min(...times, windowStart);
	  const xMax = Math.max(...times, windowEnd);

	  const isNo = side === 'no';
	  const label = isNo ? 'NO Best Ask' : 'YES Best Bid';
	  const color = isNo ? '#f85149' : '#3fb950';

	  chartTitle.innerText = label + ': ' + currentRow.dataset.word;
	  const sub = document.getElementById('chart-subtitle');
	  sub.innerText = 'Lead/Lag: ' + currentRow.dataset.human;
	  sub.style.color = currentRow.dataset.status === 'BEFORE' ? '#3fb950' : '#f85149';

	  toggleNo.style.background = isNo ? '#f85149' : '#161b22';
	  toggleNo.style.color = '#fff';
	  toggleNo.style.fontWeight = isNo ? '700' : '400';
	  toggleYes.style.background = isNo ? '#161b22' : '#3fb950';
	  toggleYes.style.color = '#fff';
	  toggleYes.style.fontWeight = isNo ? '400' : '700';

	  myChart = new Chart(ctx, {
	    type: 'candlestick',
	    data: { datasets: [{ label: label, data: data, borderColor: color, backgroundColor: color }] },
	    options: {
	      responsive: true, maintainAspectRatio: false,
	      plugins: { legend: { display: false }, tooltip: { enabled: true },
	                 annotation: { annotations: buildAnnotations(sigTime) } },
	      elements: { candlestick: { upColor: '#3fb950', upBorderColor: '#3fb950',
	                                 downColor: '#f85149', downBorderColor: '#f85149',
	                                 borderWidth: 0.5, bodyWidth: 12 } },
	      scales: {
	        x: { display: true, type: 'time', min: xMin, max: xMax,
	             time: { unit: 'minute', displayFormats: { minute: 'HH:mm' } },
	             grid: { color: '#30363d', borderDash: [2, 2] },
	             ticks: { color: '#8b949e', font: { size: 9 } } },
	        y: { display: true, min: 1, max: 99, grid: { color: '#30363d' },
	             ticks: { color: '#8b949e', font: { size: 9 },
	                      callback: (v) => v !== null ? v + 'c' : '' },
	             title: { display: true, text: isNo ? 'NO Ask (cents)' : 'YES Bid (cents)',
	                      color: '#8b949e', font: { size: 10 } } }
	      }
	    }
	  });
	}

	toggleNo.addEventListener('click', () => { currentSide = 'no'; drawChart(); });
	toggleYes.addEventListener('click', () => { currentSide = 'yes'; drawChart(); });

	// Tooltip Chart Logic
	for (const row of rows) {
	  row.addEventListener('mouseenter', (e) => {
	    currentRow = row;
	    chartContainer.style.display = 'block';
	    const move = (ev) => {
	      chartContainer.style.left = (ev.clientX + 30) + 'px';
	      chartContainer.style.top = (ev.clientY - 250) + 'px';
	    };
	    move(e);
	    row.onmousemove = move;
	    drawChart();
	  });

	  row.addEventListener('mouseleave', () => {
	    chartContainer.style.display = 'none';
	    row.onmousemove = null;
	    currentRow = null;
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
