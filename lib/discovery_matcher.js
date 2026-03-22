const { getTeamNames } = require("./discover_markets");
const logger = require("./logger");

/**
 * Checks if a kalshi team correctly matches within an event search area text.
 * Prevents "Virginia" matching "Virginia Tech" or "Tennessee" matching "Middle Tennessee State".
 */
function teamMatches(team, searchArea) {
  // If exact match (ignoring case), fast track
  if (searchArea === team) return true;

  // Escape regex chars
  const escapedTeam = team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\s|\\W)${escapedTeam}($|\\s|\\W)`, 'gi');
  
  let match;
  // We need to loop through all occurrences to see if ANY occurrence is a true match
  while ((match = regex.exec(searchArea)) !== null) {
    let isValid = true;
    
    // Check preceding words for directional/qualifier prefixes
    const prefixRegex = /\b(east|west|north|south|middle|northern|southern|eastern|western|central|florida|texas|loyola|mount|georgia)\s+$/i;
    const preText = searchArea.substring(0, match.index);
    if (prefixRegex.test(preText) && !team.match(/^(east|west|north|south|middle|northern|southern|eastern|western|central|florida|texas|loyola|mount|georgia)\b/i)) {
       isValid = false;
    }

    // Check succeeding words for qualifiers like "State", "Tech", "A&M", "Carolina"
    const suffixRegex = /^\s+(state|st\.|st|tech|a&m|carolina|dakota)\b/i;
    const postText = searchArea.substring(regex.lastIndex - (match[2] && match[2].length ? 1 : 0));
    if (suffixRegex.test(postText) && !team.match(/\b(state|st\.|st|tech|a&m|carolina|dakota)$/i)) {
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

  return markets.map((market) => {
    const marketTime = market.eventStartTime
      ? new Date(market.eventStartTime).getTime()
      : null;
    const teams = getTeamNames(market.title);
    if (teams.length === 0) return { market, tvEvent: null, espnEvent: null, ncaaEvent: null };

    // Match TV Events
    const tvEvent =
      tvEvents.find((event) => {
        const eventTime = event.startTimestamp
          ? new Date(event.startTimestamp).getTime()
          : null;
        if (
          marketTime &&
          eventTime &&
          Math.abs(marketTime - eventTime) > timeWindowMs
        )
          return false;

        let descriptionPart = event.description || "";
        if (descriptionPart.includes('\n')) {
            descriptionPart = descriptionPart.split('\n')[0];
        } else if (descriptionPart.includes('. ')) {
            descriptionPart = descriptionPart.split('. ')[0];
        }

        let searchArea =
          `${event.title} ${descriptionPart}`.toLowerCase();
        searchArea = searchArea.replace(/\bst\./g, "state").replace(/\bst\b/g, "state").replace(/state john's/g, "st. john's");
        return teams.every((team) => teamMatches(team, searchArea));
      }) || null;

    // Match ESPN Events
    const espnEvent =
      espnEvents.find((event) => {
        const eventTime = event.startTimestamp
          ? new Date(event.startTimestamp).getTime()
          : null;
        if (
          marketTime &&
          eventTime &&
          Math.abs(marketTime - eventTime) > timeWindowMs
        )
          return false;

        // Exclude Spanish broadcasts and alternate angles
        const titleLower = event.title.toLowerCase();
        if (
          event.network === "espndeportes" ||
          titleLower.includes("en español") ||
          titleLower.includes("above the rim")
        ) {
          return false;
        }

        let searchArea = event.title.toLowerCase();
        searchArea = searchArea.replace(/\bst\./g, "state").replace(/\bst\b/g, "state").replace(/state john's/g, "st. john's");
        return teams.every((team) => teamMatches(team, searchArea));
      }) || null;

    // Match NCAA Events
    const ncaaEvent =
      (ncaaEvents || []).find((event) => {
        const eventTime = event.time
          ? new Date(event.time).getTime()
          : null;
        if (
          marketTime &&
          eventTime &&
          Math.abs(marketTime - eventTime) > timeWindowMs
        )
          return false;

        let searchArea = `${event.awayTeam} ${event.homeTeam}`.toLowerCase();
        searchArea = searchArea.replace(/\bst\./g, "state").replace(/\bst\b/g, "state").replace(/state john's/g, "st. john's");
        return teams.every((team) => teamMatches(team, searchArea));
      }) || null;

    if (tvEvent || espnEvent || ncaaEvent) {
      logger.info(
        `[MATCH] "${market.title}" -> TV: ${tvEvent ? tvEvent.station : "None"}, ESPN: ${espnEvent ? espnEvent.network : "None"}, NCAA: ${ncaaEvent ? ncaaEvent.network : "None"}`,
      );
    }

    return {
      market,
      tvEvent,
      espnEvent,
      ncaaEvent,
    };
  });
}

module.exports = { matchDiscoveryEvents };
