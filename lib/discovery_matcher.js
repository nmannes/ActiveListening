const { getTeamNames } = require("./discover_markets");
const logger = require("./logger");

/**
 * Prints a discovery result object.
 */
function printMarket(result) {
  const { market, tvEvent, espnEvent, ncaaEvent } = result;
  const speakers =
    market.speakerEntities && market.speakerEntities.length > 0
      ? market.speakerEntities.map((s) => s.toLowerCase()).join(", ")
      : "none";

  const hasMediaSource = !!(tvEvent || espnEvent || ncaaEvent);
  logger.info(
    `| ${market.title} | ${speakers} | ${hasMediaSource ? "Yes" : "No"} |`,
  );
}

/**
 * Extracts a Date object from a Kalshi market slug (e.g., kxmlbmention-26apr03atlaz -> 2026-04-03).
 */
function getMarketDateFromSlug(slug) {
  const match = slug.match(/-(\d{2})([a-z]{3})(\d{2})/i);
  if (match) {
    const year = parseInt(match[1]) + 2000;
    const monthStr = match[2].toLowerCase();
    const day = parseInt(match[3]);

    const months = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    if (months[monthStr] !== undefined) {
      return new Date(Date.UTC(year, months[monthStr], day));
    }
  }
  return null;
}

/**
 * Checks if a kalshi team correctly matches within an event search area text.
 * Prevents "Virginia" matching "Virginia Tech" or "Tennessee" matching "Middle Tennessee State".
 */
function teamMatches(team, searchArea) {
  // If exact match (ignoring case), fast track
  if (searchArea === team) return true;

  // Escape regex chars
  const escapedTeam = team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s|\\W)${escapedTeam}($|\\s|\\W)`, "gi");

  let match;
  // We need to loop through all occurrences to see if ANY occurrence is a true match
  while ((match = regex.exec(searchArea)) !== null) {
    let isValid = true;

    // Check preceding words for directional/qualifier prefixes
    const prefixRegex =
      /\b(east|west|north|south|middle|northern|southern|eastern|western|central|florida|texas|loyola|mount|georgia)\s+$/i;
    const preText = searchArea.substring(0, match.index);
    if (
      prefixRegex.test(preText) &&
      !team.match(
        /^(east|west|north|south|middle|northern|southern|eastern|western|central|florida|texas|loyola|mount|georgia)\b/i,
      )
    ) {
      isValid = false;
    }

    // Check succeeding words for qualifiers like "State", "Tech", "A&M", "Carolina"
    const suffixRegex = /^\s+(state|st\.|st|tech|a&m|carolina|dakota)\b/i;
    const postText = searchArea.substring(
      regex.lastIndex - (match[2] && match[2].length ? 1 : 0),
    );
    if (
      suffixRegex.test(postText) &&
      !team.match(/\b(state|st\.|st|tech|a&m|carolina|dakota)$/i)
    ) {
      isValid = false;
    }

    if (isValid) return true;

    // reset lastIndex slightly to allow overlapping spaces
    regex.lastIndex -= 1;
  }

  return false;
}

/**
 * Matches Kalshi markets with TV and ESPN events based on team names and start times.
 * @param {Array} markets - Kalshi markets.
 * @param {Array} tvEvents - TV schedule events.
 * @param {Array} espnEvents - ESPN schedule events.
 * @param {number} timeWindowMs - Max difference in start times (default 1 hour).
 * @returns {Array} - Array of matched objects { market, tvEvent, espnEvent }.
 */
function matchDiscoveryEvents(
  markets,
  tvEvents,
  espnEvents,
  ncaaEvents,
  timeWindowMs = 4 * 60 * 60 * 1000,
) {
  logger.info(
    `Starting matching for ${markets.length} markets with ${timeWindowMs / (60 * 1000)}m time window...`,
  );
  logger.info(`| Title | Speakers | HasMediaSource |`);
  logger.info(`| :--- | :--- | :--- |`);

  return markets
    .flatMap((market) => {
      const marketTime = market.eventStartTime
        ? new Date(market.eventStartTime).getTime()
        : null;
      const titleUpper = (market.title || "").toUpperCase();
      const isSNLMarket =
        titleUpper.includes("SNL") || titleUpper.includes("SATURDAY NIGHT LIVE");

      const teams = getTeamNames(market.title);
      if (teams.length === 0 && !isSNLMarket) return [];

      // Helper to check if an event matches the market
      const isMatch = (event, eventTime, searchArea) => {
        if (
          marketTime &&
          eventTime &&
          Math.abs(marketTime - eventTime) > timeWindowMs
        ) {
          return false;
        }

        // If marketTime is missing, try to extract date from slug and compare with event date
        if (!marketTime) {
          const marketSlugDate = getMarketDateFromSlug(market.slug);
          if (marketSlugDate && eventTime) {
            const eventDate = new Date(eventTime);
            // Get local date string for comparison to avoid UTC day boundary issues for US events
            const marketDateStr = marketSlugDate.toISOString().split("T")[0];
            // Treat the event as being on the same day if it's within 12 hours of the market date's start (in UTC)
            // This is a heuristic but works for most US-based events.
            const diffHours = Math.abs(eventTime - marketSlugDate.getTime()) / 3600000;
            if (diffHours > 24) {
              return false;
            }
          }
        }

        const normalizedSearchArea = searchArea
          .toLowerCase()
          .replace(/\bst\./g, "state")
          .replace(/\bst\b/g, "state")
          .replace(/state john's/g, "st. john's");

        // Special case for SNL
        if (isSNLMarket) {
          console.log("Is SNL Market");
          const eventTitle = (event.title || "").toUpperCase();
          if (
            eventTitle.includes("SATURDAY NIGHT LIVE") ||
            eventTitle.includes("SNL")
          ) {
            console.log("Event is SNL Event");
            if (market.speakerEntities && market.speakerEntities.length > 0) {
              const res = market.speakerEntities.some((s) =>
                normalizedSearchArea.includes(s.toLowerCase()),
              );
              console.log(`Speaker check result: ${res}`);
              return res;
            }
            return true;
          }
        }

        const res = (
          teams.length > 0 &&
          teams.every((variants) =>
            variants.some((v) => teamMatches(v, normalizedSearchArea)),
          )
        );
        return res;
      };

      // Find all matches across sources
      const matchedTv = tvEvents.filter((e) => {
        const eventTime = e.startTimestamp
          ? new Date(e.startTimestamp).getTime()
          : null;
        let descriptionPart = (e.description || "")
          .split("\n")[0]
          .split(". ")[0];

        const titleLower = (e.title || "").toLowerCase();
        const descLower = (e.description || "").toLowerCase();
        const stationLower = (e.station || "").toLowerCase();

        // Filter out Spanish language broadcasts
        if (
          titleLower.includes("en español") ||
          titleLower.includes("baloncesto") ||
          titleLower.includes("fútbol") ||
          descLower.includes("en español") ||
          stationLower.includes("wzdc") || // Telemundo DC
          stationLower.includes("telemundo") ||
          stationLower.includes("univision") ||
          stationLower.includes("unimas")
        ) {
          return false;
        }

        return isMatch(e, eventTime, `${e.title} ${descriptionPart}`);
      });

      const matchedEspn = espnEvents.filter((e) => {
        const eventTime = e.startTimestamp
          ? new Date(e.startTimestamp).getTime()
          : null;
        const titleLower = e.title.toLowerCase();
        if (
          e.network === "espndeportes" ||
          e.network === "mlb" ||
          titleLower.includes("en español") ||
          titleLower.includes("above the rim") ||
          titleLower.includes("courtside") ||
          titleLower.includes("featured group") ||
          titleLower.includes("featured hole")
        ) {
          return false;
        }
        return isMatch(e, eventTime, e.title);
      });

      const matchedNcaa = (ncaaEvents || []).filter((e) => {
        const eventTime = e.time ? new Date(e.time).getTime() : null;
        return isMatch(e, eventTime, `${e.awayTeam} ${e.homeTeam}`);
      });

      // Group matches into "sets" based on start time (allowing for some drift)
      const matchSets = [];
      const allMatches = [
        ...matchedTv.map((e) => ({
          type: "tv",
          event: e,
          time: new Date(e.startTimestamp).getTime(),
        })),
        ...matchedEspn.map((e) => ({
          type: "espn",
          event: e,
          time: new Date(e.startTimestamp).getTime(),
        })),
        ...matchedNcaa.map((e) => ({
          type: "ncaa",
          event: e,
          time: new Date(e.time).getTime(),
        })),
      ];

      // Sort by time to group greedy
      allMatches.sort((a, b) => a.time - b.time);

      for (const match of allMatches) {
        // Find an existing set within a 30m window
        let set = matchSets.find(
          (s) => Math.abs(s.time - match.time) < 30 * 60 * 1000,
        );
        if (!set) {
          set = {
            market,
            tvEvent: null,
            espnEvent: null,
            ncaaEvent: null,
            time: match.time,
          };
          matchSets.push(set);
        }

        // Assign to the first empty slot of this type in the set (or overwrite if same type but better)
        if (match.type === "tv") set.tvEvent = match.event;
        if (match.type === "espn") set.espnEvent = match.event;
        if (match.type === "ncaa") set.ncaaEvent = match.event;
      }

      const resultsForMarket =
        matchSets.length === 0
          ? [{ market, tvEvent: null, espnEvent: null, ncaaEvent: null }]
          : matchSets.map(({ market, tvEvent, espnEvent, ncaaEvent }) => ({
            market,
            tvEvent,
            espnEvent,
            ncaaEvent,
          }));

      resultsForMarket.forEach((res) => printMarket(res));

      return resultsForMarket;
    })
    .reduce((acc, curr) => {
      // Unique by slug: if we already have this slug, merge events
      const existing = acc.find((m) => m.market.slug === curr.market.slug);
      if (existing) {
        if (curr.tvEvent) existing.tvEvent = curr.tvEvent;
        if (curr.espnEvent) existing.espnEvent = curr.espnEvent;
        if (curr.ncaaEvent) existing.ncaaEvent = curr.ncaaEvent;
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);
}

module.exports = {
  matchDiscoveryEvents,
  teamMatches,
  printMarket,
};
