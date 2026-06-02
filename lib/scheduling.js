const fs = require("fs");
const path = require("path");
const { getDuration } = require("./market_duration");
const { getHostScheduleTime } = require("./host_schedules");
const { gpuServerQueue, runClientQueue } = require("./queues");
const {
  LAUNCH_BUFFER_MINUTES,
  START_BUFFER_SECONDS,
  STALE_THRESHOLD_MINUTES,
  SEQUENCE_GAP_MINUTES,
  SCHEDULE_PADDING_MINUTES,
} = require("./constants");

// ── 1. Load existing server windows ─────────────────────────────────────

function loadServerWindows(scheduledDir, force, matchSlugs) {
  const windows = [];
  if (!fs.existsSync(scheduledDir)) return windows;

  const files = fs.readdirSync(scheduledDir).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const slug = f.replace(".json", "");
    if (force && matchSlugs.has(slug)) continue;

    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(scheduledDir, f), "utf8"),
      );
      if (data.eventStartTime && !data.clientOnly) {
        const start = new Date(data.eventStartTime);
        const duration = data.serverDuration || 75;
        windows.push({
          start: new Date(start.getTime() - LAUNCH_BUFFER_MINUTES * 60 * 1000),
          end: new Date(start.getTime() + duration * 60 * 1000),
        });
      }
    } catch (e) {
      console.error(`Error reading ${f}: ${e.message}`);
    }
  }
  return windows;
}

// ── 2. Load manual matches ──────────────────────────────────────────────

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

// ── 3. Classify stream URL ──────────────────────────────────────────────

function classifyStream(streamURL) {
  if (!streamURL) return { isTv: false, isYoutube: false };
  const isTv = streamURL.includes("localhost:9981");
  const isYoutube =
    (streamURL.includes("youtube.com") || streamURL.includes("youtu.be")) &&
    !streamURL.includes("tv.youtube.com");
  return { isTv, isYoutube };
}

// ── 4. Collect and group candidates ─────────────────────────────────────

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
    let alreadyStarted = false;

    const isStale = startTime < new Date(now.getTime() - stalenessMs);
    if (isStale && !targetSlug) {
      console.log(
        `Skipping ${market.title} - started too long ago (${startTime.toLocaleString()})`,
      );
      continue;
    }

    if (startTime <= now) {
      alreadyStarted = true;
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
    market.alreadyStarted = alreadyStarted;
    market.bestMediaSource = bestSource;
    market.mediaSourceCommonName = bestSource?.commonName || "Unknown";

    candidates.push(market);
  }

  candidates.sort(
    (a, b) => new Date(a.eventStartTime) - new Date(b.eventStartTime),
  );

  // Group into sequences
  const sequences = [];
  let currentSequence = null;

  for (const m of candidates) {
    if (!currentSequence) {
      currentSequence = [m];
    } else {
      const lastM = currentSequence[currentSequence.length - 1];
      const gapMinutes =
        (new Date(m.eventStartTime) - new Date(lastM.eventStartTime)) / 60000;
      if (gapMinutes <= SEQUENCE_GAP_MINUTES) {
        currentSequence.push(m);
      } else {
        sequences.push(currentSequence);
        currentSequence = [m];
      }
    }
  }
  if (currentSequence) sequences.push(currentSequence);

  return { sequences, candidates };
}

// ── 5. Build scheduling decisions ───────────────────────────────────────

function buildScheduleDecisions(sequences, matches, serverWindows, opts) {
  const { force, scheduledDir } = opts;

  // Index matches by slug for O(1) lookup
  const matchBySlug = new Map(matches.map((m) => [m.market.slug, m]));

  const decisions = [];

  for (const seq of sequences) {
    const firstM = seq[0];

    const seqStart = new Date(firstM.eventStartTime);
    const overallLaunch = new Date(
      seqStart.getTime() - LAUNCH_BUFFER_MINUTES * 60 * 1000,
    );

    let maxEndTime = 0;
    for (const m of seq) {
      const mStartTime = new Date(m.eventStartTime).getTime();
      const duration = getDuration(m, matchBySlug.get(m.slug));
      const mEndTime = mStartTime + duration * 60 * 1000;
      if (mEndTime > maxEndTime) maxEndTime = mEndTime;
    }

    const overallShutdown = new Date(maxEndTime);
    const optimizedDuration =
      Math.ceil((overallShutdown - overallLaunch) / 60000) -
      LAUNCH_BUFFER_MINUTES;

    let seqServerWindow = null;

    for (const market of seq) {
      const originalMatch = matchBySlug.get(market.slug);
      const startTime = new Date(market.eventStartTime);
      const slug = market.slug;
      const newFile = path.join(scheduledDir, `${slug}.json`);

      const marketDuration = getDuration(market, originalMatch);

      const estimatedEndTime = new Date(
        startTime.getTime() + marketDuration * 60 * 1000,
      );

      let reusableWindow = serverWindows.find(
        (w) => w.start <= startTime && w.end >= estimatedEndTime,
      );

      if (!reusableWindow && seqServerWindow) {
        if (
          seqServerWindow.start <= startTime &&
          seqServerWindow.end >= estimatedEndTime
        ) {
          reusableWindow = seqServerWindow;
        }
      }

      const clientOnly = market.alreadyStarted || !!reusableWindow;
      const serverDuration = clientOnly ? 0 : optimizedDuration;
      const isAlreadyScheduled = fs.existsSync(newFile) && !force;
      const { isTv, isYoutube } = classifyStream(market.mediaStreamURL);

      decisions.push({
        market,
        slug,
        startTime,
        marketDuration,
        clientOnly,
        serverDuration,
        optimizedDuration,
        reusableWindow: reusableWindow || null,
        overallLaunch,
        overallShutdown,
        isAlreadyScheduled,
        isTv,
        isYoutube,
        newFile,
      });

      if (!clientOnly) {
        seqServerWindow = { start: overallLaunch, end: overallShutdown };
      }
    }
  }

  return decisions;
}

// ── 6. Dry-run logging ─────────────────────────────────────────────────

function logScheduleDecisions(decisions) {
  for (const d of decisions) {
    const { market, startTime, slug, clientOnly, reusableWindow } = d;

    console.log(`[DRY-RUN] Market: ${market.title}`);
    console.log(`          Event:   ${startTime.toLocaleString()}`);
    console.log(`          Stream:  ${market.mediaStreamURL || "NONE"}`);
    console.log(`          Source:  ${d.newFile}`);

    if (d.isAlreadyScheduled) {
      console.log(`          Status:  ALREADY SCHEDULED (Would be skipped)`);
    }
    console.log(
      `          Mode:    ${clientOnly ? (reusableWindow ? "REUSE Server (Client Only)" : "Client Only (Started)") : "NEW Server (Full Run)"}`,
    );
    if (!clientOnly) {
      console.log(
        `          Server:  Launch at ${d.overallLaunch.toLocaleTimeString()}, Shutdown at ${d.overallShutdown.toLocaleTimeString()} (${d.optimizedDuration + LAUNCH_BUFFER_MINUTES}m total)`,
      );
    } else if (reusableWindow) {
      console.log(
        `          Using:   Existing server window (${reusableWindow.start.toLocaleTimeString()} - ${reusableWindow.end.toLocaleTimeString()})`,
      );
    }

    if (!clientOnly) {
      console.log(
        `          BullMQ:  gpu-server job delayed until ${d.overallLaunch.toLocaleTimeString()}`,
      );
    }
    console.log(
      `          BullMQ:  run-client job delayed until ${startTime.toLocaleTimeString()}${!d.isTv && !d.isYoutube ? " (browser)" : ""}`,
    );
    console.log("");
  }
}

// ── 7. Execute scheduling ────────────────────────────────────────────────

async function executeScheduleDecisions(decisions, opts) {
  const { scheduledDir, homeScheduledDir, sendTelegram } = opts;

  for (const d of decisions) {
    const {
      market,
      slug,
      startTime,
      marketDuration,
      clientOnly,
      serverDuration,
      optimizedDuration,
      reusableWindow,
      overallLaunch,
      overallShutdown,
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
    market.clientOnly = clientOnly;
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
      console.log(
        `          Mode:   ${clientOnly ? (reusableWindow ? "REUSE Server" : "Client Only") : "NEW Server"}`,
      );
      if (market.mediaStreamURL) {
        const displayStream = market.mediaStreamURL.includes("localhost")
          ? "localhost"
          : market.mediaStreamURL;
        console.log(`          Stream: ${displayStream}`);
      }
      if (!clientOnly) {
        console.log(
          `          Server: Launch at ${overallLaunch.toLocaleTimeString()}, Shutdown at ${overallShutdown.toLocaleTimeString()} (${optimizedDuration + LAUNCH_BUFFER_MINUTES}m total)`,
        );
      }

      const absFile = path.resolve(newFile);
      const nowMs = Date.now();

      if (!clientOnly) {
        const gpuDelay = overallLaunch.getTime() - nowMs;
        await gpuServerQueue.add(
          "launch-gpu-server",
          { shutdownMinutes: serverDuration + SCHEDULE_PADDING_MINUTES },
          { delay: Math.max(0, gpuDelay) },
        );
      }

      const clientDelay = startTime.getTime() - nowMs;
      await runClientQueue.add(
        "run-client",
        {
          marketFile: absFile,
          duration: marketDuration + SCHEDULE_PADDING_MINUTES,
          browser: !isTv && !isYoutube,
        },
        { delay: Math.max(0, clientDelay) },
      );

      const mode = clientOnly
        ? reusableWindow
          ? "REUSE Server"
          : "Client Only"
        : "NEW Server";
      const channelName = market.mediaSourceCommonName || "NONE";
      const message = `✅ Scheduled Match: ${market.title}\n📅 Time: ${startTime.toLocaleString()}\n🚀 Mode: ${mode}\n📺 Channel: ${channelName}`;
      sendTelegram(message).catch((e) =>
        console.error(`Failed to send Telegram: ${e.message}`),
      );

      console.log("");
    } catch (e) {
      console.error(`Failed to schedule ${market.title}: ${e.message}`);
    }
  }
}

// ── 8. Orchestrator ──────────────────────────────────────────────────────

async function processSequences(sequences, matches, serverWindows, opts) {
  const decisions = buildScheduleDecisions(sequences, matches, serverWindows, opts);
  if (opts.dryRun) {
    logScheduleDecisions(decisions);
  } else {
    await executeScheduleDecisions(decisions, opts);
  }
}

module.exports = {
  loadServerWindows,
  loadManualMatches,
  classifyStream,
  collectCandidates,
  buildScheduleDecisions,
  executeScheduleDecisions,
  logScheduleDecisions,
  processSequences,
};
