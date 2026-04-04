const { getEventStatus } = require("./event_status");
const logger = require("./logger");

/**
 * Periodically checks the status of an event and waits until it has started.
 * @param {Object} market - Kalshi market object
 * @param {Object} [loggerOverride] - Optional logger to use
 * @returns {Promise<void>}
 */
async function waitIfNecessary(market, loggerOverride) {
  const currentLogger = loggerOverride || logger;
  const title = market.title || market.slug;
  const startTime = market.eventStartTime
    ? new Date(market.eventStartTime)
    : null;

  if (market.alreadyStarted === true) {
    currentLogger.info(
      `[wait] Market ${title} already marked as started, continuing immediately.`,
    );
    return;
  }

  // If the start time was more than 1 hour ago, assume it's already started (e.g. on fallback)
  if (startTime && Date.now() - startTime.getTime() > 1 * 60 * 60 * 1000) {
    currentLogger.info(
      `[wait] Market ${title} start time was over 1 hour ago (${startTime.toISOString()}), continuing.`,
    );
    return;
  }

  currentLogger.info(`[wait] Checking if event "${title}" has started...`);

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await getEventStatus(market);

    if (status === "live" || status === "final") {
      currentLogger.info(
        `[wait] Event "${title}" is now ${status.toUpperCase()}! Starting client.`,
      );
      return;
    }

    if (attempts === 0) {
      currentLogger.info(
        `[wait] Event "${title}" hasn't started yet (status: UPCOMING). Waiting...`,
      );
    } else if (attempts % 10 === 0) {
      currentLogger.info(
        `[wait] Still waiting for "${title}" to start... (attempts: ${attempts})`,
      );
    }

    attempts++;
    // Wait before next check
    const waitInterval = parseInt(process.env.TEST_WAIT_INTERVAL) || 30000;
    await new Promise((r) => setTimeout(r, waitInterval));
  }
}

module.exports = { waitIfNecessary };
