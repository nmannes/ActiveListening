const fs = require("fs");
const { fetchOpenMarkets } = require("./lib/discover_markets.js");
const { findProgramsAcrossZipsAndKeywords } = require("./lib/tv_discovery.js");
const { scrapeESPNMatchups } = require("./lib/league_schedule_scraping.js");
const { matchDiscoveryEvents } = require("./lib/discovery_matcher.js");
const logger = require("./lib/logger");
const { applyWordConfigurations } = require("./lib/word_configurations.js");
const path = require("path");
const _ = require("lodash");

/**
 * Checks if a file exists and is not expired based on TTL.
 * @param {string} filePath - Path to the file.
 * @param {number} ttlMs - TTL in milliseconds.
 * @returns {boolean} - True if file exists and is not expired.
 */
function isFileExpired(filePath, ttlMs) {
  if (!fs.existsSync(filePath)) return true;
  const stats = fs.statSync(filePath);
  const age = Date.now() - stats.ctimeMs;
  return age > ttlMs;
}

(async () => {
  try {
    const cacheDir = path.join(__dirname, "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const marketCacheDir = path.join(__dirname, "markets");
    if (!fs.existsSync(marketCacheDir)) {
      fs.mkdirSync(marketCacheDir, { recursive: true });
    }

    const zipPromise = (async () => {
      let detectedZip = "20001";
      try {
        logger.info("Detecting location via ipinfo.io...");
        const response = await fetch("https://ipinfo.io", { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const ipInfoJson = await response.json();
          if (ipInfoJson.postal) {
            detectedZip = ipInfoJson.postal;
            logger.info(`Detected ZIP: ${detectedZip}`);
          }
        }
      } catch (err) {
        logger.warn(`Failed to detect location, using default ZIP ${detectedZip}: ${err.message}`);
      }
      return detectedZip;
    })();

    const CATEGORIES = [
      "basketball",
      "baseball",
      "saturday night live",
      "survivor",
      "meet the press",
    ];

    // Fetch data in parallel
    logger.info("Starting parallel data fetching...");
    const [zip, marketsResults, espnResults] = await Promise.all([
      zipPromise,
      fetchOpenMarkets(),
      scrapeESPNMatchups(),
    ]);

    // Now that we have the zip, we can fetch TV schedules (TitanTV needs the ZIP)
    logger.info(`Fetching TV schedule for ZIP ${zip}...`);
    const tvSchedule = await findProgramsAcrossZipsAndKeywords([zip], CATEGORIES);

    const freshMarkets = marketsResults || [];
    const espnSchedule = espnResults || [];
    const ncaaSchedule = []; // Placeholder for now

    // Write to cache
    const cacheWrites = [
      { name: "latest_markets.json", data: freshMarkets },
      { name: "latest_tv_schedule.json", data: tvSchedule },
      { name: "espn_matchups.json", data: espnSchedule },
      { name: "ncaa_schedule.json", data: ncaaSchedule },
    ];

    for (const item of cacheWrites) {
      const filePath = path.join(cacheDir, item.name);
      fs.writeFileSync(filePath, JSON.stringify(item.data, null, 2));
      logger.info(`Saved ${item.name}`);
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
  }
})();
