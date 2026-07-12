const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");

function marketsDir() {
  return path.join(DATA_DIR, "data", "markets");
}

const LOG_TYPES = ["runtime", "signals", "orderbook"];

/**
 * List all markets that have a data/markets/<slug>/ folder with a manifest.
 * Returns markets sorted by most recent activity first.
 */
function listMarkets() {
  const dir = marketsDir();
  if (!fs.existsSync(dir)) return [];

  const markets = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const mfPath = path.join(dir, slug, "manifest.json");
    if (!fs.existsSync(mfPath)) continue;

    let manifest = {};
    try {
      manifest = JSON.parse(fs.readFileSync(mfPath, "utf8"));
    } catch (_) { /* skip unparseable manifests */ }

    // Compute log counts and latest activity
    const counts = {};
    let lastActivity = null;
    for (const type of LOG_TYPES) {
      const logPath = path.join(dir, slug, `${type}.log`);
      if (fs.existsSync(logPath)) {
        const stat = fs.statSync(logPath);
        counts[type] = stat.size;
        if (!lastActivity || stat.mtime > lastActivity) {
          lastActivity = stat.mtime;
        }
      } else {
        counts[type] = 0;
      }
    }

    // Also check events.jsonl
    const eventsPath = path.join(dir, slug, "events.jsonl");
    let eventCount = 0;
    if (fs.existsSync(eventsPath)) {
      const stat = fs.statSync(eventsPath);
      eventCount = stat.size;
      if (!lastActivity || stat.mtime > lastActivity) {
        lastActivity = stat.mtime;
      }
    }

    markets.push({
      slug,
      title: manifest.title || slug,
      eventStartTime: manifest.eventStartTime || null,
      keywords: manifest.keywords || {},
      counts,
      eventCount,
      lastActivity: lastActivity ? lastActivity.toISOString() : null,
    });
  }

  // Sort by lastActivity descending (most recent first)
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

  // Determine which log types to read
  const typesToRead = type === "all" ? LOG_TYPES : [type].filter(t => LOG_TYPES.includes(t));

  // Gather all lines with their type tag
  const allLines = [];
  for (const t of typesToRead) {
    const logPath = path.join(mfDir, `${t}.log`);
    if (!fs.existsSync(logPath)) continue;

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
  }

  // Sort by time if parseable, otherwise preserve file order
  allLines.sort((a, b) => {
    const ta = extractTime(a.text);
    const tb = extractTime(b.text);
    if (ta && tb) return ta - tb;
    if (ta) return -1;
    if (tb) return 1;
    // Fallback: type order then line number
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
