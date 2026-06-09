const fs = require("fs");
const path = require("path");
const { getDuration } = require("./market_duration");
const { getHostScheduleTime } = require("./host_schedules");
const { runClientQueue, extractEventId } = require("./queues");
const {
  LAUNCH_BUFFER_MINUTES,
  START_BUFFER_SECONDS,
  STALE_THRESHOLD_MINUTES,
  SCHEDULE_PADDING_MINUTES,
} = require("./constants");

// ── 1. Load manual matches ──────────────────────────────────────────────

function loadManualMatches(cacheDir) {
  const manualPath = path.join(cacheDir, "manual_matches.json");
  if (!fs.existsSync(manualPath)) return [];

  let manualMatches = [];
  try {
    manualMatches = JSON.parse(fs.readFileSync(manualPath, "utf8"));
  } catch (e) {
    console.error(`Error reading ${manualPath}: ${e.message}`);
    return [];
  }

  manualMatches.forEach((m) => {
    if (!m.mediaSources) {
      m.mediaSources = [];
      if (m.market.mediaStreamURL) {
        m.mediaSources.push({
          type: "market",
          name: "Market Stream",
          url: m.market.mediaStreamURL,
          startTime: m.market.eventStartTime,
          metadata: {},
        });
      }
    }
  });

  return manualMatches;
}

// ── 2. Classify stream URL ──────────────────────────────────────────────

function classifyStream(streamURL) {
  if (!streamURL) return { isTv: false, isYoutube: false };
  const isTv = streamURL.includes("localhost:9981");
  const isYoutube =
    (streamURL.includes("youtube.com") || streamURL.includes("youtu.be")) &&
    !streamURL.includes("tv.youtube.com");
  return { isTv, isYoutube };
}

// ── 3. Collect candidates (flat list, no sequence grouping) ─────────────

function collectCandidates(matches, opts) {
  const { targetSlug, youtubeOnly, lookaheadMs, now } = opts;
  const lookaheadLimit = new Date(now.getTime() + lookaheadMs);
  const stalenessMs = STALE_THRESHOLD_MINUTES * 60 * 1000;

  const candidates = [];

  for (const match of matches) {
    const { market, mediaSources } = match;

    if (targetSlug && market.slug !== targetSlug) continue;

    const bestSource = mediaSources[0];
    const streamURL = bestSource?.url || null;

    if (
      youtubeOnly &&
      !(
        streamURL &&
        (streamURL.includes("youtube.com") || streamURL.includes("youtu.be"))
      )
    ) {
      continue;
    }

    const sourceName = (bestSource?.name || "").toUpperCase();
    if (sourceName === "APPLE TV" || sourceName === "MLB.TV") {
      console.log(
        `Skipping scheduling for ${market.title} - ${bestSource.name} not supported for recording`,
      );
      continue;
    }

    let scheduleStartTime =
      market?.eventStartTime ||
      bestSource?.startTime ||
      getHostScheduleTime(market, now) ||
      null;

    if (!streamURL) continue;

    if (!scheduleStartTime && targetSlug) {
      scheduleStartTime = now.toISOString();
    }

    if (!scheduleStartTime) continue;

    let startTime = new Date(scheduleStartTime);

    const isStale = startTime < new Date(now.getTime() - stalenessMs);
    if (isStale && !targetSlug) {
      console.log(
        `Skipping ${market.title} - started too long ago (${startTime.toLocaleString()})`,
      );
      continue;
    }

    if (startTime <= now) {
      startTime = new Date(now.getTime() + START_BUFFER_SECONDS * 1000);
    }

    if (startTime > lookaheadLimit) continue;

    if (Object.keys(market.keywords || {}).length === 0) {
      console.log(
        `Skipping ${market.title} - no keywords (likely duration market)`,
      );
      continue;
    }

    market.mediaStreamURL = streamURL;
    market.eventStartTime = startTime;
    market.alreadyStarted = startTime <= now;
    market.bestMediaSource = bestSource;
    market.mediaSourceCommonName = bestSource?.commonName || "Unknown";

    candidates.push(market);
  }

  candidates.sort(
    (a, b) => new Date(a.eventStartTime) - new Date(b.eventStartTime),
  );

  return { candidates };
}

// ── 4. Build scheduling decisions ───────────────────────────────────────

function buildScheduleDecisions(candidates, matches, scheduledDir) {
  const matchBySlug = new Map(matches.map((m) => [m.market.slug, m]));

  const decisions = [];

  for (const market of candidates) {
    const originalMatch = matchBySlug.get(market.slug);
    const startTime = new Date(market.eventStartTime);
    const slug = market.slug;
    const newFile = path.join(scheduledDir, `${slug}.json`);

    const marketDuration = getDuration(market, originalMatch);

    const overallLaunch = new Date(
      startTime.getTime() - LAUNCH_BUFFER_MINUTES * 60 * 1000,
    );
    const overallShutdown = new Date(
      startTime.getTime() + (marketDuration + SCHEDULE_PADDING_MINUTES) * 60 * 1000,
    );
    const serverDuration =
      marketDuration + LAUNCH_BUFFER_MINUTES + SCHEDULE_PADDING_MINUTES;

    const isAlreadyScheduled = fs.existsSync(newFile);
    const { isTv, isYoutube } = classifyStream(market.mediaStreamURL);

    decisions.push({
      market,
      slug,
      startTime,
      marketDuration,
      serverDuration,
      overallLaunch,
      overallShutdown,
      isAlreadyScheduled,
      isTv,
      isYoutube,
      newFile,
    });
  }

  return decisions;
}

// ── 5. Dry-run logging ─────────────────────────────────────────────────

function logScheduleDecisions(decisions) {
  for (const d of decisions) {
    const { market, startTime, slug } = d;

    console.log(`[DRY-RUN] Market: ${market.title}`);
    console.log(`          Event:   ${startTime.toLocaleString()}`);
    console.log(`          Stream:  ${market.mediaStreamURL || "NONE"}`);
    console.log(`          Source:  ${d.newFile}`);

    if (d.isAlreadyScheduled) {
      console.log(`          Status:  ALREADY SCHEDULED (Would be skipped)`);
    }
    console.log(`          Mode:    NEW Server (dedicated EC2)`);
    console.log(
      `          Server:  Launch at ${d.overallLaunch.toLocaleTimeString()}, Shutdown at ${d.overallShutdown.toLocaleTimeString()} (${d.serverDuration}m total)`,
    );
    console.log(
      `          BullMQ:  run-client job delayed until ${d.overallLaunch.toLocaleTimeString()}`,
    );
    console.log("");
  }
}

// ── 6. Execute scheduling ────────────────────────────────────────────────

async function executeScheduleDecisions(decisions, opts) {
  const { scheduledDir, homeScheduledDir, sendTelegram } = opts;

  for (const d of decisions) {
    const {
      market,
      slug,
      startTime,
      marketDuration,
      serverDuration,
      overallLaunch,
      isAlreadyScheduled,
      isTv,
      isYoutube,
      newFile,
    } = d;

    if (isAlreadyScheduled) {
      console.log(`Skipping ${market.title} - already scheduled`);
      continue;
    }

    // Mutate market for file output
    if (market.keywords) delete market.keywords["event does not qualify"];
    market.serverDuration = serverDuration;
    fs.writeFileSync(newFile, JSON.stringify(market, null, 2));

    if (homeScheduledDir) {
      try {
        const homeFile = path.join(homeScheduledDir, `${slug}.json`);
        fs.writeFileSync(homeFile, JSON.stringify(market, null, 2));
      } catch (e) {
        console.error(`Failed to write to home scheduled dir: ${e.message}`);
      }
    }

    try {
      console.log(
        `Scheduling ${market.title} for ${startTime.toLocaleString()}`,
      );
      console.log(`          Mode:   NEW Server (dedicated EC2)`);
      if (market.mediaStreamURL) {
        const displayStream = market.mediaStreamURL.includes("localhost")
          ? "localhost"
          : market.mediaStreamURL;
        console.log(`          Stream: ${displayStream}`);
      }
      console.log(
        `          Server: Launch at ${overallLaunch.toLocaleTimeString()}, Shutdown after ${serverDuration}m total`,
      );

      const absFile = path.resolve(newFile);
      const nowMs = Date.now();

      const clientDelay = overallLaunch.getTime() - nowMs;
      const eventId = extractEventId(market.mediaStreamURL);
      await runClientQueue.add(
        "run-client",
        {
          marketFile: absFile,
          duration: marketDuration + SCHEDULE_PADDING_MINUTES,
          browser: !isTv && !isYoutube,
          slug,
          shutdownMinutes: serverDuration,
        },
        { delay: Math.max(0, clientDelay), jobId: `${slug}-${eventId}` },
      );

      const channelName = market.mediaSourceCommonName || "NONE";
      const message = [
        `Scheduled Match: ${market.title}`,
        `${new Date().toLocaleString()} Time: ${startTime.toLocaleString()}`,
        `Mode: NEW Server`,
        `Channel: ${channelName}`,
        `Source: ${market.mediaStreamURL || ""}`,
      ].join("\n");
      sendTelegram(message).catch((e) =>
        console.error(`Failed to send Telegram: ${e.message}`),
      );

      console.log("");
    } catch (e) {
      console.error(`Failed to schedule ${market.title}: ${e.message}`);
    }
  }
}

// ── 7. Orchestrator ──────────────────────────────────────────────────────

async function processCandidates(candidates, matches, opts) {
  const decisions = buildScheduleDecisions(candidates, matches, opts.scheduledDir);
  if (opts.dryRun) {
    logScheduleDecisions(decisions);
  } else {
    await executeScheduleDecisions(decisions, opts);
  }
}

module.exports = {
  loadManualMatches,
  classifyStream,
  collectCandidates,
  processCandidates,
};
