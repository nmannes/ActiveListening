// lib/signal_analysis.js
// Shared analysis functions used by signal_vs_no_closeout.js and market_ui.js
const fs = require("fs");
const path = require("path");
const { Database } = require("bun:sqlite");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");
const MARKET_TRACKING_DIR = path.join(DATA_DIR, "market_tracking");
const SCHEDULE_LOG = path.join(DATA_DIR, "schedule_run.log");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const RESOLUTIONS_PATH = path.join(CACHE_DIR, "resolutions.json");

const LOG_FILES = [
  path.join(DATA_DIR, "signals.log"),
  path.join(DATA_DIR, "app-prod.log"),
];

const CACHE_FILES = [
  path.join(CACHE_DIR, "matched_markets.json"),
  path.join(CACHE_DIR, "unmatched_markets.json"),
  path.join(CACHE_DIR, "manual_matches.json"),
];

// ── strip ANSI escape codes ─────────────────────────────────────────────────
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── parse log files ─────────────────────────────────────────────────────────
function parseLogFiles(filterSlug) {
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

            const session = (j.sessionId || "unknown").toLowerCase();
            if (filterSlug && session !== filterSlug) continue;

            signals.push({
              timestamp,
              tz: "+0000",
              session,
              word,
              target,
              speaker: "?",
            });
          }
          continue;
        } catch (e) {}
      }

      const content = stripAnsi(line);

      const re1 = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) ([+-]\d{4})\].*?\[(\S+?)\] SIGNAL:\s+(.+?)\s+→\s+(\S+)/;
      const m1 = content.match(re1);
      if (m1) {
        const session = m1[3].toLowerCase().replace(/[\[\]]/g, "");
        if (filterSlug && session !== filterSlug) continue;
        signals.push({
          timestamp: m1[1],
          tz: m1[2],
          session,
          word: m1[4].trim().toLowerCase(),
          target: m1[5].trim(),
          speaker: "?",
        });
        continue;
      }

      const re2 = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s*(?:[+-]\d{4})?\s*\]\s*\[(\S+?)\]\[SIGNAL\] Detected for speaker (\d+): "(.*?)"/;
      const m2 = content.match(re2);
      if (m2) {
        const session = m2[2].toLowerCase().replace(/[\[\]]/g, "");
        if (filterSlug && session !== filterSlug) continue;
        signals.push({
          timestamp: m2[1],
          tz: "+0000",
          session,
          speaker: m2[3],
          word: m2[4].trim().toLowerCase(),
          target: "undefined",
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
function fuzzyMatchTicker(keyword, tickers) {
  const kw = keyword.toUpperCase().replace(/[^A-Z]/g, "");

  const prefix4 = kw.slice(0, 4);
  for (const t of tickers) {
    const suffix = t.split("-").pop();
    if (suffix === prefix4) return t;
  }

  const prefix3 = kw.slice(0, 3);
  for (const t of tickers) {
    const suffix = t.split("-").pop();
    if (suffix === prefix3) return t;
  }

  for (const t of tickers) {
    const suffix = t.split("-").pop();
    if (suffix.length >= 3 && kw.startsWith(suffix)) return t;
    if (kw.length >= 3 && suffix.startsWith(kw.slice(0, Math.min(4, kw.length)))) return t;
  }

  const specialMap = {
    "ARTIFICIALINTELLIGENCE": "AI",
    "MVP": "MVP", "AI": "AI", "FDA": "FDA", "TSA": "TSA",
    "ICE": "ICE", "EV": "EV", "NIO": "NIO", "MSG": "MSG",
    "DJ": "DJ", "JD": "JD",
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

// ── DB helpers ──────────────────────────────────────────────────────────────

function openDb(session) {
  const dbPath = path.join(MARKET_TRACKING_DIR, `${session}.db`);
  if (!fs.existsSync(dbPath)) return null;
  try {
    return new Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

function getTickers(db) {
  try {
    const rows = db.query("SELECT DISTINCT ticker FROM snapshots").all();
    return rows.map((r) => r.ticker);
  } catch {
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
        try { for (const [p, q] of JSON.parse(e.no || "[]")) book.set(p, q); } catch {}
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

    const BUCKET_MS = 30000;
    const firstTime = raw[0].t;
    const lastTime = raw[raw.length - 1].t;
    const firstBucket = Math.floor(firstTime / BUCKET_MS) * BUCKET_MS;

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

      const open = prevClose;
      const close = prices.length > 0 ? prices[prices.length - 1] : prevClose;
      let high = null, low = null;
      for (const p of prices) {
        if (p !== null) { high = high === null ? p : Math.max(high, p); low = low === null ? p : Math.min(low, p); }
      }
      let o = open, c = close;
      if (o === null) { for (const p of prices) { if (p !== null) { o = p; break; } } }
      if (c === null) { for (let i = prices.length - 1; i >= 0; i--) { if (prices[i] !== null) { c = prices[i]; break; } } }
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

// ── get YES best bid OHLC candles ──────────────────────────────────────────
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
      if (c === null) { for (let i = prices.length - 1; i >= 0; i--) { if (prices[i] !== null) { c = prices[i]; break; } } }
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

// ── get best price at specific ISO timestamp ────────────────────────────────
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

function getNoPriceAt(db, ticker, ts) {
  try {
    const snapshots = db.query("SELECT ts, no, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, ts);
    const deltas = db.query("SELECT ts, side, price, delta, seq FROM deltas WHERE ticker = ? AND ts <= ? ORDER BY ts ASC").all(ticker, ts);
    const events = [];
    for (const s of snapshots) events.push({ type: 'snapshot', ts: s.ts, no: s.no, seq: s.seq });
    for (const d of deltas) events.push({ type: 'delta', ts: d.ts, side: d.side, price: d.price, delta: d.delta, seq: d.seq });
    events.sort((a, b) => {
      const ta = new Date(a.ts).getTime(), tb = new Date(b.ts).getTime();
      if (ta !== tb) return ta - tb;
      if (a.seq !== undefined && b.seq !== undefined) return a.seq - b.seq;
      return a.type === 'snapshot' ? -1 : 1;
    });
    const book = new Map();
    for (const e of events) {
      if (e.type === 'snapshot') { book.clear(); try { for (const [p,q] of JSON.parse(e.no||'[]')) book.set(p,q); } catch {} }
      else if (e.side === 'no') { const cur = book.get(e.price)||0; const upd = cur+e.delta; if (upd<=0) book.delete(e.price); else book.set(e.price, upd); }
    }
    let bestPrice = null;
    for (const [p, q] of book.entries()) { if (q > 0 && (bestPrice === null || p < bestPrice)) bestPrice = p; }
    return bestPrice;
  } catch (e) { return null; }
}

// ── timestamp parsing ───────────────────────────────────────────────────────
function parseDbTs(ts) {
  return new Date(ts);
}

function parseSignalTs(ts, tz) {
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

// ── formatting ──────────────────────────────────────────────────────────────
function formatDelta(ms) {
  if (ms === null || ms === undefined) return "n/a";
  const cs = ms / 10;
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

function formatPriceChange(s, c, side) {
  if (s === null || s === undefined) return "n/a";
  const cStr = c !== null && c !== undefined ? `${c}c` : "PENDING";
  const label = side === 'yes' ? '(Y)' : side === 'no' ? '(N)' : '';
  return `${s}c${label} → ${cStr}`;
}

// ── shared session analysis ────────────────────────────────────────────────

/**
 * Analyze signals vs orderbook for a session slug.
 * Returns signals with market change analysis and per-ticker summaries.
 * @param {string} slug - session slug
 * @returns {{ signals: Array, tickerSummaries: Array, stats: Object, tickers: Array }}
 */
function analyzeSession(slug) {
  const resolutions = loadResolutions();
  const signals = parseLogFiles(slug);
  const db = openDb(slug);
  const tickers = db ? getTickers(db) : [];

  // Deduplicate signals by timestamp
  const seen = new Set();
  const uniqueSignals = [];
  for (const sig of signals) {
    if (!seen.has(sig.timestamp)) {
      seen.add(sig.timestamp);
      uniqueSignals.push(sig);
    }
  }

  // Analyze each signal
  const tickerSet = new Set();
  const results = [];
  for (const sig of uniqueSignals) {
    let matchedTicker = null;
    if (tickers.length > 0) {
      matchedTicker = fuzzyMatchTicker(sig.word, tickers);
    }
    if (matchedTicker) tickerSet.add(matchedTicker);

    const signalTime = parseSignalTs(sig.timestamp, sig.tz);
    const signalIso = signalTime.toISOString();

    const mktChange = (db && matchedTicker) ? findMarketChange(db, matchedTicker, signalIso) : null;
    const mktChangeTs = mktChange ? mktChange.ts : null;
    const mktChangeTime = mktChangeTs ? new Date(mktChangeTs) : null;

    let deltaMs = null;
    let status = "NO_CHANGE";
    if (mktChangeTime) {
      deltaMs = mktChangeTime.getTime() - signalTime.getTime();
      status = deltaMs > 0 ? "BEFORE" : "AFTER";
    }

    let signalPrice = null;
    let changePrice = null;
    let changeSide = "—";
    if (db && matchedTicker) {
      signalPrice = getNoPriceAt(db, matchedTicker, signalIso);
      if (mktChange) {
        changePrice = mktChange.price;
        changeSide = mktChange.side || "no";
        if (changeSide === "yes") {
          signalPrice = getYesPriceAt(db, matchedTicker, signalIso);
        }
      }
    }

    let resolution = "PENDING";
    let resolutionResult = null;
    if (matchedTicker && resolutions[matchedTicker]) {
      const r = resolutions[matchedTicker];
      if (r.status === "settled" && r.result) {
        resolution = r.result.toUpperCase();
        resolutionResult = r.result;
      }
    }

    const suffix = matchedTicker ? matchedTicker.split("-").pop() : "???";

    results.push({
      session: slug,
      word: sig.word,
      ticker: matchedTicker || null,
      suffix,
      signalTs: sig.timestamp,
      signalIso,
      mktChangeTs: mktChangeTs || null,
      mktChangeQty: mktChange ? mktChange.absChange : 0,
      deltaMs,
      deltaHuman: formatDeltaHuman(deltaMs),
      deltaCs: deltaMs !== null ? (deltaMs / 10).toFixed(0) : null,
      status,
      changeSide,
      changePrice,
      signalPrice,
      resolution,
      resolutionResult,
      noAskSeries: (db && matchedTicker) ? getNoAskSeries(db, matchedTicker) : [],
      yesBidSeries: (db && matchedTicker) ? getYesBidSeries(db, matchedTicker) : [],
    });
  }

  results.sort((a, b) => new Date(b.signalIso).getTime() - new Date(a.signalIso).getTime());

  // Summary stats
  const beforeCount = results.filter(r => r.status === "BEFORE").length;
  const afterCount = results.filter(r => r.status === "AFTER").length;
  const noChangeCount = results.filter(r => r.status === "NO_CHANGE").length;
  const resolvedYes = results.filter(r => r.resolution === "YES").length;
  const resolvedNo = results.filter(r => r.resolution === "NO").length;
  const resolvedPending = results.filter(r => r.resolution === "PENDING").length;

  const beforeDeltas = results.filter(r => r.status === "BEFORE" && r.deltaMs !== null).map(r => r.deltaMs);
  const avgLeadMs = beforeDeltas.length ? beforeDeltas.reduce((a, b) => a + b, 0) / beforeDeltas.length : 0;
  const medianLeadMs = beforeDeltas.length ? [...beforeDeltas].sort((a, b) => a - b)[Math.floor(beforeDeltas.length / 2)] : 0;

  // Per-ticker summaries
  const tickerSummaries = [];
  for (const ticker of tickerSet) {
    const tickerResults = results.filter(r => r.ticker === ticker);
    const tickerRes = resolutions[ticker];
    let tickerResolution = "PENDING";
    if (tickerRes && tickerRes.status === "settled" && tickerRes.result) {
      tickerResolution = tickerRes.result.toUpperCase();
    }
    tickerSummaries.push({
      ticker,
      suffix: ticker.split("-").pop(),
      resolution: tickerResolution,
      signalCount: tickerResults.length,
      noAskSeries: (db ? getNoAskSeries(db, ticker) : []),
      yesBidSeries: (db ? getYesBidSeries(db, ticker) : []),
    });
  }

  if (db) db.close();

  return {
    signals: results,
    tickerSummaries,
    tickers: [...tickerSet],
    stats: {
      totalSignals: results.length,
      uniqueWords: new Set(results.map(r => r.word)).size,
      beforeCount, afterCount, noChangeCount,
      resolvedYes, resolvedNo, resolvedPending,
      avgLeadMs, avgLeadHuman: formatDeltaHuman(avgLeadMs),
      medianLeadMs, medianLeadHuman: formatDeltaHuman(medianLeadMs),
    },
  };
}

module.exports = {
  DATA_DIR, MARKET_TRACKING_DIR, CACHE_DIR, RESOLUTIONS_PATH,
  LOG_FILES, CACHE_FILES,
  stripAnsi, parseLogFiles,
  loadMarketTitles, loadResolutions,
  fuzzyMatchTicker,
  openDb, getTickers,
  getNoAskSeries, getYesBidSeries,
  findMarketChange,
  getYesPriceAt, getNoPriceAt,
  parseDbTs, parseSignalTs,
  parseMediaSources,
  formatDelta, formatDeltaHuman, formatPriceChange,
  analyzeSession,
};
