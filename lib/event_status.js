const { getTeamNames } = require("./discover_markets");
const { teamMatches } = require("./discovery_matcher");
const logger = require("./logger");

/**
 * Fetches the ESPN scoreboard for a given sport and date.
 * @param {string} sport - 'nba' or 'mens-college-basketball'
 * @param {string} dateStr - YYYYMMDD
 * @returns {Promise<Object>} - ESPN Scoreboard API response
 */
async function fetchScoreboard(sport, dateStr) {
  let url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${sport}/scoreboard?dates=${dateStr}`;
  if (sport === "mens-college-basketball") {
    url += "&groups=50";
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ESPN scoreboard: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Normalizes team names for matching.
 */
function normalizeSearch(text) {
  return text
    .toLowerCase()
    .replace(/\bst\./g, "state")
    .replace(/\bst\b/g, "state")
    .replace(/state john's/g, "st. john's");
}

// ── Sport detection (no network) ────────────────────────────────────────

/**
 * Detects sport and league from a market title/slug. Does not hit the network.
 * @param {Object} market - Kalshi market object
 * @returns {{ sport: string, league: string } | null}
 */
function detectSport(market) {
  const title = (market.title || "").toLowerCase();
  const slug = (market.slug || "").toLowerCase();

  let sport = null;
  let league = null;

  if ((title.includes("women") && title.includes("professional basketball")) || slug.includes("kxwnba")) {
    sport = "basketball";
    league = "wnba";
  } else if (title.includes("professional basketball") || title.includes("nba")) {
    sport = "basketball";
    league = "nba";
  } else if (title.includes("college basketball")) {
    sport = "basketball";
    league = title.includes("women")
      ? "womens-college-basketball"
      : "mens-college-basketball";
  } else if (title.includes("professional football") || title.includes("nfl")) {
    sport = "football";
    league = "nfl";
  } else if (title.includes("college football")) {
    sport = "football";
    league = "college-football";
  } else if (title.includes("professional baseball") || title.includes("mlb")) {
    sport = "baseball";
    league = "mlb";
  } else if (title.includes("professional hockey") || title.includes("nhl")) {
    sport = "hockey";
    league = "nhl";
  } else if (
    title.includes("soccer") ||
    title.includes("premier league") ||
    title.includes("la liga") ||
    title.includes("mls")
  ) {
    sport = "soccer";
    if (title.includes("premier league")) league = "eng.1";
    else if (title.includes("la liga")) league = "esp.1";
    else if (title.includes("mls")) league = "usa.1";
    else if (title.includes("bundesliga")) league = "ger.1";
    else if (title.includes("serie a")) league = "it.1";
    else league = "eng.1";
  } else if (title.includes("tennis")) {
    sport = "tennis";
    league = title.includes("wta") ? "wta" : "atp";
  } else if (title.includes("golf") || title.includes("pga")) {
    sport = "golf";
    league = "pga";
  }

  // Slug-based detection (runs in parallel with title, wins for prefixes)
  if (!sport || !league) {
    if (slug.startsWith("kxwc")) {
      sport = "soccer";
      league = "fifa.world";
    } else if (slug.includes("nhl")) { sport = "hockey"; league = "nhl"; }
    else if (slug.includes("nba")) { sport = "basketball"; league = "nba"; }
    else if (slug.includes("mlb")) { sport = "baseball"; league = "mlb"; }
    else if (slug.includes("nfl")) { sport = "football"; league = "nfl"; }
  }

  if (!sport || !league) return null;
  return { sport, league };
}

/**
 * Returns a suggested fallback duration in minutes for a given sport.
 */
const SPORT_DURATIONS = {
  basketball: 150,
  football: 210,
  baseball: 180,
  hockey: 150,
  soccer: 120,
  tennis: 180,
  golf: 240,
};

function getSuggestedDuration(sport) {
  return SPORT_DURATIONS[sport] || 90;
}

// ── ESPN status polling ────────────────────────────────────────────────

const _warnedSlugs = new Set();

/**
 * Determines the status of a game by querying the ESPN scoreboard.
 * @param {Object} market - Kalshi market object
 * @returns {Promise<string>} - 'upcoming', 'live', or 'final'
 */
async function getEventStatus(market) {
  const title = market.title;
  const startTime = new Date(market.eventStartTime);

  const info = detectSport(market);
  if (!info) {
    if (!_warnedSlugs.has(market.slug)) {
      _warnedSlugs.add(market.slug);
      logger.warn(`Could not determine sport/league from title or slug: ${title}`);
    }
    return "live";
  }
  const { sport, league } = info;

  // college sports need a groups param on the ESPN URL
  let groups = null;
  if (league === "mens-college-basketball") groups = "50";
  else if (league === "college-football") groups = "80";

  // Determine date string (YYYYMMDD) in Eastern Time
  const etOffset = -4;
  const etDate = new Date(startTime.getTime() + etOffset * 60 * 60 * 1000);
  const dateStr = etDate.toISOString().split("T")[0].replace(/-/g, "");

  try {
    let url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard?dates=${dateStr}`;
    if (groups) url += `&groups=${groups}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();

    const teams = getTeamNames(title);
    if (teams.length < 2 && sport !== "golf") {
      logger.warn(`Could not extract teams from title: ${title}`);
      return "live";
    }

    // Find the event in the scoreboard
    let event;
    if (sport === "golf") {
      event = data.events[0];
    } else {
      event = data.events.find((e) => {
        const searchArea = normalizeSearch(e.name || "");
        return teams.every((variants) =>
          variants.some((v) => teamMatches(v, searchArea)),
        );
      });
    }

    if (!event) {
      logger.warn(
        `Could not find ${sport}/${league} event on ${dateStr} for participants: ${teams.map((v) => v[0]).join(" vs ")}`,
      );
      return "live";
    }

    const state = event.status.type.state;
    if (state === "pre") return "upcoming";
    if (state === "in") return "live";
    if (state === "post") return "final";

    return "live";
  } catch (err) {
    logger.error(`Error checking ${sport}/${league} status: ${err.message}`);
    return "live";
  }
}

module.exports = { getEventStatus, detectSport, getSuggestedDuration };
