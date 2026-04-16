const fs = require("fs");
const { fetchOpenMarkets } = require("./lib/discover_markets.js");
const { findProgramsAcrossZipsAndKeywords } = require("./lib/tv_discovery.js");
const { scrapeESPNMatchups } = require("./lib/league_schedule_scraping.js");
const logger = require("./lib/logger");
const path = require("path");
const { scrapeAmazonNBA } = require("./lib/scrape_amazon_video");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const { HEADLESS } = require("./lib/args");

(async () => {
  let browser;
  try {
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const marketCacheDir = path.join(__dirname, "markets");
    if (!fs.existsSync(marketCacheDir)) {
      fs.mkdirSync(marketCacheDir, { recursive: true });
    }

    browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
      defaultViewport: null,
    });


    /**
     * Robust geolocation using multiple providers
     */
    const getZipCode = async () => {
      const providers = [
        { url: "https://ipinfo.io/json", key: "postal" },
        { url: "https://ipapi.co/json/", key: "postal" },
        { url: "http://ip-api.com/json/", key: "zip" }
      ];

      for (const provider of providers) {
        try {
          const resp = await fetch(provider.url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000)
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data[provider.key]) {
              logger.info(`Detected ZIP: ${data[provider.key]} via ${new URL(provider.url).hostname}`);
              return data[provider.key];
            }
          }
        } catch (e) {
          logger.warn(`Geolocation provider ${provider.url} failed: ${e.message}`);
        }
      }
      logger.warn("All geolocation providers failed, using default ZIP 20001");
      return "20001";
    };

    const detectedZip = await getZipCode();

    const CATEGORIES = [
      "basketball",
      "baseball",
      "saturday night live",
      "survivor",
      "meet the press",
      "the last word",
    ];

    // Fetch data in parallel
    logger.info("Starting parallel data fetching...");
    const [marketsResults, espnResults, amazonResults, tvSchedule] = await Promise.all([
      fetchOpenMarkets(browser),
      scrapeESPNMatchups(browser),
      scrapeAmazonNBA(browser),
      findProgramsAcrossZipsAndKeywords([detectedZip], CATEGORIES, browser, 3)
    ]);


    const freshMarkets = marketsResults || [];
    const espnSchedule = espnResults || [];

    // Write to cache
    const cacheWrites = [
      { name: "latest_markets.json", data: freshMarkets },
      { name: "latest_tv_schedule.json", data: tvSchedule },
      { name: "espn_matchups.json", data: espnSchedule },
      { name: "amazon_nba_search_results.json", data: amazonResults },
    ];

    for (const item of cacheWrites) {
      const filePath = path.join(cacheDir, item.name);
      fs.writeFileSync(filePath, JSON.stringify(item.data, null, 2));
      logger.info(`Saved ${item.data.length} records to ${item.name}`);
    }

    const earningsWithSource = freshMarkets.filter((m) => {
      const title = (m.title || "").toLowerCase();
      const slug = (m.slug || "").toLowerCase();
      return (
        (title.includes("earnings") || slug.includes("earnings")) &&
        m.mediaStreamURL
      );
    });

    const earningsWithSourcePath = path.join(
      cacheDir,
      "earnings_calls_with_source.json",
    );

    fs.writeFileSync(
      earningsWithSourcePath,
      JSON.stringify(earningsWithSource, null, 2),
    );

    logger.info(`E2E Discovery complete.`);
    logger.info(`- Saved market and schedule data to cache.`);
    logger.info(
      `- Saved ${earningsWithSource.length} earnings calls with sources to ${earningsWithSourcePath}`,
    );
  } catch (err) {
    logger.error(`Fatal execution error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
})();
