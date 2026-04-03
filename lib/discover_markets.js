const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("./logger");
const fs = require("fs");
const path = require("path");
const { getEvent } = require("./api");
const cookies = require("../cookies/espn_cookies.json");
const _ = require("lodash");
const { randomBytes } = require("crypto");
const { getSpeakerEntities } = require("./speaker_identification");

puppeteer.use(StealthPlugin());

const { args } = require("./args");

function getTeamNames(kalshi_market_title) {
  // "Announcers at Dallas vs Minnesota Professional Basketball Game"
  let cleanTitle = kalshi_market_title
    .replace("Announcers at ", "")
    .replace(/St\./g, "State");
  // "Dallas vs Minnesota Professional Basketball Game"
  const suffixes = [
    "professional basketball game",
    "college basketball game",
    "nba game",
    "basketball game",
    "nfl game",
    "college football game",
    "professional football game",
    "professional baseball game",
    "college baseball game",
    "mlb game",
    "baseball game",
    "nhl game",
    "soccer match",

    "tennis match",
    "wta tennis match",
    "atp tennis match",
    "premier league match",
    "la liga match",
    "premier league",
    "la liga",
    "mls match",
    "mls",
    "pga tour",
    "game",
    "women's",
    "men's",
    "women",
    "men"
  ];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix}$`, "i");
    cleanTitle = cleanTitle.replace(regex, "").trim();
  }
  // "Dallas vs Minnesota"
  let teams = cleanTitle.split(/\s+(?:vs\.?|vs|at)\s+/i).map((t) => t.trim().toLowerCase());

  const aliasMap = {
    uconn: "connecticut",
    "nc state": "north carolina state",
    "ole miss": "mississippi",
    umass: "massachusetts",
    lsu: "louisiana state",
    "miami (fl)": "miami",
    "state john's": "st. john's",
    "la lakers": "los angeles lakers",
    "la clippers": "los angeles clippers",
    "ny knicks": "new york knicks",
    "ny jets": "new york jets",
    "ny giants": "new york giants",
    "ny mets": "new york mets",
    "ny rangers": "new york rangers",
    "ny islanders": "new york islanders",
    "nj devils": "new jersey devils",
    "warriors": "golden state",
    "bulls": "chicago",
    "knicks": "new york",
    "lakers": "los angeles",
    "clippers": "los angeles",
    "mets": "new york",
    "yankees": "new york",
    "dodgers": "los angeles",
    "red sox": "boston",
    "cubs": "chicago",
    "white sox": "chicago",
    "phillies": "philadelphia",
    "braves": "atlanta",
    "astros": "houston",
    "giants": "san francisco",
    "padres": "san diego",
    "blue jays": "toronto",
    "mariners": "seattle",
    "rangers": "texas",
    "cardinals": "st. louis",
    "brewers": "milwaukee",
    "twins": "minnesota",
    "tigers": "detroit",
    "guardians": "cleveland",
    "orioles": "baltimore",
    "rays": "tampa bay",
    "diamondbacks": "arizona",
    "rockies": "colorado",
    "pirates": "pittsburgh",
    "reds": "cincinnati",
    "royals": "kansas city",
    "angels": "los angeles",
    "celtics": "boston",
    "nets": "brooklyn",
    "76ers": "philadelphia",
    "sixers": "philadelphia",
    "raptors": "toronto",
    "bucks": "milwaukee",
    "cavaliers": "cleveland",
    "cavs": "cleveland",
    "pacers": "indiana",
    "pistons": "detroit",
    "heat": "miami",
    "magic": "orlando",
    "hawks": "atlanta",
    "hornets": "charlotte",
    "wizards": "washington",
    "nuggets": "denver",
    "timberwolves": "minnesota",
    "thunder": "oklahoma city",
    "blazers": "portland",
    "jazz": "utah",
    "suns": "phoenix",
    "kings": "sacramento",
    "mavericks": "dallas",
    "mavs": "dallas",
    "pelicans": "new orleans",
    "grizzlies": "memphis",
    "spurs": "san antonio",
    "rockets": "houston",
  };

  const results = [];
  for (let i = 0; i < teams.length; i++) {
    const variants = [teams[i]];
    if (aliasMap[teams[i]]) {
      variants.push(aliasMap[teams[i]]);
    }
    // Reverse check
    for (const [key, val] of Object.entries(aliasMap)) {
      if (val === teams[i] && !variants.includes(key)) {
        variants.push(key);
      }
    }
    results.push(variants);
  }
  return results;
}

const formatLocalISO = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  // Get local components to build a local time string with offset
  const pad = (n) => n.toString().padStart(2, "0");
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000${sign}${offsetHours}:${offsetMins}`;
};


const categories = [
  "Earnings",
  "Entertainment",
  "Politicians",
  "Sports"
];

async function getEventsFromCategory(browser, category) {
  const url =
    process.env.KALSHI_ENV === "prod"
      ? `https://kalshi.com/category/mentions/${category.toLowerCase()}`
      : `https://demo.kalshi.co/category/mentions/${category.toLowerCase()}`;
  return getEventsFromPageHelp(browser, url);
}



async function getEventsFromPageHelp(browser, url) {
  let page;
  try {
    logger.info("Starting visual market discovery...");
    page = await browser.newPage();

    // Forward logs
    page.on("console", (msg) => {
      const type = msg.type();
      /* if (type === 'error') logger.error(`[Browser] ${msg.text()}`); */
    });

    logger.info(`Navigating to ${url}...`);

    await page.goto(url, { timeout: 60000 });

    await page.waitForSelector('a[href^="/markets/"]');

    // Scroll to the bottom to load all lazy-loaded market cards
    let previousCount = 0;
    let stableRounds = 0;
    while (stableRounds < 3) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, 1000));
      const currentCount = await page.$$eval(
        'a[href^="/markets/"]',
        (els) => els.length,
      );
      if (currentCount === previousCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
        previousCount = currentCount;
      }
      logger.debug(
        `Scroll pass: ${currentCount} market links found (stable rounds: ${stableRounds})`,
      );
    }

    logger.info("Extracting market data...");
    const markets = await page.evaluate(() => {
      const cards = document.querySelectorAll('a[href^="/markets/"]');
      const uniqueSlugs = new Set();
      const results = [];

      cards.forEach((card) => {
        const link = card.href;
        const slug = link.split("/").pop();

        if (link && !uniqueSlugs.has(slug)) {
          uniqueSlugs.add(slug);
          results.push({
            link,
            slug,
          });
        }
      });
      return results;
    });

    logger.info(`Discovered ${markets.length} potential markets.`);

    // Keep open for a bit if running manually, or return if module
    await new Promise((r) => setTimeout(r, 500));
    return markets;
  } catch (error) {
    logger.error("Market discovery failed:", error);
    return null;
  } finally {
    if (page) await page.close();
  }
}

/**
 * Enrich market data with exact event times from Kalshi API
 */
async function getEventMetadata(browser, market) {
  const ticker = market.slug.toUpperCase();

  try {
    const { event } = await getEvent(ticker, true);
    // Optional: fs.writeFileSync(`./markets/${ticker}.json`, JSON.stringify(event, null, 2));

    logger.debug(`title: ${event.title}: ${event.markets.length}`);

    if (event) {
      const { timestamp, externalLinks } = await getFrontendMetadata(
        browser,
        market.link,
      );
      logger.debug(`scrapedStartTime: ${timestamp}`);

      let keywords = {};

      _.forEach(event.markets, (m) => {
        try {
          const strikeWord =
            m.custom_strike.Word ||
            m.custom_strike.participant ||
            m.custom_strike.name;
          if (strikeWord) {
            const splitted = strikeWord.split("/");
            splitted.forEach((word) => {
              const w = word.trim().toLowerCase().replace("-", " ");
              keywords[w] = m.ticker;
            });
          } else {
            logger.warn(
              `Failed to find strike keyword for ${ticker}: ${JSON.stringify(m)}`,
            );
          }
        } catch (err) {
          // Ignore
        }
      });

      const mediaStreamURL =
        externalLinks.find((l) => l.includes("youtube.com/watch?v=")) || null;

      return {
        ...market,
        title: event.title,
        eventStartTime: formatLocalISO(timestamp),
        externalLinks,
        mediaStreamURL,
        keywords,
        speakerEntities: getSpeakerEntities(event.title),
      };
    }
    return null;
  } catch (err) {
    logger.warn(`Failed to fetch event time for ${ticker}: ${err.message}`);
    return null;
  }
}


async function getFrontendMetadata(browser, url) {
  let page;
  try {
    page = await browser.newPage();

    // Use networkidle2 to ensure dynamic content load
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const result = await page.evaluate(() => {
      // 1. Extract Start Time
      const nodes = Array.from(document.querySelectorAll("span"));
      const spans = nodes.map((n) => n.innerText);

      // Pattern: MMM D, H:mm(am|pm) Z
      const dateRegex =
        /([A-Z][a-z]{2}\s\d{1,2},\s\d{1,2}:\d{2}[ap]m\s[A-Z]{3})/;

      let startTimeStr = null;
      for (const text of spans) {
        const match = text.match(dateRegex);
        if (match) {
          startTimeStr = match[0];
          break;
        }
      }

      // 2. Extract Links
      const links = Array.from(document.querySelectorAll("a"))
        .map((a) => a.href)
        .filter((href) => href && href.startsWith("http"));

      // 3. Extract Iframes (especially YouTube)
      const iframes = Array.from(document.querySelectorAll("iframe"))
        .map((f) => f.src)
        .filter((src) => src && src.startsWith("http"));

      // 4. Extract from __NEXT_DATA__ if available
      let nextDataLinks = [];
      try {
        const nextData = JSON.parse(
          document.getElementById("__NEXT_DATA__")?.textContent || "{}",
        );
        const productDetails =
          nextData?.props?.pageProps?.event?.product_details;
        if (productDetails?.youtube_link) {
          nextDataLinks.push(productDetails.youtube_link);
        }
      } catch (e) {
        // Ignore
      }

      const allExternalLinks = Array.from(
        new Set([...links, ...iframes, ...nextDataLinks]),
      );

      return {
        startTimeStr,
        externalLinks: allExternalLinks
      };
    });

    logger.debug(`Scraped start time string: ${url}: ${result.startTimeStr}`);
    logger.debug(`Scraped external links: ${url}: ${result.externalLinks.join(", ")}`);

    // 5. If no YouTube link found yet, try clicking the YouTube image icon
    //    Override window.open to capture the URL without opening a new tab
    //    (avoids conflicts with puppeteer-extra-stealth's targetcreated handler)
    const hasYouTubeLink = result.externalLinks.some(l => l.includes("youtube.com") || l.includes("youtu.be"));
    if (!hasYouTubeLink) {
      try {
        const ytUrl = await page.evaluate(() => {
          return new Promise((resolve) => {
            const img = document.querySelector('img[alt="Youtube link"], img[src*="youtube.png"]');
            if (!img) return resolve(null);

            // Intercept window.open so clicking the image gives us the URL
            // without actually opening a new tab
            const originalOpen = window.open;
            window.open = function (openUrl) {
              window.open = originalOpen;
              resolve(openUrl);
              return null;
            };

            img.click();

            // Fallback: if click doesn't trigger window.open within 3s, give up
            setTimeout(() => {
              window.open = originalOpen;
              resolve(null);
            }, 3000);
          });
        });

        if (ytUrl && (ytUrl.includes("youtube.com") || ytUrl.includes("youtu.be"))) {
          logger.debug(`YouTube image click captured URL: ${ytUrl}`);
          result.externalLinks.push(ytUrl);
        }
      } catch (ytErr) {
        logger.debug(`YouTube image click fallback failed for ${url}: ${ytErr.message}`);
      }
    }

    let timestamp = null;
    if (result.startTimeStr) {
      const currentYear = new Date().getFullYear();
      const parts = result.startTimeStr.split(",");
      if (parts.length === 2) {
        const datePart = parts[0].trim(); // "Feb 18"
        let timePart = parts[1].trim(); // "5:00pm EST"
        timePart = timePart.replace(/(\d)(am|pm)/i, "$1 $2");
        const fullDateStr = `${datePart} ${currentYear}, ${timePart}`;
        const ts = new Date(fullDateStr).getTime();
        if (!isNaN(ts)) {
          timestamp = ts;
        }
      }
    }

    return {
      timestamp,
      externalLinks: result.externalLinks
    };
  } catch (err) {
    logger.warn(`Error extracting extended metadata for ${url}: ${err.message}`);
    return { timestamp: null, externalLinks: [] };
  } finally {
    if (page) await page.close();
  }
}

async function fetchOpenMarkets() {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: true, // Use headless for performance unless debugging visually
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--start-maximized",
      ],
      defaultViewport: null,
    });

    const results = await Promise.all(categories.map(category => getEventsFromCategory(browser, category)));
    let markets = _.flatMap(results, r => r || []);

    // Deduplicate by slug across categories
    markets = _.uniqBy(markets, 'slug');

    logger.info(`Found ${markets.length} unique markets with event data`);

    const enrichedMarkets = [];

    for (let i = 0; i < markets.length; i++) {
      const market = markets[i];

      const enriched = await getEventMetadata(browser, market);
      if (enriched) {
        logger.debug(`Enriched market: ${JSON.stringify(enriched, null, 2)}`);
        enrichedMarkets.push(enriched);
      }

      // Rate limiting - wait 100ms between API calls
      if (i < markets.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return enrichedMarkets.filter(m => m.slug.includes("mention"));
  } catch (err) {
    logger.error("Error in fetchOpenMarkets:", err);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  fetchOpenMarkets,
  getTeamNames,
};

if (require.main === module) {
  (async () => {
    try {
      const markets = await fetchOpenMarkets();
      fs.writeFileSync(
        `${process.env.KALSHI_ENV}_markets_with_event_times.json`,
        JSON.stringify(markets, null, 2),
      );
    } catch (err) {
      logger.error("Failed to run market discovery:", err);
      process.exit(1);
    }
  })();
}
