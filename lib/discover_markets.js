const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("./logger");
const fs = require("fs");
const { getEvent } = require("./api");
const _ = require("lodash");
const { getSpeakerEntities } = require("./speaker_identification");
const EarningsSourceFinder = require("./scrapers/earnings_source");
const { CHANNEL_MAPPINGS, SPEAKER_CHANNEL_MAPPINGS } = require("./yttv_channels");

puppeteer.use(StealthPlugin());



const { HEADLESS } = require("./args");

function getTeamNames(kalshi_market_title) {
  // "Announcers at Dallas vs Minnesota Professional Basketball Game"
  // "What will the announcers say during Orlando vs Philadelphia Professional Basketball Game"
  let cleanTitle = kalshi_market_title
    .replace("Announcers at ", "")
    .replace("What will the announcers say during ", "")
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
    "men",
  ];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix}$`, "i");
    cleanTitle = cleanTitle.replace(regex, "").trim();
  }
  // "Dallas vs Minnesota"
  let teams = cleanTitle
    .split(/\s+(?:vs\.?|vs|at|@)\s+/i)
    .map((t) => t.trim().toLowerCase());

  const aliasMap = {
    // NHL team aliases (moved to top so other sports can overwrite common names)
    stl: "st. louis",
    blues: "st. louis",
    uta: "utah",
    mammoth: "utah",
    nyr: "new york",
    nyi: "new york",
    njd: "new jersey",
    devils: "new jersey",
    islanders: "new york",
    bruins: "boston",
    bos: "boston",
    canadiens: "montreal",
    habs: "montreal",
    mtl: "montreal",
    leafs: "toronto",
    tor: "toronto",
    senators: "ottawa",
    sens: "ottawa",
    ott: "ottawa",
    sabres: "buffalo",
    buf: "buffalo",
    panthers: "florida",
    fla: "florida",
    lightning: "tampa bay",
    tbl: "tampa bay",
    capitals: "washington",
    caps: "washington",
    wsh: "washington",
    hurricanes: "carolina",
    canes: "carolina",
    car: "carolina",
    jackets: "columbus",
    cbj: "columbus",
    "blue jackets": "columbus",
    penguins: "pittsburgh",
    pens: "pittsburgh",
    pit: "pittsburgh",
    flyers: "philadelphia",
    phi: "philadelphia",
    blackhawks: "chicago",
    chi: "chicago",
    "red wings": "detroit",
    det: "detroit",
    predators: "nashville",
    preds: "nashville",
    nsh: "nashville",
    "wild": "minnesota",
    min: "minnesota",
    "stars": "dallas",
    dal: "dallas",
    avalanche: "colorado",
    avs: "colorado",
    col: "colorado",
    jets: "winnipeg",
    wpg: "winnipeg",
    flames: "calgary",
    cgy: "calgary",
    oilers: "edmonton",
    edm: "edmonton",
    canucks: "vancouver",
    van: "vancouver",
    kraken: "seattle",
    sea: "seattle",
    "golden knights": "vegas",
    vgk: "vegas",
    coyotes: "arizona",
    ari: "arizona",
    ducks: "anaheim",
    ana: "anaheim",
    sharks: "san jose",
    sjs: "san jose",

    "los angeles d": "los angeles",
    "los angeles a": "los angeles",
    "los angeles c": "los angeles",
    "los angeles l": "los angeles",
    "la": "los angeles",
    "new york m": "new york",
    "new york y": "new york",
    "ny": "new york",
    "chicago w": "chicago",
    "chicago c": "chicago",
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
    warriors: "golden state",
    bulls: "chicago",
    knicks: "new york",
    lakers: "los angeles",
    clippers: "los angeles",
    mets: "new york",
    yankees: "new york",
    dodgers: "los angeles",
    "red sox": "boston",
    cubs: "chicago",
    "white sox": "chicago",
    phillies: "philadelphia",
    braves: "atlanta",
    astros: "houston",
    giants: "san francisco",
    padres: "san diego",
    "blue jays": "toronto",
    mariners: "seattle",
    rangers: "texas",
    cardinals: "st. louis",
    brewers: "milwaukee",
    twins: "minnesota",
    tigers: "detroit",
    guardians: "cleveland",
    orioles: "baltimore",
    rays: "tampa bay",
    diamondbacks: "arizona",
    rockies: "colorado",
    pirates: "pittsburgh",
    reds: "cincinnati",
    royals: "kansas city",
    angels: "los angeles",
    celtics: "boston",
    nets: "brooklyn",
    "76ers": "philadelphia",
    sixers: "philadelphia",
    raptors: "toronto",
    bucks: "milwaukee",
    cavaliers: "cleveland",
    cavs: "cleveland",
    pacers: "indiana",
    pistons: "detroit",
    heat: "miami",
    magic: "orlando",
    hawks: "atlanta",
    hornets: "charlotte",
    wizards: "washington",
    nuggets: "denver",
    timberwolves: "minnesota",
    thunder: "oklahoma city",
    blazers: "portland",
    jazz: "utah",
    suns: "phoenix",
    kings: "sacramento",
    mavericks: "dallas",
    mavs: "dallas",
    pelicans: "new orleans",
    grizzlies: "memphis",
    spurs: "san antonio",
    rockets: "houston",
    "golden state": "san francisco",
  };

  const results = [];
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    let canonical = aliasMap[team];
    // If full team string didn't match, try individual words (e.g. "stl blues" → "stl" → "st. louis")
    if (!canonical) {
      const words = team.split(/\s+/);
      for (const word of words) {
        if (aliasMap[word]) {
          canonical = aliasMap[word];
          break;
        }
      }
    }
    canonical = canonical || team;
    const variants = _.uniq([team, canonical]);

    for (const [key, val] of Object.entries(aliasMap)) {
      if (val === canonical && !variants.includes(key)) {
        variants.push(key);
      }
    }
    results.push(variants);
  }
  return results;
}

/**
 * Infers the CLIP profile based on the market title.
 * @param {string} title
 * @returns {string|null}
 */
function inferClipProfile(title) {
  const lowerTitle = (title || "").toLowerCase();
  if (lowerTitle.includes("baseball")) return "baseball";
  if (lowerTitle.includes("basketball")) return "basketball";
  if (lowerTitle.includes("white house") || lowerTitle.includes("briefing"))
    return "white_house_briefing";
  if (lowerTitle.includes("survivor")) return "survivor";
  return null;
}

/**
 * Attempts to find a media source for the event.
 */
async function getSource(event, market, externalLinks, sourceFinder) {
  let mediaStreamURL =
    externalLinks.find((l) => l.includes("youtube.com/watch?v=") || l.includes("youtube.com/embed/")) || null;

  // Normalize embed URLs to watch URLs
  if (mediaStreamURL && mediaStreamURL.includes("youtube.com/embed/")) {
    const embedMatch = mediaStreamURL.match(/youtube\.com\/embed\/([^?&#]+)/);
    if (embedMatch) {
      mediaStreamURL = `https://www.youtube.com/watch?v=${embedMatch[1]}`;
    }
  }

  if (
    !mediaStreamURL &&
    sourceFinder &&
    process.env.FIND_EARNINGS_SOURCES === "true" &&
    (event.title.toLowerCase().includes("earnings") ||
      market.slug.toLowerCase().includes("earnings"))
  ) {
    logger.info(
      `Attempting to find media source for earnings market: ${event.title}`,
    );
    mediaStreamURL = await sourceFinder.findSource({ externalLinks });
  }

  if (!mediaStreamURL) {
    for (const [channel, url] of Object.entries(CHANNEL_MAPPINGS)) {
      if (
        event.title.toLowerCase().includes(channel.toLowerCase()) &&
        url !== ""
      ) {
        logger.info(`Matched YTTV channel ${channel} for event: ${event.title}`);
        mediaStreamURL = url;
        break;
      }
    }
  }

  if (!mediaStreamURL) {
    for (const [speaker, channel] of Object.entries(SPEAKER_CHANNEL_MAPPINGS)) {
      if (event.title.toLowerCase().includes(speaker.toLowerCase())) {
        const url = CHANNEL_MAPPINGS[channel];
        if (url) {
          logger.info(
            `Matched speaker ${speaker} to channel ${channel} for event: ${event.title}`,
          );
          mediaStreamURL = url;
          break;
        }
      }
    }
  }

  return mediaStreamURL;
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

const categories = ["Earnings", "Entertainment", "Politicians", "Sports"];

async function getEventsFromCategory(browser, category, isClosed = false) {
  const baseUrl =
    process.env.KALSHI_ENV === "prod"
      ? "https://kalshi.com"
      : "https://demo.kalshi.co";
  const url =
    [baseUrl, "category", "mentions", category.toLowerCase()].join("/") +
    (isClosed ? "?status=closed" : "");
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

          // 1. Extract Market Title (h2 inside the link)
          const titleEl = card.querySelector("h2");
          const title = titleEl ? titleEl.textContent.trim() : "";

          // 2. Extract Trading Volume
          // The volume span is a descendant of the card's container [data-testid="market-tile"]
          const tile = card.closest('[data-testid="market-tile"]');
          const volEl = tile
            ? tile.querySelector("span.font-feature-tabular-zero")
            : null;
          const volume = volEl ? volEl.textContent.trim() : "";

          results.push({
            link,
            slug,
            title,
            volume,
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
async function getEventMetadata(browser, market, sourceFinder = null) {
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

      const mediaStreamURL = await getSource(
        event,
        market,
        externalLinks,
        sourceFinder,
      );

      return {
        ...market,
        title: event.title,
        eventStartTime: formatLocalISO(timestamp),
        externalLinks,
        mediaStreamURL,
        keywords,
        speakerEntities: getSpeakerEntities(event.title),
        clipProfile: inferClipProfile(event.title),
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
    await new Promise((r) => setTimeout(r, 2000));

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
      ).filter((l) => !l.includes("kalshi"));

      return {
        startTimeStr,
        externalLinks: allExternalLinks,
      };
    });

    logger.debug(`Scraped start time string: ${url}: ${result.startTimeStr}`);
    logger.debug(
      `Scraped external links: ${url}: ${result.externalLinks.join(", ")}`,
    );

    // 5. If no YouTube link found yet, try clicking the YouTube image icon
    //    Override window.open to capture the URL without opening a new tab
    //    (avoids conflicts with puppeteer-extra-stealth's targetcreated handler)
    const hasYouTubeLink = result.externalLinks.some(
      (l) => l.includes("youtube.com") || l.includes("youtu.be"),
    );
    if (!hasYouTubeLink) {
      try {
        const ytUrl = await page.evaluate(() => {
          return new Promise((resolve) => {
            const img = document.querySelector(
              'img[alt="Youtube link"], img[src*="youtube.png"]',
            );
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

        if (
          ytUrl &&
          (ytUrl.includes("youtube.com") || ytUrl.includes("youtu.be"))
        ) {
          logger.debug(`YouTube image click captured URL: ${ytUrl}`);
          result.externalLinks.push(ytUrl);
        }
      } catch (ytErr) {
        logger.debug(
          `YouTube image click fallback failed for ${url}: ${ytErr.message}`,
        );
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
      externalLinks: result.externalLinks,
    };
  } catch (err) {
    logger.warn(
      `Error extracting extended metadata for ${url}: ${err.message}`,
    );
    return { timestamp: null, externalLinks: [] };
  } finally {
    if (page) await page.close();
  }
}

async function fetchOpenMarkets(browser) {
  return await fetchMarkets(false, browser);
}

async function fetchClosedMarkets(browser) {
  return await fetchMarkets(true, browser);
}

async function fetchMarkets(isClosed, browser) {
  try {

    const results = await Promise.all(
      categories.map((category) => getEventsFromCategory(browser, category, isClosed)),
    );
    let markets = _.flatMap(results, (r) => r || []);

    // Deduplicate by slug across categories
    markets = _.uniqBy(markets, "slug");

    logger.info(`Found ${markets.length} unique markets with event data`);

    if (isClosed) {
      return markets.filter((m) => m.slug.includes("mention"));
    }

    const sourceFinder = new EarningsSourceFinder(browser);

    // Process markets in parallel with a concurrency limit
    const CONCURRENCY_LIMIT = 5;
    const enrichedMarkets = [];

    async function processWithLimit(items, limit, fn) {
      const results = [];
      const executing = [];
      for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        if (limit <= items.length) {
          const e = p.then(() => executing.splice(executing.indexOf(e), 1));
          executing.push(e);
          if (executing.length >= limit) {
            await Promise.race(executing);
          }
        }
      }
      return Promise.all(results);
    }

    const resultsEnriched = await processWithLimit(markets, CONCURRENCY_LIMIT, async (market) => {
      const enriched = await getEventMetadata(browser, market, sourceFinder);
      return enriched;
    });

    return resultsEnriched.filter((m) => m && m.slug.includes("mention"));
  } catch (err) {
    logger.error("Error in fetchMarkets:", err);
    return [];
  }
}

module.exports = {
  fetchOpenMarkets,
  fetchClosedMarkets,
  getTeamNames,
};

if (require.main === module) {
  (async () => {
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: HEADLESS,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
        defaultViewport: null,
      });

      const markets = await fetchOpenMarkets(browser);
      fs.writeFileSync(
        `${process.env.KALSHI_ENV}_markets_with_event_times.json`,
        JSON.stringify(markets, null, 2),
      );
    } catch (err) {
      logger.error("Failed to run market discovery:", err);
      process.exit(1);
    } finally {
      if (browser) await browser.close();
    }
  })();
}
