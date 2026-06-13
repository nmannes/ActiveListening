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

(async () => {
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
      "cbs sunday morning",
      "world cup"
    ];

    // Fetch data in parallel
    logger.info("Starting parallel data fetching...");
    const [marketsResults, espnResults, amazonResults, tvSchedule, cspanSchedule, foxnewsSchedule, msnbcSchedule, youtubeUpcoming] = await Promise.all([
      fetchOpenMarkets(browser),
      scrapeESPNMatchups(browser),
      scrapeAmazonNBA(browser),
      findProgramsAcrossZipsAndKeywords([detectedZip], CATEGORIES, browser, 3),
      scrapeCspanSchedule(browser),
      scrapeFoxNewsSchedule(browser),
      scrapeMsnbcSchedule(browser),
      scrapeAllYoutubeUpcoming(browser),
    ]);


    /**
     * Normalizes schedule data from different sources into a consistent format.
     */
    function normalizeSchedule(data, type) {
      if (!data) return [];
      return data.map(item => {
        let normalized = {
          title: "",
          startTime: null,
          channel: "",
          linkURL: "",
          description: "",
          metadata: item
        };

        if (type === "tv") {
          normalized.title = item.title;
          normalized.startTime = item.startTimestamp;
          normalized.channel = item.station;
          
          const stationUpper = (item.station || "").toUpperCase();
          const isOtaPriority = stationUpper.includes("NBC") || stationUpper.includes("CBS");
          if (isOtaPriority && item.channelURL) {
            normalized.linkURL = item.channelURL;
          } else {
            normalized.linkURL = CHANNEL_MAPPINGS[item.station] || item.channelURL;
          }
          
          normalized.description = item.description;
        } else if (type === "espn") {
          const cleanTeam = (name) => (name || "").replace(/^v\s+/i, "").replace(/ /g, " ").trim();
          normalized.title = `${cleanTeam(item.awayTeam)} vs. ${cleanTeam(item.homeTeam)} ${item.league || ""}`.trim().toLowerCase();
          normalized.startTime = item.startTime;

          const tvChannels = item.tvChannels || [];
          // Find the first channel that has a CHANNEL_MAPPINGS entry, skipping MLB.TV
          const mappedChannel = tvChannels.find((ch) => {
            const name = ch.name;
            if (name.toUpperCase() === "MLB.TV") return false;
            return !!CHANNEL_MAPPINGS[name];
          });
          if (mappedChannel) {
            normalized.channel = mappedChannel.name;
            normalized.linkURL = CHANNEL_MAPPINGS[mappedChannel.name];
          } else {
            // Fall back to first non-MLB.TV channel, or last resort the ESPN watch link
            const fallback = tvChannels.find((ch) => ch.name.toUpperCase() !== "MLB.TV");
            normalized.channel = fallback ? fallback.name : "ESPN";
            const watchLink = tvChannels.find((ch) => ch.link && ch.link.includes("/watch/player/"))?.link;
            normalized.linkURL = watchLink || item.gameLink;
          }

          normalized.description = `${item.league || "sports"} game`;
        } else if (type === "amazon") {
          normalized.title = item.title;
          normalized.startTime = parseAmazonTime(item.time);
          normalized.channel = "Amazon Prime Video";
          normalized.linkURL = item.href;
          normalized.description = "NBA on Prime";
        } else if (type === "cspan") {
          normalized.title = item.title;
          normalized.startTime = parseCspanTime(item.date, item.startTime);
          normalized.channel = item.channel;
          normalized.linkURL = CHANNEL_MAPPINGS[item.channel] || item.url;
          normalized.description = item.sponsor || "";
        } else if (type === "foxnews") {
          normalized.title = item.title;
          normalized.startTime = item.startTime;
          normalized.channel = item.channel || "Fox News";
          normalized.linkURL = item.showUrl || "";
          normalized.description = [item.hosts, item.description].filter(Boolean).join(" | ");
        } else if (type === "msnbc") {
          normalized.title = item.title;
          normalized.startTime = item.startTime;
          normalized.channel = item.channel || "MS NOW";
          normalized.linkURL = CHANNEL_MAPPINGS["MS NOW"] || "";
          normalized.description = item.time || "";
        } else if (type === "youtube_upcoming") {
          normalized.title = item.title;
          normalized.startTime = item.scheduledISO;
          normalized.channel = item.channel || "YouTube";
          normalized.linkURL = item.url || "";
          normalized.description = item.scheduledText || "";
        }

        return normalized;
      });
    }

    function parseAmazonTime(timeStr) {
      if (!timeStr) return null;
      if (timeStr.includes("T") && timeStr.includes("Z")) return timeStr; // Already ISO

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Simple relative parser
      if (timeStr.toLowerCase().includes("tomorrow")) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const timeMatch = timeStr.match(/(\d{1,2})\s*(pm|am)/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          if (timeMatch[2].toLowerCase() === "pm" && hours < 12) hours += 12;
          tomorrow.setHours(hours, 0, 0, 0);
          return tomorrow.toISOString();
        }
        return tomorrow.toISOString();
      }

      // "Thu, Apr 23 8 PM"
      const match = timeStr.match(/([a-z]{3}),\s*([a-z]{3})\s*(\d{1,2})(?:\s+(\d{1,2})\s*(pm|am))?/i);
      if (match) {
        const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        const month = months[match[2].toLowerCase()];
        const day = parseInt(match[3]);
        let hours = 0;
        if (match[4]) {
          hours = parseInt(match[4]);
          if (match[5].toLowerCase() === "pm" && hours < 12) hours += 12;
        }
        const date = new Date(2026, month, day, hours, 0, 0, 0);
        return date.toISOString();
      }

      return null;
    }

    function parseCspanTime(dateStr, timeStr) {
      if (!dateStr || !timeStr) return null;
      // dateStr: "2026-04-22", timeStr: "07:00 AM EDT"
      const [year, month, day] = dateStr.split("-").map(Number);
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        if (timeMatch[3].toUpperCase() === "PM" && hours < 12) hours += 12;
        if (timeMatch[3].toUpperCase() === "AM" && hours === 12) hours = 0;
        const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
        // Adjust for EDT (UTC-4) - assuming the server environment handles local time correctly, 
        // but let's be explicit if we can. 
        // For now, let's treat it as local system time which should be set to EDT.
        return date.toISOString();
      }
      return null;
    }

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
})();
