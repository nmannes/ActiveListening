const { getEventStatus, detectSport, getSuggestedDuration } = require("./event_status");
const logger = require("./logger");

/**
 * Periodically checks the status of an event and waits until it has started.
 * Returns a suggested fallback duration based on the detected sport.
 * @param {Object} market - Kalshi market object
 * @param {Object} [loggerOverride] - Optional logger to use
 * @returns {Promise<{ suggestedDurationMinutes: number }>}
 */
async function waitIfNecessary(market, loggerOverride) {
  const currentLogger = loggerOverride || logger;
  const title = market.title || market.slug;
  const startTime = market.eventStartTime
    ? new Date(market.eventStartTime)
    : null;

  const sportInfo = detectSport(market);
  const suggestedDuration = sportInfo
    ? getSuggestedDuration(sportInfo.sport)
    : 90;

  if (market.alreadyStarted === true) {
    currentLogger.info(
      `[wait] Market ${title} already marked as started, continuing immediately.`,
    );
    return { suggestedDurationMinutes: suggestedDuration };
  }

  // If the start time was more than 1 hour ago, assume it's already started (e.g. on fallback)
  if (startTime && Date.now() - startTime.getTime() > 1 * 60 * 60 * 1000) {
    currentLogger.info(
      `[wait] Market ${title} start time was over 1 hour ago (${startTime.toISOString()}), continuing.`,
    );
    return { suggestedDurationMinutes: suggestedDuration };
  }

  // Wait until the scheduled start time if it's in the future
  if (startTime && startTime.getTime() > Date.now()) {
    const waitMs = startTime.getTime() - Date.now();
    const waitSec = Math.round(waitMs / 1000);
    currentLogger.info(
      `[wait] Event "${title}" starts at ${startTime.toISOString()}, waiting ${waitSec}s...`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
    currentLogger.info(`[wait] Event "${title}" start time reached, verifying status...`);
  }

  // Double-check with ESPN API for sports events (harmless for non-sports)
  currentLogger.info(`[wait] Checking if event "${title}" has started...`);

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await getEventStatus(market);

    if (status === "live" || status === "final") {
      currentLogger.info(
        `[wait] Event "${title}" is now ${status.toUpperCase()}! Starting client.`,
      );
      return { suggestedDurationMinutes: suggestedDuration };
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

/**
 * Periodically checks the status of an event and waits until it has ended.
 * Returns a suggested fallback duration based on the detected sport.
 * @param {Object} market - Kalshi market object
 * @param {Object} [loggerOverride] - Optional logger to use
 * @returns {Promise<{ suggestedDurationMinutes: number }>}
 */
async function waitUntilEnded(market, loggerOverride) {
  const currentLogger = loggerOverride || logger;
  const title = market.title || market.slug;
  const startTime = market.eventStartTime
    ? new Date(market.eventStartTime)
    : null;

  const sportInfo = detectSport(market);
  const suggestedDuration = sportInfo
    ? getSuggestedDuration(sportInfo.sport)
    : 90;

  // If the start time was more than 6 hours ago, assume it's already over
  if (startTime && Date.now() - startTime.getTime() > 6 * 60 * 60 * 1000) {
    currentLogger.info(
      `[wait-end] Event "${title}" started over 6 hours ago, assuming it has ended.`,
    );
    return { suggestedDurationMinutes: suggestedDuration };
  }

  // Wait until the scheduled start time if it's in the future
  if (startTime && startTime.getTime() > Date.now()) {
    const waitMs = startTime.getTime() - Date.now();
    const waitSec = Math.round(waitMs / 1000);
    currentLogger.info(
      `[wait-end] Event "${title}" starts at ${startTime.toISOString()}, waiting ${waitSec}s...`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  currentLogger.info(`[wait-end] Polling for event "${title}" to end...`);

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await getEventStatus(market);

    if (status === "final") {
      currentLogger.info(
        `[wait-end] Event "${title}" has ended (FINAL). Proceeding.`,
      );
      return { suggestedDurationMinutes: suggestedDuration };
    }

    if (attempts === 0) {
      currentLogger.info(
        `[wait-end] Event "${title}" is still ${status}. Waiting...`,
      );
    } else if (attempts % 10 === 0) {
      currentLogger.info(
        `[wait-end] Still waiting for "${title}" to end... (attempts: ${attempts}, status: ${status})`,
      );
    }

    attempts++;
    const waitInterval = parseInt(process.env.TEST_WAIT_INTERVAL) || 30000;
    await new Promise((r) => setTimeout(r, waitInterval));
  }
}

module.exports = { waitIfNecessary, waitUntilEnded };
