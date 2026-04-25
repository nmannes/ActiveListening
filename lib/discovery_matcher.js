const { getTeamNames } = require("./discover_markets");
const { getAmazonLinkForMatchup } = require("./scrapers/league_schedule");
const { getOrderAmount } = require("./orderingConfig");
const { CHANNEL_MAPPINGS } = require("./yttv_channels");
const logger = require("./logger");
const fs = require("fs");
const path = require("path");

/**
 * Prints a discovery result object.
 */
function printMarket(result) {
  const { market, mediaSources } = result;
  const speakers =
    market.speakerEntities && market.speakerEntities.length > 0
      ? market.speakerEntities.map((s) => s.toLowerCase()).join(", ")
      : "none";

  const hasMediaSource = mediaSources && mediaSources.length > 0;
  const startTime = result.startTime || market.eventStartTime;
  const startTimeStr = startTime
    ? new Date(startTime).toISOString().replace("T", " ").substring(0, 16)
    : "N/A";

  const sourcesStr = (mediaSources || []).map(s => s.type).join(",");

  logger.debug(
    `| ${market.title} | ${startTimeStr} | ${speakers} | ${hasMediaSource ? "YES (" + sourcesStr + ")" : "NO"} | ${market.slug} |`,
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
  amazonEvents,
  cspanEvents,
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
      const hasSpeakers = market.speakerEntities && market.speakerEntities.length > 0;
      if (teams.length === 0 && !hasSpeakers && !isSNLMarket && !isChampionshipMarket && !isSurvivorMarket && !isMeetThePressMarket && !isLastWordMarket)
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
        const eventLeague = event.metadata?.league || (event.linkURL && event.linkURL.includes("/mlb/") ? "mlb" : event.linkURL && event.linkURL.includes("/nba/") ? "nba" : event.linkURL && event.linkURL.includes("/nhl/") ? "nhl" : null);

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
            // Increased to 36 hours because US evening games (e.g. 10 PM EDT)
            // can exceed 24 hours relative to UTC midnight of the target day.
            const diffHours = Math.abs(eventTime - marketSlugDate.getTime()) / 3600000;
            if (diffHours > 36) {
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

        const speakerMatch = market.speakerEntities && market.speakerEntities.length > 0 && market.speakerEntities.some((s) => {
          const sLower = s.toLowerCase();
          if (normalizedSearchArea.includes(sLower)) return true;
          const parts = sLower.split(" ");
          if (parts.length > 1) {
            const lastName = parts[parts.length - 1];
            // Safe regular expression since last name is generally alphabetic chars without regex specifiers
            const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`\\b${escapedLastName}\\b`, 'i');
            if (regex.test(normalizedSearchArea)) return true;
          }
          return false;
        });

        const res = (
          (teams.length > 0 &&
            teams.every((variants) =>
              variants.some((v) => teamMatches(v, normalizedSearchArea) || teamMatches(normalizeVariant(v), normalizedSearchArea)),
            )) || speakerMatch
        );
        return res;
      };

      // Find all matches across sources
      const matchedTv = tvEvents.filter((e) => {
        const eventTime = e.startTime
          ? new Date(e.startTime).getTime()
          : null;
        let descriptionPart = (e.description || "")
          .split("\n")[0]; // Take the entire first line, which usually lists guests

        const titleLower = (e.title || "").toLowerCase();
        const descLower = (e.description || "").toLowerCase();
        const channelLower = (e.channel || "").toLowerCase();

        // Filter out Spanish language broadcasts
        if (
          titleLower.includes("en español") ||
          titleLower.includes("baloncesto") ||
          titleLower.includes("fútbol") ||
          descLower.includes("en español") ||
          channelLower.includes("wzdc") || // Telemundo DC
          channelLower.includes("telemundo") ||
          channelLower.includes("univision") ||
          channelLower.includes("unimas")
        ) {
          return false;
        }

        return isMatch(e, eventTime, `${e.title} ${descriptionPart}`);
      });

      const matchedEspn = (espnEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        const searchArea = `${e.metadata?.awayTeam || ""} ${e.metadata?.homeTeam || ""}`;

        const tvChannels = e.metadata?.tvChannels || [];
        const isSpanish = tvChannels.some(
          (tc) =>
            tc.name.toLowerCase().includes("español") ||
            tc.name.toLowerCase().includes("deportes"),
        );

        if (isSpanish) return false;

        const isAppleTVOnly = tvChannels.length === 1 && tvChannels[0].name === "Apple TV";
        if (isAppleTVOnly) return false;

        const hasValidChannel = tvChannels.some((tc) => {
          const name = tc.name.toLowerCase();
          const isYttvChannel = Object.keys(CHANNEL_MAPPINGS).some((k) => {
            const kl = k.toLowerCase();
            return name === kl || name.includes(kl);
          });

          return (
            isYttvChannel ||
            name.includes("espn") ||
            name === "abc" ||
            name.includes("sec network") ||
            name.includes("acc network") ||
            name.includes("prime video") ||
            name.includes("amazon")
          );
        });

        if (!hasValidChannel) return false;

        return isMatch(e, eventTime, searchArea);
      });

      const matchedAmazon = (amazonEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, e.title);
      });

      const matchedCspan = (cspanEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, `${e.title} ${e.description}`);
      });

      // Create mediaSource objects for each match
      const mediaSources = [
        ...matchedTv.map((e) => ({
          type: "tv",
          name: e.channel || e.title,
          url: e.linkURL,
          startTime: e.startTime,
          metadata: e.metadata,
        })),
        ...matchedEspn.map((e) => {
          let gameLink = e.linkURL;
          let sourceName = e.channel || "ESPN";

          // Prioritize channels from CHANNEL_MAPPINGS if available in tvChannels
          const tvChannels = e.metadata?.tvChannels || [];
          const bestChannel = tvChannels.find((tc) => {
            const name = tc.name.toLowerCase();
            return Object.keys(CHANNEL_MAPPINGS).some((k) => {
              const kl = k.toLowerCase();
              return name === kl || name.includes(kl);
            });
          });

          if (bestChannel) {
            sourceName = bestChannel.name;
          }

          // Link Substitution Logic for Prime Video
          if (amazonEvents && amazonEvents.length > 0) {
            const hasPrime = sourceName.toLowerCase().includes("prime video");
            if (hasPrime) {
              const amazonLink = getAmazonLinkForMatchup(e.metadata.awayTeam, e.metadata.homeTeam, amazonEvents);
              if (amazonLink) {
                logger.debug(`Substituting ESPN link for ${e.metadata.awayTeam} vs ${e.metadata.homeTeam} with Prime Video link.`);
                gameLink = amazonLink;
                sourceName = "Amazon Prime Video";
              } else {
                // Fallback: construct Amazon search URL when game not found in scraped data
                const league = e.metadata.league || "sports";
                const searchQuery = encodeURIComponent(`${e.metadata.awayTeam} ${e.metadata.homeTeam} ${league}`);
                gameLink = `https://www.amazon.com/gp/video/search?phrase=${searchQuery}`;
                logger.info(`Prime Video game ${e.metadata.awayTeam} vs ${e.metadata.homeTeam} not found in Amazon data, using search fallback.`);
                sourceName = "Amazon Prime Video (Search)";
              }
            }
          }

          return {
            type: sourceName.includes("Amazon") ? "amazon" : "espn",
            name: sourceName,
            url: gameLink,
            startTime: e.startTime,
            metadata: e.metadata,
          };
        }),
        ...matchedAmazon.map((e) => ({
          type: "amazon",
          name: e.channel || "Amazon Prime Video",
          url: e.linkURL,
          startTime: e.startTime,
          metadata: e.metadata,
        })),
        ...matchedCspan.map((e) => ({
          type: "cspan",
          name: e.channel || "C-SPAN",
          url: e.linkURL,
          startTime: e.startTime,
          metadata: e.metadata,
        })),
      ];

      if (market.mediaStreamURL) {
        mediaSources.push({
          type: "market",
          name: "Market Stream",
          url: market.mediaStreamURL,
          startTime: market.eventStartTime,
          metadata: {},
        });
      }

      const resultsForMarket =
        mediaSources.length === 0
          ? [{ market, mediaSources: [] }]
          : [{ market, mediaSources }];

      resultsForMarket.forEach((res) => {
        // Explicitly filter out MLB.TV sources
        res.mediaSources = res.mediaSources.filter(s => (s.name || "").toUpperCase() !== "MLB.TV");
        printMarket(res);
      });

      return resultsForMarket;
    })
    .reduce((acc, curr) => {
      // Unique by slug: if we already have this slug, merge mediaSources
      const existing = acc.find((m) => m.market.slug === curr.market.slug);
      if (existing) {
        // Merge mediaSources, avoiding duplicates by URL
        curr.mediaSources.forEach(newSrc => {
          if (!existing.mediaSources.find(s => s.url === newSrc.url)) {
            existing.mediaSources.push(newSrc);
          }
        });
      } else {
        acc.push(curr);
      }
      return acc;
    }, [])
    .map((m) => {
      // Sort sources by type priority: tv > espn > amazon > cspan > market
      // Note: "market" (usually YouTube) has the lowest priority as per user request.
      const typePriority = { tv: 1, espn: 2, amazon: 3, cspan: 4, market: 5 };
      m.mediaSources.sort((a, b) => (typePriority[a.type] || 99) - (typePriority[b.type] || 99));

      // Use the earliest start time from media sources or market default
      const sourceStartTimes = m.mediaSources
        .map(s => s.startTime)
        .filter(t => !!t)
        .map(t => new Date(t).getTime());

      const earliestSourceTime = sourceStartTimes.length > 0 ? Math.min(...sourceStartTimes) : null;

      m.startTime =
        m.market.eventStartTime ||
        (earliestSourceTime ? new Date(earliestSourceTime).toISOString() : null);

      return m;
    });
}

module.exports = {
  matchDiscoveryEvents,
  teamMatches,
  printMarket,
};
