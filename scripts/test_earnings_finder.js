/**
 * Test script: run the earnings source finder against a specific market or
 * company. Supports several modes:
 *
 *   # Test all current earnings call markets from Kalshi live
 *   FIND_EARNINGS_SOURCES=true bun run scripts/test_earnings_finder.js
 *
 *   # Test a specific ticker from live markets
 *   FIND_EARNINGS_SOURCES=true bun run scripts/test_earnings_finder.js --ticker KXEARNINGSMENTIONAAPL
 *
 *   # Test from a cached JSON file (unmatched_markets.json, latest_markets.json, etc.)
 *   FIND_EARNINGS_SOURCES=true bun run scripts/test_earnings_finder.js --file cache/unmatched_markets.json
 *
 *   # Direct search: just give a company name and optional date, skips Kalshi entirely.
 *   # Uses Google search to find the IR page, then Claude to navigate.
 *   FIND_EARNINGS_SOURCES=true bun run scripts/test_earnings_finder.js --company "Apple" --date "2026-07-28"
 *
 * Requires: ANTHROPIC_API_KEY in env for Claude-powered analysis
 */

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const logger = require("../lib/logger");
const { fetchOpenMarkets } = require("../lib/discover_markets");
const EarningsSourceFinder = require("../lib/scrapers/earnings_source");
const { extractCompanyFromTitle } = EarningsSourceFinder;

const { HEADLESS } = require("../lib/args");

function parseArgs(argv) {
  const opts = {};

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--ticker":
        opts.ticker = argv[++i];
        break;
      case "--file":
        opts.file = argv[++i];
        break;
      case "--company":
        opts.company = argv[++i];
        break;
      case "--date":
        opts.date = argv[++i];
        break;
      case "--slug":
        opts.slug = argv[++i];
        break;
      default:
        // Legacy: first positional arg is ticker
        if (!opts.ticker && !argv[i].startsWith("-")) {
          opts.ticker = argv[i];
        }
    }
  }

  return opts;
}

/**
 * Normalize market data from either flat format (latest_markets.json) or
 * nested format (unmatched_markets.json where each entry is {market: {...}}).
 */
function normalizeMarket(entry) {
  // Nested format: { market: {...}, mediaSources: [], startTime: "..." }
  if (entry.market) {
    const m = entry.market;
    return {
      slug: m.slug || "",
      title: m.title || "",
      eventStartTime: m.eventStartTime || entry.startTime || null,
      externalLinks: m.externalLinks || [],
      mediaStreamURL: m.mediaStreamURL || null,
    };
  }
  // Flat format
  return entry;
}

function loadMarketsFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : [data];
  return items.map(normalizeMarket);
}

async function testMarket(sourceFinder, market) {
  const company = extractCompanyFromTitle(market.title);
  const date = market.eventStartTime || null;

  logger.info("=".repeat(70));
  logger.info(`MARKET: ${market.slug}`);
  logger.info(`TITLE:  ${market.title}`);
  logger.info(`COMPANY: ${company || "unknown"}`);
  logger.info(`DATE:   ${date || "unknown"}`);
  logger.info(`EXTERNAL LINKS (${(market.externalLinks || []).length}):`);
  for (const link of market.externalLinks || []) {
    logger.info(`  - ${link}`);
  }
  logger.info(`CURRENT MEDIA URL: ${market.mediaStreamURL || "(none)"}`);
  logger.info("-".repeat(70));

  if (market.mediaStreamURL) {
    logger.info(`Already has media URL, skipping finder.`);
    return;
  }

  logger.info("Running earnings source finder...");
  const startTime = Date.now();
  const result = await sourceFinder.findSource({
    externalLinks: market.externalLinks || [],
    company,
    date,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result) {
    logger.info(`FOUND (${elapsed}s): ${result}`);
  } else {
    logger.info(`NOT FOUND (${elapsed}s)`);
  }
}

async function testDirectSearch(sourceFinder, company, date) {
  logger.info("=".repeat(70));
  logger.info(`DIRECT SEARCH`);
  logger.info(`COMPANY: ${company}`);
  logger.info(`DATE:    ${date || "unknown"}`);
  logger.info("-".repeat(70));
  logger.info("Running earnings source finder (Google search path)...");

  const startTime = Date.now();
  const result = await sourceFinder.findSource({
    externalLinks: [],
    company,
    date,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result) {
    logger.info(`FOUND (${elapsed}s): ${result}`);
  } else {
    logger.info(`NOT FOUND (${elapsed}s)`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  // ── Direct search mode ──────────────────────────────────────────────────
  if (opts.company) {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
      defaultViewport: null,
    });
    try {
      const sourceFinder = new EarningsSourceFinder(browser);
      await testDirectSearch(sourceFinder, opts.company, opts.date || null);
    } finally {
      await browser.close();
    }
    return;
  }

  // ── Browser setup ───────────────────────────────────────────────────────
  logger.info("Launching browser...");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
    defaultViewport: null,
  });

  try {
    let allMarkets;

    // ── File mode: load from cached JSON ──────────────────────────────────
    if (opts.file) {
      const filePath = path.resolve(opts.file);
      logger.info(`Loading markets from ${filePath}...`);
      allMarkets = loadMarketsFromFile(filePath);
      logger.info(`Loaded ${allMarkets.length} markets from file.`);
    } else {
      // ── Live mode: fetch from Kalshi ────────────────────────────────────
      logger.info("Fetching open markets from Kalshi...");
      allMarkets = await fetchOpenMarkets(browser);
      logger.info(`Fetched ${allMarkets.length} markets.`);
    }

    // Filter to earnings call markets
    const earningsCallMarkets = allMarkets.filter((m) => {
      const title = (m.title || "").toLowerCase();
      return title.includes("earnings call");
    });

    // Apply optional filters
    let targets = earningsCallMarkets;
    if (opts.ticker) {
      targets = targets.filter((m) =>
        (m.slug || "").toLowerCase().includes(opts.ticker.toLowerCase()),
      );
    }
    if (opts.slug) {
      targets = targets.filter((m) =>
        (m.slug || "").toLowerCase().includes(opts.slug.toLowerCase()),
      );
    }

    if (targets.length === 0) {
      logger.info("No earnings call markets matched.");
      const anyEarnings = allMarkets.filter((m) =>
        (m.title || "").toLowerCase().includes("earnings"),
      );
      logger.info(`Broader "earnings" markets in dataset: ${anyEarnings.length}`);
      for (const m of anyEarnings.slice(0, 10)) {
        logger.info(`  [${m.slug}] ${m.title}`);
      }
      if (anyEarnings.length > 10) {
        logger.info(`  ... and ${anyEarnings.length - 10} more`);
      }
      return;
    }

    logger.info(
      `Found ${earningsCallMarkets.length} earnings call markets, ` +
        `testing ${targets.length}${opts.ticker ? " (filtered by ticker)" : ""}`,
    );

    const sourceFinder = new EarningsSourceFinder(browser);
    for (const market of targets) {
      await testMarket(sourceFinder, market);
    }

    logger.info("=".repeat(70));
    logger.info("Done.");
  } catch (err) {
    logger.error(`Test failed: ${err.message}`);
    console.error(err);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
