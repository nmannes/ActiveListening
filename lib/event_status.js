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

/**
 * Determines the status of a game from the market data.
 * @param {Object} market - Kalshi market object
 * @returns {Promise<string>} - 'upcoming', 'live', or 'final'
 */
async function getEventStatus(market) {
  const title = market.title;
  const startTime = new Date(market.eventStartTime);
  const titleLower = title.toLowerCase();

  // 1. Determine sport and league
  let sport = null;
  let league = null;
  let groups = null;

  if (
    titleLower.includes("professional basketball") ||
    titleLower.includes("nba")
  ) {
    sport = "basketball";
    league = "nba";
  } else if (titleLower.includes("college basketball")) {
    sport = "basketball";
    league = titleLower.includes("women")
      ? "womens-college-basketball"
      : "mens-college-basketball";
    groups = "50";
  } else if (
    titleLower.includes("professional football") ||
    titleLower.includes("nfl")
  ) {
    sport = "football";
    league = "nfl";
  } else if (titleLower.includes("college football")) {
    sport = "football";
    league = "college-football";
    groups = "80";
  } else if (
    titleLower.includes("professional baseball") ||
    titleLower.includes("mlb")
  ) {
    sport = "baseball";
    league = "mlb";
  } else if (
    titleLower.includes("professional hockey") ||
    titleLower.includes("nhl")
  ) {
    sport = "hockey";
    league = "nhl";
  } else if (
    titleLower.includes("soccer") ||
    titleLower.includes("premier league") ||
    titleLower.includes("la liga") ||
    titleLower.includes("mls")
  ) {
    sport = "soccer";
    if (titleLower.includes("premier league")) league = "eng.1";
    else if (titleLower.includes("la liga")) league = "esp.1";
    else if (titleLower.includes("mls")) league = "usa.1";
    else if (titleLower.includes("bundesliga")) league = "ger.1";
    else if (titleLower.includes("serie a")) league = "it.1";
    else league = "eng.1"; // Default to PL if soccer mentioned but league unclear
  } else if (titleLower.includes("tennis")) {
    sport = "tennis";
    league = titleLower.includes("wta") ? "wta" : "atp";
  } else if (titleLower.includes("golf") || titleLower.includes("pga")) {
    sport = "golf";
    league = "pga";
  }

  // Fallback: try to determine sport/league from the market slug/ticker
  if (!sport || !league) {
    const slug = (market.slug || "").toLowerCase();
    if (slug.includes("nhl")) {
      sport = "hockey";
      league = "nhl";
    } else if (slug.includes("nba")) {
      sport = "basketball";
      league = "nba";
    } else if (slug.includes("mlb")) {
      sport = "baseball";
      league = "mlb";
    } else if (slug.includes("nfl")) {
      sport = "football";
      league = "nfl";
    }
  }

  if (!sport || !league) {
    logger.warn(`Could not determine sport/league from title or slug: ${title}`);
    return "live";
  }

  // 2. Determine date string (YYYYMMDD) in Eastern Time
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

    // 3. Find the event in the scoreboard
    let event;
    if (sport === "golf") {
      // For golf, we check the tournament status generally
      event = data.events[0]; // Usually only one PGA tournament per date
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

module.exports = { getEventStatus };
