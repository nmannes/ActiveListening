const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");

function marketsDir() {
  return path.join(DATA_DIR, "data", "markets");
}

function s3Dir() {
  return path.join(DATA_DIR, "s3");
}

function marketTrackingDir() {
  return path.join(DATA_DIR, "market_tracking");
}

const CACHE_DIR = process.env.KALSHI_CACHE_DIR || path.join(DATA_DIR, "cache");

function loadCacheTitles() {
  const slugToTitle = new Map();
  const cacheFiles = ["matched_markets.json", "unmatched_markets.json", "manual_matches.json"];
  for (const file of cacheFiles) {
    const p = path.join(CACHE_DIR, file);
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const entry of data) {
        const market = entry.market || entry;
        if (market.slug && market.title) {
          slugToTitle.set(market.slug.toLowerCase(), market.title);
        }
      }
    } catch (_) {}
  }
  return slugToTitle;
}

const LOG_TYPES = ["runtime", "signals", "orderbook"];

/**
 * List all markets from s3/ sessions, market_tracking DBs, and data/markets/.
 */
function listMarkets() {
  const slugMap = new Map(); // slug → { counts, lastActivity, sessions }

  // 1. Scan s3/ for session directories: {slug}_{YYYY-MM-DD_HH-MM-SS}
  const s3 = s3Dir();
  const sessionRe = /^(.+)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/;
  if (fs.existsSync(s3)) {
    const entries = fs.readdirSync(s3, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(sessionRe);
      if (!match) continue;
      const slug = match[1];
      const stat = fs.statSync(path.join(s3, entry.name));
      const rec = slugMap.get(slug) || { counts: {}, lastActivity: null, sessions: [] };
      rec.sessions.push(entry.name);
      if (!rec.lastActivity || stat.mtime > rec.lastActivity) rec.lastActivity = stat.mtime;

      // Check deepgram_responses count
      const dgDir = path.join(s3, entry.name, "deepgram_responses");
      if (fs.existsSync(dgDir)) {
        try {
          const dgFiles = fs.readdirSync(dgDir).filter(f => f.startsWith("dg_") && f.endsWith(".json"));
          rec.counts.signals = (rec.counts.signals || 0) + dgFiles.length;
        } catch (_) {}
      }
      slugMap.set(slug, rec);
    }
  }

  // 2. Scan market_tracking/*.db
  const mktDir = marketTrackingDir();
  if (fs.existsSync(mktDir)) {
    const entries = fs.readdirSync(mktDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".db")) continue;
      const slug = entry.name.replace(/\.db$/, "");
      const stat = fs.statSync(path.join(mktDir, entry.name));
      const rec = slugMap.get(slug) || { counts: {}, lastActivity: null, sessions: [] };
      rec.counts.orderbook = (rec.counts.orderbook || 0) + stat.size;
      if (!rec.lastActivity || stat.mtime > rec.lastActivity) rec.lastActivity = stat.mtime;
      slugMap.set(slug, rec);
    }
  }

  // 3. Scan data/markets/ for per-market logs
  const dmDir = marketsDir();
  if (fs.existsSync(dmDir)) {
    const entries = fs.readdirSync(dmDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      const rec = slugMap.get(slug) || { counts: {}, lastActivity: null, sessions: [] };
      for (const type of LOG_TYPES) {
        const logPath = path.join(dmDir, slug, `${type}.log`);
        if (fs.existsSync(logPath)) {
          const stat = fs.statSync(logPath);
          rec.counts[type] = (rec.counts[type] || 0) + stat.size;
          if (!rec.lastActivity || stat.mtime > rec.lastActivity) rec.lastActivity = stat.mtime;
        }
      }
      slugMap.set(slug, rec);
    }
  }

  // 4. Load titles from cache
  const titles = loadCacheTitles();

  // Build result array
  const markets = [];
  for (const [slug, rec] of slugMap.entries()) {
    const hasOrderbook = (rec.counts.orderbook || 0) > 0;
    const hasSessions = (rec.sessions && rec.sessions.length > 0);
    const hasTitle = titles.has(slug);

    markets.push({
      slug,
      title: titles.get(slug) || rec.title || slug,
      eventStartTime: rec.eventStartTime || null,
      keywords: rec.keywords || {},
      counts: rec.counts,
      sessionCount: rec.sessions ? rec.sessions.length : 0,
      eventCount: rec.eventCount || 0,
      lastActivity: rec.lastActivity ? rec.lastActivity.toISOString() : null,
      hasRun: hasSessions,
      hasOrderbook,
      hasTitle,
    });
  }

  markets.sort((a, b) => {
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return b.lastActivity.localeCompare(a.lastActivity);
  });

  return markets;
}

/**
 * Get the manifest for a specific market.
 */
function getMarketManifest(slug) {
  const mfPath = path.join(marketsDir(), slug, "manifest.json");
  if (!fs.existsSync(mfPath)) return null;
  return JSON.parse(fs.readFileSync(mfPath, "utf8"));
}

/**
 * Read the last `maxLines` lines from a file efficiently by reading
 * backwards from the end in chunks. Falls back to full read for small files.
 */
function readLastLines(filePath, maxLines) {
  const CHUNK = 65536;
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) return [];

    const lines = [];
    let pos = stat.size;
    let leftover = "";

    while (pos > 0 && lines.length < maxLines) {
      const readSize = Math.min(CHUNK, pos);
      pos -= readSize;
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, pos);
      const chunk = buf.toString("utf8") + leftover;
      const parts = chunk.split("\n");
      leftover = parts.shift();

      // Prepend non-empty lines (reading backwards, so reverse)
      for (let i = parts.length - 1; i >= 0; i--) {
        if (lines.length >= maxLines) break;
        const line = parts[i].trim();
        if (line) lines.unshift({ text: line });
      }
    }

    // Any remaining leftover at the start
    if (leftover.trim() && lines.length < maxLines) {
      lines.unshift({ text: leftover.trim() });
    }

    return lines;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Get log lines for a market.
 *
 * @param {string} slug - market slug
 * @param {object} opts
 * @param {string} opts.type - "runtime" | "signals" | "orderbook" | "all"
 * @param {number} opts.lines - max lines to return (default 5000)
 * @param {number} opts.offset - offset for pagination
 * @param {string} opts.search - optional search string
 * @returns {{ slug, title, types, total, offset, limit, logs }}
 */
async function getMarketLogs(slug, opts = {}) {
  const limit = Math.min(parseInt(opts.lines) || 5000, 100000);
  const offset = parseInt(opts.offset) || 0;
  const search = opts.search || "";
  const type = opts.type || "all";

  const mfDir = path.join(marketsDir(), slug);
  if (!fs.existsSync(mfDir)) return null;

  const manifest = getMarketManifest(slug) || {};

  const typesToRead = type === "all" ? LOG_TYPES : [type].filter(t => LOG_TYPES.includes(t));

  const needsFullScan = !!search || offset > 0;
  const fetchPerType = needsFullScan ? limit + offset : Math.ceil(limit / typesToRead.length) + 100;

  // Gather lines
  const allLines = [];
  for (const t of typesToRead) {
    const logPath = path.join(mfDir, `${t}.log`);
    if (!fs.existsSync(logPath)) continue;

    if (needsFullScan) {
      // Full scan required for search or pagination
      const rl = readline.createInterface({
        input: fs.createReadStream(logPath),
        crlfDelay: Infinity,
      });
      let lineNum = 0;
      for await (const line of rl) {
        if (!line.trim()) continue;
        lineNum++;
        allLines.push({ type: t, lineNum, text: line });
      }
    } else {
      // Fast path: read only the tail
      const tailLines = readLastLines(logPath, fetchPerType);
      for (let i = 0; i < tailLines.length; i++) {
        allLines.push({ type: t, lineNum: i + 1, text: tailLines[i].text });
      }
    }
  }

  // Sort by time if parseable
  allLines.sort((a, b) => {
    const ta = extractTime(a.text);
    const tb = extractTime(b.text);
    if (ta && tb) return ta - tb;
    if (ta) return -1;
    if (tb) return 1;
    if (a.type !== b.type) return LOG_TYPES.indexOf(a.type) - LOG_TYPES.indexOf(b.type);
    return a.lineNum - b.lineNum;
  });

  // Apply search filter
  const filtered = search
    ? allLines.filter(l => l.text.toLowerCase().includes(search.toLowerCase()))
    : allLines;

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  return {
    slug,
    title: manifest.title || slug,
    types: typesToRead,
    total,
    offset,
    limit,
    logs: page.map(l => ({ type: l.type, text: l.text })),
  };
}

function extractTime(line) {
  try {
    const obj = JSON.parse(line);
    if (obj.time) {
      const ts = Date.parse(obj.time);
      return isNaN(ts) ? null : ts;
    }
  } catch (_) { /* not JSON */ }
  return null;
}

module.exports = { listMarkets, getMarketLogs, getMarketManifest, marketsDir, LOG_TYPES };
