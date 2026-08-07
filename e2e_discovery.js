const fs = require("fs");
const { fetchOpenMarkets } = require("./lib/discover_markets.js");
const { findProgramsAcrossZipsAndKeywords } = require("./lib/scrapers/tv_discovery.js");
const { scrapeESPNMatchups } = require("./lib/scrapers/league_schedule.js");
const logger = require("./lib/logger");
const { sendTelegram } = require("./lib/telegram");
const path = require("path");
const { scrapeAmazonNBA } = require("./lib/scrapers/amazon_video");
const { scrapeCspanSchedule } = require("./lib/scrapers/cspan_schedule");
const { scrapeFoxNewsSchedule } = require("./lib/scrapers/foxnews_schedule");
const { scrapeMsnbcSchedule } = require("./lib/scrapers/msnbc_schedule");
const { scrapeAllYoutubeUpcoming } = require("./lib/scrapers/youtube_upcoming_multi");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const { CHANNEL_MAPPINGS } = require("./lib/yttv_channels");

const { HEADLESS } = require("./lib/args");
const { normalizeSchedule, parseAmazonTime, parseCspanTime } = require("./lib/normalize_schedule");

if (require.main === module) {
  main().catch((err) => {
    logger.error(`Fatal execution error: ${err.message}`);
    process.exit(1);
  });
}

async function main() {
  let startTime = new Date();
  let browser;
  try {
    const cacheDir = process.env.KALSHI_CACHE_DIR || path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const marketCacheDir = path.join(__dirname, "markets");
    if (!fs.existsSync(marketCacheDir)) {
      fs.mkdirSync(marketCacheDir, { recursive: true });
    }

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
      "footbal",
      "meet the press",
      "the last word",
      "cbs sunday morning",
      "world cup",
      "face the nation",
      "the view",
      "cbs mornings",
      "big brother"
    ];

    // Run TV scraper first in its own browser to avoid contention with other scrapers
    let tvSchedule = [];
    let tvBrowser;
    try {
      tvBrowser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: HEADLESS,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
        defaultViewport: null,
      });
      logger.info("Starting TV schedule scraper (dedicated browser)...");
      tvSchedule = await findProgramsAcrossZipsAndKeywords([detectedZip], CATEGORIES, tvBrowser, 3);
      logger.info(`TV schedule scraper complete: ${tvSchedule.length} programs found`);
    } catch (e) {
      logger.error(`TV schedule scraper failed: ${e.message}`);
    } finally {
      if (tvBrowser) await tvBrowser.close();
    }

    // Run remaining scrapers in parallel on a shared browser
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: HEADLESS,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
      defaultViewport: null,
    });

    // Kalshi markets must be fetched before the heavy scrapers: the market
    // page's client-side list never renders while the browser is simultaneously
    // loading ESPN/YouTube/C-SPAN pages (fails the selector wait even after 2min).
    logger.info("Fetching Kalshi markets (sequential, before parallel scrapers)...");
    const marketsResults = await fetchOpenMarkets(browser);
    logger.info(`Kalshi market discovery complete: ${marketsResults.length} markets`);

    logger.info("Starting remaining parallel data fetching...");
    const [espnResults, amazonResults, cspanSchedule, foxnewsSchedule, msnbcSchedule, youtubeUpcoming] = await Promise.all([
      scrapeESPNMatchups(browser),
      scrapeAmazonNBA(browser),
      scrapeCspanSchedule(browser),
      scrapeFoxNewsSchedule(browser),
      scrapeMsnbcSchedule(browser),
      scrapeAllYoutubeUpcoming(browser),
    ]);


    const freshMarkets = marketsResults || [];
    const espnSchedule = espnResults || [];

    // Write to cache
    const cacheWrites = [
      { name: "latest_markets.json", data: freshMarkets },
      { name: "latest_tv_schedule.json", data: normalizeSchedule(tvSchedule, "tv") },
      { name: "espn_matchups.json", data: normalizeSchedule(espnSchedule, "espn") },
      { name: "amazon_nba_search_results.json", data: normalizeSchedule(amazonResults, "amazon") },
      { name: "cspan_schedule.json", data: normalizeSchedule(cspanSchedule, "cspan") },
      { name: "foxnews_schedule.json", data: normalizeSchedule(foxnewsSchedule, "foxnews") },
      { name: "msnbc_schedule.json", data: normalizeSchedule(msnbcSchedule, "msnbc") },
      { name: "youtube_upcoming.json", data: normalizeSchedule(youtubeUpcoming, "youtube_upcoming") },
    ];

    // Batch log messages and send as a single Telegram message
    const logMessages = [];
    for (const item of cacheWrites) {
      const filePath = path.join(cacheDir, item.name);
      fs.writeFileSync(filePath, JSON.stringify(item.data, null, 2));
      const msg = `Saved ${item.data.length} records to ${item.name} (normalized)`;
      logger.info(msg);
      logMessages.push(msg);
    }


    let duration = new Date() - startTime
    logMessages.unshift(`job duration: ${(duration / 60000).toFixed(1)} minutes`)

    // Send all log messages in one Telegram message (debug channel)
    sendTelegram(logMessages.join('\n'), "debug").catch(e => logger.warn(`Telegram batch send failed: ${e.message}`));

    // Also save a unified schedule for easy debugging/matching
    const allNormalized = [
      ...normalizeSchedule(tvSchedule, "tv"),
      ...normalizeSchedule(espnResults, "espn"),
      ...normalizeSchedule(amazonResults, "amazon"),
      ...normalizeSchedule(cspanSchedule, "cspan"),
      ...normalizeSchedule(foxnewsSchedule, "foxnews"),
      ...normalizeSchedule(msnbcSchedule, "msnbc"),
      ...normalizeSchedule(youtubeUpcoming, "youtube_upcoming"),
    ];
    fs.writeFileSync(path.join(cacheDir, "unified_schedule.json"), JSON.stringify(allNormalized, null, 2));
    logger.info(`Saved ${allNormalized.length} records to unified_schedule.json`);

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
  } catch (err) {
    logger.error(`Fatal execution error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = require("./lib/normalize_schedule");
