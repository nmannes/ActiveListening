const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const EarningsSourceFinder = require("./lib/scrapers/earnings_source");
const logger = require("./lib/logger");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: !process.argv.includes("--browser"),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const finder = new EarningsSourceFinder(browser);

  // Try to load from cache
  const cacheDir = process.env.KALSHI_CACHE_DIR || path.join(__dirname, "cache");
  const marketsPath = path.join(cacheDir, "unmatched_markets.json");
  // unmatched_markets.json has { market: { ... } } structure

  if (!fs.existsSync(marketsPath)) {
    logger.error(
      `Cache file not found at ${marketsPath}. Please run e2e_discovery.js first.`,
    );
    await browser.close();
    return;
  }

  let allMarkets = [];
  try {
    const data = JSON.parse(fs.readFileSync(marketsPath, "utf8"));
    // Extract nested market objects
    allMarkets = data.map((item) => item.market).filter((m) => m);
  } catch (err) {
    logger.error(`Failed to parse cache: ${err.message}`);
    await browser.close();
    return;
  }

  // Filter for earnings markets
  const earningsMarkets = allMarkets.filter(
    (m) =>
      (m.title && m.title.toLowerCase().includes("earnings")) ||
      (m.slug && m.slug.toLowerCase().includes("earnings")),
  );

  logger.info(`Found ${earningsMarkets.length} earnings markets in cache.`);

  // Test the first 5 earnings markets
  const toTest = earningsMarkets.slice(0, 5);

  for (const market of toTest) {
    logger.info(`Testing market: ${market.title} (${market.slug})...`);
    const source = await finder.findSource(market);
    logger.info(`Result for ${market.title}: ${source || "Not found"}`);
    console.log("-----------------------------------");
  }

  await browser.close();
})();
