const { getTeamNames } = require("./discover_markets");
const logger = require("./logger");

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
  timeWindowMs = 60 * 60 * 1000,
) {
  logger.info(
    `Starting matching for ${markets.length} markets with ${timeWindowMs / (60 * 1000)}m time window...`,
  );

  return markets.map((market) => {
    const marketTime = market.eventStartTime
      ? new Date(market.eventStartTime).getTime()
      : null;
    const teams = getTeamNames(market.title);
    if (teams.length === 0) return { market, tvEvent: null, espnEvent: null };

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

        const searchArea =
          `${event.title} ${event.description || ""}`.toLowerCase();
        return teams.every((team) => searchArea.includes(team));
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

        const searchArea = event.title.toLowerCase();
        return teams.every((team) => searchArea.includes(team));
      }) || null;

    if (tvEvent || espnEvent) {
      logger.info(
        `[MATCH] "${market.title}" -> TV: ${tvEvent ? tvEvent.station : "None"}, ESPN: ${espnEvent ? espnEvent.network : "None"}`,
      );
    }

    return {
      market,
      tvEvent,
      espnEvent,
    };
  });
}

module.exports = { matchDiscoveryEvents };
