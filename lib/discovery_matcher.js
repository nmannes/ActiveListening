const { getTeamNames } = require("./discover_markets");
const { getAmazonLinkForMatchup } = require("./scrapers/league_schedule");
const { getOrderAmount } = require("./orderingConfig");
const logger = require("./logger");
const fs = require("fs");
const path = require("path");

/**
 * Prints a discovery result object.
 */
function printMarket(result) {
  const { market, tvEvent, espnEvent } = result;
  const speakers =
    market.speakerEntities && market.speakerEntities.length > 0
      ? market.speakerEntities.map((s) => s.toLowerCase()).join(", ")
      : "none";

  const hasMediaSource = !!(tvEvent || espnEvent);
  const startTime =
    market.eventStartTime ||
    (tvEvent && tvEvent.startTimestamp) ||
    (espnEvent && espnEvent.startTime);
  const startTimeStr = startTime
    ? new Date(startTime).toISOString().replace("T", " ").substring(0, 16)
    : "N/A";

  logger.debug(
    `| ${market.title} | ${startTimeStr} | ${speakers} | ${hasMediaSource ? "YES" : "NO"} | ${market.slug} |`,
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
  amazonData,
  timeWindowMs = 4 * 60 * 60 * 1000,
) {

  return markets
    .flatMap((market) => {
      const title = (market.title || "").toLowerCase();
      market.orderAmount = getOrderAmount(market);

      const marketTime = market.eventStartTime
        ? new Date(market.eventStartTime).getTime()
        : null;
      const titleUpper = (market.title || "").toUpperCase();
      const isSNLMarket =
        titleUpper.includes("SNL") ||
        titleUpper.includes("SATURDAY NIGHT LIVE");
      const isChampionshipMarket =
        titleUpper.includes("NATIONAL CHAMPIONSHIP") ||
        titleUpper.includes("MARCH MADNESS") ||
        market.slug.includes("marmad");
      const isSurvivorMarket =
        titleUpper.includes("SURVIVOR") ||
        market.slug.includes("survivor");
      const isMeetThePressMarket =
        titleUpper.includes("MEET THE PRESS") ||
        market.slug.includes("kxmtpmention");
      const isLastWordMarket =
        titleUpper.includes("THE LAST WORD") ||
        titleUpper.includes("LAWRENCE O'DONNELL") ||
        titleUpper.includes("LAWRENCE O\u2019DONNELL");

      const teams = getTeamNames(market.title);
      if (teams.length === 0 && !isSNLMarket && !isChampionshipMarket && !isSurvivorMarket && !isMeetThePressMarket && !isLastWordMarket)
        return [];

      // Helper to check if an event matches the market
      const isMatch = (event, eventTime, searchArea) => {
        if (
          marketTime &&
          eventTime &&
          Math.abs(marketTime - eventTime) > timeWindowMs
        ) {
          return false;
        }

        // Sport/League Validation
        const marketSport = market.clipProfile || (market.slug.includes("mlb") ? "baseball" : market.slug.includes("nba") ? "basketball" : market.slug.includes("nhl") ? "hockey" : null);
        const eventLeague = event.league || (event.gameLink && event.gameLink.includes("/mlb/") ? "mlb" : event.gameLink && event.gameLink.includes("/nba/") ? "nba" : event.gameLink && event.gameLink.includes("/nhl/") ? "nhl" : null);

        if (marketSport && eventLeague) {
          const sportToLeague = {
            "baseball": "mlb",
            "basketball": "nba",
            "hockey": "nhl"
          };
          if (sportToLeague[marketSport] && sportToLeague[marketSport] !== eventLeague) {
            return false;
          }
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
          const eventTitle = (event.title || "").toUpperCase();
          if (
            eventTitle.includes("SATURDAY NIGHT LIVE") ||
            eventTitle.includes("SNL")
          ) {
            if (market.speakerEntities && market.speakerEntities.length > 0) {
              const res = market.speakerEntities.some((s) =>
                normalizedSearchArea.includes(s.toLowerCase()),
              );
              return res;
            }
            return true;
          }
        }

        // Special case for National Championship
        if (isChampionshipMarket) {
          // For ESPN/TV, only match if the title/description mentions Championship
          const titleSearch = (event.title || "").toUpperCase();
          const descSearch = (event.description || "").toUpperCase();
          if (titleSearch.includes("CHAMPIONSHIP") || titleSearch.includes("FINAL") ||
            descSearch.includes("CHAMPIONSHIP") || descSearch.includes("FINAL")) {
            return true;
          }
          return false;
        }

        // Special case for Survivor
        if (isSurvivorMarket) {
          const eventTitle = (event.title || "").toUpperCase();
          return eventTitle.includes("SURVIVOR");
        }

        // Special case for Meet the Press
        if (isMeetThePressMarket) {
          const eventTitle = (event.title || "").toUpperCase();
          if (eventTitle.includes("MEET THE PRESS")) {
            if (market.speakerEntities && market.speakerEntities.length > 0) {
              return market.speakerEntities.some((s) =>
                normalizedSearchArea.includes(s.toLowerCase()),
              );
            }
            return true;
          }
        }

        // Special case for The Last Word
        if (isLastWordMarket) {
          const eventTitle = (event.title || "").toUpperCase();
          if (eventTitle.includes("LAST WORD") || eventTitle.includes("LAWRENCE O'DONNELL") || eventTitle.includes("LAWRENCE O\u2019DONNELL")) {
            if (market.speakerEntities && market.speakerEntities.length > 0) {
              return market.speakerEntities.some((s) =>
                normalizedSearchArea.includes(s.toLowerCase()),
              );
            }
            return true;
          }
        }

        // Special case for title-to-title match (e.g. "Meet the Press" in market title and event title)
        const eventTitleUpper = (event.title || "").toUpperCase();
        if (eventTitleUpper.length > 3 && titleUpper.includes(eventTitleUpper)) {
          return true;
        }

        const normalizeVariant = (v) =>
          v.replace(/\bst\./g, "state").replace(/\bst\b/g, "state").replace(/state john's/g, "st. john's");
        const res = (
          teams.length > 0 &&
          teams.every((variants) =>
            variants.some((v) => teamMatches(v, normalizedSearchArea) || teamMatches(normalizeVariant(v), normalizedSearchArea)),
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
          .split("\n")[0]; // Take the entire first line, which usually lists guests

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

      const matchedEspn = (espnEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        const searchArea = `${e.awayTeam} ${e.homeTeam}`;

        const isSpanish = (e.tvChannels || []).some(
          (tc) =>
            tc.name.toLowerCase().includes("español") ||
            tc.name.toLowerCase().includes("deportes"),
        );

        if (isSpanish) return false;

        const isAppleTVOnly = (e.tvChannels || []).length === 1 && e.tvChannels[0].name === "Apple TV";
        if (isAppleTVOnly) return false;

        return isMatch(e, eventTime, searchArea);
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
          time: new Date(e.startTime).getTime(),
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
            time: match.time,
          };
          matchSets.push(set);
        }

        // Assign to the first empty slot of this type in the set (or overwrite if same type but better)
        if (match.type === "tv") set.tvEvent = match.event;
        if (match.type === "espn") set.espnEvent = match.event;
      }

      const resultsForMarket =
        matchSets.length === 0
          ? [{ market, tvEvent: null, espnEvent: null }]
          : matchSets.map(({ market, tvEvent, espnEvent }) => ({
            market,
            tvEvent,
            espnEvent,
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
      } else {
        acc.push(curr);
      }
      return acc;
    }, [])
    .map((m) => {
      m.startTime =
        m.market.eventStartTime ||
        (m.espnEvent && m.espnEvent.startTime) ||
        (m.tvEvent && m.tvEvent.startTimestamp);

      // Link Substitution Logic for Prime Video
      if (m.espnEvent && amazonData && amazonData.length > 0) {
        const hasPrime = (m.espnEvent.tvChannels || []).some(ch => ch.name.toLowerCase().includes("prime video"));
        if (hasPrime) {
          const amazonLink = getAmazonLinkForMatchup(m.espnEvent.awayTeam, m.espnEvent.homeTeam, amazonData);
          if (amazonLink) {
            logger.debug(`Substituting ESPN link for ${m.espnEvent.awayTeam} vs ${m.espnEvent.homeTeam} with Prime Video link.`);
            m.espnEvent = { ...m.espnEvent, gameLink: amazonLink };
          } else {
            // Fallback: construct Amazon search URL when game not found in scraped data
            const league = m.espnEvent.league || "sports";
            const searchQuery = encodeURIComponent(`${m.espnEvent.awayTeam} ${m.espnEvent.homeTeam} ${league}`);
            const fallbackLink = `https://www.amazon.com/gp/video/search?phrase=${searchQuery}`;
            logger.info(`Prime Video game ${m.espnEvent.awayTeam} vs ${m.espnEvent.homeTeam} not found in Amazon data, using search fallback.`);
            m.espnEvent = { ...m.espnEvent, gameLink: fallbackLink };
          }
        }
      }

      return m;
    });
}

module.exports = {
  matchDiscoveryEvents,
  teamMatches,
  printMarket,
};
