const fs = require("fs");
const { frontPageMarkets } = require("./lib/discover_markets.js");
const { findProgramsByZipAndKeyword } = require("./lib/tv_discovery.js");
const { scrapeEspnSchedule } = require("./lib/espn_discovery.js");
const { matchDiscoveryEvents } = require("./lib/discovery_matcher.js");
const logger = require("./lib/logger");
const { scrapeNcaaSchedules } = require("./lib/ncaa_tip_off_times.js");
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

    let zip = "20001"; // Default ZIP
    try {
      logger.info("Detecting location via ipinfo.io...");
      const ipInfo = await fetch("https://ipinfo.io", { timeout: 5000 });
      if (ipInfo.ok) {
        const ipInfoJson = await ipInfo.json();
        if (ipInfoJson.postal) {
          zip = ipInfoJson.postal;
          logger.info(`Detected ZIP: ${zip}`);
        }
      }
    } catch (err) {
      logger.warn(
        `Failed to detect location, using default ZIP ${zip}: ${err.message}`,
      );
    }

    const cacheTTL = 60 * 60 * 1000; // 1 hour
    const rawData = [
      "latest_markets.json",
      "latest_tv_schedule.json",
      "espn_next_3_days.json",
      "ncaa_next_3_days.json",
    ];
    const functionCalls = [
      () => frontPageMarkets(),
      () => findProgramsByZipAndKeyword(zip, "basketball"),
      () => scrapeEspnSchedule(new Date(), 3),
      () => scrapeNcaaSchedules(new Date(), 3),
    ];

    for (let i = 0; i < functionCalls.length; i++) {
      const fileName = rawData[i];
      const filePath = path.join(cacheDir, fileName);
      const func = functionCalls[i];

      if (isFileExpired(filePath, cacheTTL)) {
        logger.info(`Fetching fresh data for ${fileName}...`);
        try {
          const data = await func();
          if (data) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            logger.info(`Saved ${fileName}`);
          } else {
            logger.warn(
              `Fetched data for ${fileName} was empty, skipping write.`,
            );
          }
        } catch (err) {
          logger.error(`Error fetching data for ${fileName}: ${err.message}`);
        }
      } else {
        logger.info(`Using cached data from ${fileName}`);
      }
    }

    const markets = JSON.parse(
      fs.readFileSync(path.join(cacheDir, "latest_markets.json"), "utf8"),
    );
    const tvSchedule = JSON.parse(
      fs.readFileSync(path.join(cacheDir, "latest_tv_schedule.json"), "utf8"),
    );
    const espnSchedule = JSON.parse(
      fs.readFileSync(path.join(cacheDir, "espn_next_3_days.json"), "utf8"),
    );
    const ncaaSchedule = JSON.parse(
      fs.readFileSync(path.join(cacheDir, "ncaa_next_3_days.json"), "utf8"),
    );

    const allResults = matchDiscoveryEvents(markets, tvSchedule, espnSchedule, ncaaSchedule);

    const matchedMarkets = allResults.filter((m) => m.tvEvent || m.espnEvent || m.ncaaEvent);
    const unmatchedMarkets = allResults.filter(
      (m) => !m.tvEvent && !m.espnEvent && !m.ncaaEvent,
    );

    const matchedPath = path.join(cacheDir, "matched_markets.json");
    const unmatchedPath = path.join(cacheDir, "unmatched_markets.json");

    fs.writeFileSync(matchedPath, JSON.stringify(matchedMarkets, null, 2));
    fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedMarkets, null, 2));

    logger.info(`E2E Discovery complete.`);
    logger.info(
      `- Saved ${matchedMarkets.length} matched markets to ${matchedPath}`,
    );
    logger.info(
      `- Saved ${unmatchedMarkets.length} unmatched markets to ${unmatchedPath}`,
    );
  } catch (err) {
    logger.error(`Fatal execution error: ${err.message}`);
  }
})();
