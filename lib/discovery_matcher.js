const { getTeamNames } = require("./discover_markets");
const { getAmazonLinkForMatchup } = require("./scrapers/league_schedule");
const { CHANNEL_MAPPINGS } = require("./yttv_channels");
const { getMediaSourceCommonName } = require("./channel_names");
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
 * Extracts context keywords from a market title by removing speaker names and
 * common stop words. Used to disambiguate speaker-based matches (e.g. a market
 * about "Trump remarks in New York" should not match every Trump event).
 * Returns an array of lowercased content words, or [] if too few to be useful.
 */
function extractContextKeywords(title, speakerEntities) {
  const stopWords = new Set([
    'what', 'will', 'say', 'says', 'said', 'during', 'his', 'her', 'the', 'a', 'an',
    'in', 'at', 'on', 'of', 'to', 'for', 'and', 'or', 'by', 'with', 'about',
    'their', 'this', 'that', 'these', 'those', 'it', 'is', 'be', 'are',
    'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'but', 'not', 'no', 'if', 'so', 'as', 'from',
    'into', 'through', 'after', 'before', 'between', 'under', 'again',
    'then', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
    'same', 'can', 'just', 'should', 'now', 'up', 'out', 'over', 'who',
  ]);

  let cleaned = title.toLowerCase().replace(/[?.,!:'"]/g, ' ');

  if (speakerEntities) {
    for (const s of speakerEntities) {
      // Remove the full name and each individual part (first/last name)
      const parts = s.split(/\s+/);
      for (const part of parts) {
        const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cleaned = cleaned.replace(new RegExp(escaped, 'gi'), ' ');
      }
    }
  }

  const words = cleaned.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  return words;
}

/**
 * Strips combining diacritical marks so "Türkiye" matches "Turkiye",
 * "Curaçao" matches "Curacao", etc.
 */
function stripDiacritics(str) {
  return str.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/**
 * Checks if a kalshi team correctly matches within an event search area text.
 * Prevents "Virginia" matching "Virginia Tech" or "Tennessee" matching "Middle Tennessee State".
 */
function teamMatches(team, searchArea) {
  // Normalize diacritics so Türkiye/Turkiye, Curaçao/Curacao etc. match
  team = stripDiacritics(team);
  searchArea = stripDiacritics(searchArea);

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

    // Check for political affiliation patterns like D-NY or R-TX
    if (match[1] === "-") {
      const charBefore = searchArea.charAt(match.index - 1);
      const charBeforeThat = searchArea.charAt(match.index - 2);
      if (/[a-z]/i.test(charBefore) && (!charBeforeThat || /[^\w]/.test(charBeforeThat))) {
        isValid = false;
      }
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
  foxnewsEvents = [],
  youtubeUpcoming = [],
  msnbcEvents = [],
  timeWindowMs = 4 * 60 * 60 * 1000,
) {

  return markets
    .flatMap((market) => {
      const title = (market.title || "").toLowerCase();
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
      const isMatch = (event, eventTime, searchArea, sourceType) => {
        // Trump markets match any Trump event — use a 24h window
        const isTrumpMarket = market.speakerEntities && market.speakerEntities.some(
          s => s.toLowerCase() === 'donald trump'
        );
        const effectiveTimeWindow = isTrumpMarket ? 24 * 60 * 60 * 1000 : timeWindowMs;

        if (
          marketTime &&
          eventTime &&
          Math.abs(marketTime - eventTime) > effectiveTimeWindow
        ) {
          return false;
        }

        // Sport/League Validation
        const marketSport = market.clipProfile || (market.slug.includes("mlb") ? "baseball" : market.slug.includes("nba") ? "basketball" : market.slug.includes("nhl") ? "hockey" : market.slug.includes("kxwc") ? "soccer" : null);
        const eventLeague = event.metadata?.league || (event.linkURL && event.linkURL.includes("/mlb/") ? "mlb" : event.linkURL && event.linkURL.includes("/nba/") ? "nba" : event.linkURL && event.linkURL.includes("/nhl/") ? "nhl" : event.linkURL && event.linkURL.includes("/fifa/") ? "fifa.world" : null);

        if (marketSport && eventLeague) {
          const sportToLeague = {
            "baseball": "mlb",
            "basketball": "nba",
            "hockey": "nhl",
            "soccer": "fifa.world"
          };
          if (sportToLeague[marketSport] && sportToLeague[marketSport] !== eventLeague) {
            return false;
          }
        }

        // If marketTime is missing, try to extract date from slug and compare with event date
        if (!marketTime) {
          const marketSlugDate = getMarketDateFromSlug(market.slug);
          if (marketSlugDate && eventTime) {
            // For non-sports sources (news/talk shows), the slug date may not match
            // the air date (e.g. market created one day, show airs the next).
            // Use a wider window to allow for these date shifts.
            const isNewsSource = sourceType === 'foxnews' || sourceType === 'msnbc' || sourceType === 'cspan' || sourceType === 'tv' || sourceType === 'youtube_upcoming';
            const isSpeakerOnlyMarket = hasSpeakers && teams.length === 0 && !marketSport && !isSNLMarket && !isChampionshipMarket && !isSurvivorMarket && !isMeetThePressMarket && !isLastWordMarket;
            const maxHours = isTrumpMarket ? 72 : (isSpeakerOnlyMarket ? 24 : (isNewsSource ? 72 : 36));
            const diffHours = Math.abs(eventTime - marketSlugDate.getTime()) / 3600000;
            if (diffHours > maxHours) {
              return false;
            }
          }
        }

        const normalizedSearchArea = stripDiacritics(
          searchArea
            .toLowerCase()
            .replace(/\bst\./g, "state")
            .replace(/\bst\b/g, "state")
            .replace(/state john's/g, "st. john's"),
        );

        // Special case for SNL
        if (isSNLMarket) {
          const eventTitle = (event.title || "").toUpperCase();
          if (
            eventTitle.includes("SATURDAY NIGHT LIVE") ||
            eventTitle.includes("SNL")
          ) {
            if (sourceType === "tv") {
              const channelLower = (event.channel || "").toLowerCase();
              if (!channelLower.includes("wrc") && !channelLower.includes("4.1") && !channelLower.includes("nbc")) {
                return false;
              }
            }
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
          if (sourceType === "cspan") return false;
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

        // Postgame Disambiguation: If market is postgame/presser, event should be too
        const isPostgameMarket = titleUpper.includes("POSTGAME") || titleUpper.includes("PRESS CONFERENCE");
        const isPostgameEvent = eventTitleUpper.includes("POSTGAME") || eventTitleUpper.includes("PRESS CONFERENCE") || normalizedSearchArea.includes("postgame") || normalizedSearchArea.includes("press conference");
        if (isPostgameMarket && !isPostgameEvent) {
          return false;
        }

        if (eventTitleUpper.length > 3 && titleUpper.includes(eventTitleUpper)) {
          return true;
        }
        // Normalize event title: strip filler words like "NEWS" that networks
        // add to show names (e.g. "CBS NEWS SUNDAY MORNING" → "CBS SUNDAY MORNING")
        const eventTitleNormalized = eventTitleUpper.replace(/\bNEWS\b\s*/g, '').trim();
        if (eventTitleNormalized.length > 3 && eventTitleNormalized !== eventTitleUpper && titleUpper.includes(eventTitleNormalized)) {
          return true;
        }
        // For youtube_upcoming events, match if the market's context keywords
        // (show name after stripping speaker names) all appear in the event title.
        // YouTube event titles often include emoji, "LIVE:", and dates that prevent
        // the title-to-title check from working. E.g. market "Keir Starmer PMQs"
        // vs. event "🔴 PMQs LIVE: Prime Minister's Questions - 17 June 2026"
        if (sourceType === "youtube_upcoming") {
          const ckw = extractContextKeywords(market.title, market.speakerEntities);
          if (ckw.length >= 2 && ckw.every((w) => eventTitleUpper.includes(w.toUpperCase()))) {
            return true;
          }
        }

        const normalizeVariant = (v) =>
          v.replace(/\bst\./g, "state").replace(/\bst\b/g, "state").replace(/state john's/g, "st. john's");

        const speakerMatch = market.speakerEntities && market.speakerEntities.length > 0 && market.speakerEntities.some((s) => {
          const sLower = s.toLowerCase();
          if (normalizedSearchArea.includes(sLower)) return true;
          const parts = sLower.split(" ");
          if (parts.length > 1) {
            const lastName = parts[parts.length - 1];
            const firstName = parts[0];
            const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`\\b${escapedLastName}\\b`, 'gi');
            let match;
            while ((match = regex.exec(normalizedSearchArea)) !== null) {
              // Check preceding word isn't a different first name (e.g. "Lara Trump" != "Donald Trump")
              const preText = normalizedSearchArea.substring(0, match.index);
              const preWords = preText.split(/\s+/).filter(Boolean);
              const precedingWord = preWords[preWords.length - 1] || '';
              if (precedingWord && /^[a-z]+$/.test(precedingWord) && precedingWord !== firstName) {
                const functionWords = new Set(['the', 'a', 'an', 'for', 'with', 'and', 'or', 'of', 'to', 'in', 'on', 'by', 'at', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'about', 'president', 'potus', 'vp', 'live', 'campaign', 'former']);
                if (!functionWords.has(precedingWord)) {
                  continue;
                }
              }
              return true;
            }
          }
          return false;
        });

        const res = (
          (teams.length > 0 &&
            teams.every((variants) =>
              variants.some((v) => teamMatches(v, normalizedSearchArea) || teamMatches(normalizeVariant(v), normalizedSearchArea)),
            )) || speakerMatch
        );
        
        // Stricter matching for speaker-only markets to prevent matching
        // different events by the same person on the same day
        // (Trump markets are excluded — they match any Trump event)
        if (res && speakerMatch && !marketSport && !isSNLMarket && !isMeetThePressMarket && !isLastWordMarket && !isTrumpMarket) {
          // Context-keyword check: if the market title has location/context words
          // (e.g. "remarks in New York"), require at least one to appear in the event
          const contextKeywords = extractContextKeywords(market.title, market.speakerEntities);
          if (contextKeywords.length >= 2) {
            const hasContextMatch = contextKeywords.some(kw => normalizedSearchArea.includes(kw));
            if (!hasContextMatch) {
              return false;
            }
          }

          // Stricter time window: use marketTime or fall back to slug date at noon
          const slugDate = getMarketDateFromSlug(market.slug);
          const effectiveMarketTime = marketTime || (slugDate ? slugDate.getTime() + 12 * 60 * 60 * 1000 : null);
          if (effectiveMarketTime && eventTime && Math.abs(effectiveMarketTime - eventTime) > 12 * 60 * 60 * 1000) {
            return false;
          }
        }

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

        return isMatch(e, eventTime, `${e.title} ${descriptionPart}`, "tv");
      });

      const matchedEspn = (espnEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        const cleanTeam = (name) => (name || "").replace(/^v\s+/i, "").replace(/ /g, " ").trim();
        const searchArea = `${cleanTeam(e.metadata?.awayTeam)} ${cleanTeam(e.metadata?.homeTeam)}`;

        const tvChannels = (e.metadata?.tvChannels || []).filter((tc) => {
          const n = tc.name.toLowerCase();
          return !n.includes("español") &&
            !n.includes("deportes") &&
            n !== "tele";
        });

        // Removed Apple TV filter to allow matches as requested

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

        return isMatch(e, eventTime, searchArea, "espn");
      });

      const matchedAmazon = (amazonEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, e.title, "amazon");
      });

      const matchedCspan = (cspanEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, `${e.title} ${e.description}`, "cspan");
      });

      const matchedFoxnews = (foxnewsEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, `${e.title} ${e.description}`, "foxnews");
      });

      const matchedMsnbc = (msnbcEvents || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, `${e.title} ${e.description}`, "msnbc");
      });

      const matchedYoutubeUpcoming = (youtubeUpcoming || []).filter((e) => {
        const eventTime = e.startTime ? new Date(e.startTime).getTime() : null;
        return isMatch(e, eventTime, `${e.title} ${e.description}`, "youtube_upcoming");
      });

      // Create mediaSource objects for each match
      const mediaSources = [
        ...matchedTv.map((e) => {
          const ms = {
            type: "tv",
            name: e.channel || e.title,
            url: e.linkURL,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
        ...matchedEspn.map((e) => {
          let gameLink = e.linkURL;
          let sourceName = e.channel || "ESPN";

          // Prioritize channels from CHANNEL_MAPPINGS if available in tvChannels
          const tvChannels = e.metadata?.tvChannels || [];
          const bestChannel = tvChannels.find((tc) => {
            const name = tc.name;
            // Skip MLB.TV — we never want it as the source
            if (name.toUpperCase() === "MLB.TV") return false;
            return Object.keys(CHANNEL_MAPPINGS).some((k) => {
              const kl = k.toLowerCase();
              return name.toLowerCase() === kl || name.toLowerCase().includes(kl);
            });
          });

          if (bestChannel) {
            sourceName = bestChannel.name;
            // Also fix the URL to use the YTTV link from CHANNEL_MAPPINGS
            const mappedLink = CHANNEL_MAPPINGS[bestChannel.name];
            if (mappedLink) {
              gameLink = mappedLink;
            }
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

          const ms = {
            type: sourceName.includes("Amazon") ? "amazon" : "espn",
            name: sourceName,
            url: gameLink,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
        ...matchedAmazon.map((e) => {
          const ms = {
            type: "amazon",
            name: e.channel || "Amazon Prime Video",
            url: e.linkURL,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
        ...matchedCspan.map((e) => {
          const ms = {
            type: "cspan",
            name: e.channel || "C-SPAN",
            url: e.linkURL,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
        ...matchedFoxnews.map((e) => {
          const ms = {
            type: "tv",
            name: e.channel || "Fox News",
            url: CHANNEL_MAPPINGS["Fox News"] || e.linkURL,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
        ...matchedMsnbc.map((e) => {
          const ms = {
            type: "tv",
            name: e.channel || "MS NOW",
            url: CHANNEL_MAPPINGS["MS NOW"] || e.linkURL,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
        ...matchedYoutubeUpcoming.map((e) => {
          const ms = {
            type: "youtube",
            name: e.channel || "YouTube",
            url: e.linkURL,
            startTime: e.startTime,
            metadata: e.metadata,
          };
          ms.commonName = getMediaSourceCommonName(ms);
          return ms;
        }),
      ];

      if (market.mediaStreamURL) {
        const ms = {
          type: "market",
          name: "Market Stream",
          url: market.mediaStreamURL,
          startTime: market.eventStartTime,
          metadata: {},
        };
        ms.commonName = getMediaSourceCommonName(ms);
        mediaSources.push(ms);
      }

      const resultsForMarket =
        mediaSources.length === 0
          ? [{ market, mediaSources: [] }]
          : [{ market, mediaSources }];

      resultsForMarket.forEach((res) => {
        // MLB.TV filtering removed to allow matches as requested
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
      const marketTime = m.market.eventStartTime ? new Date(m.market.eventStartTime).getTime() : null;
      m.mediaSources.sort((a, b) => {
        const typeDiff = (typePriority[a.type] || 99) - (typePriority[b.type] || 99);
        if (typeDiff !== 0) return typeDiff;
        // Within the same type, prefer the source closest to the market's event time
        if (marketTime) {
          const aDist = a.startTime ? Math.abs(new Date(a.startTime).getTime() - marketTime) : Infinity;
          const bDist = b.startTime ? Math.abs(new Date(b.startTime).getTime() - marketTime) : Infinity;
          return aDist - bDist;
        }
        return 0;
      });

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
  extractContextKeywords,
  teamMatches,
  printMarket,
};
