const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { sendTelegram } = require("./lib/telegram");
const { CHANNEL_MAPPINGS } = require("./lib/yttv_channels");
const { matchDiscoveryEvents } = require("./lib/discovery_matcher");
const { applyWordConfigurations } = require("./lib/word_configurations");
const _ = require("lodash");

const scheduledDir = path.join(__dirname, "scheduled");
execSync(`mkdir -p ${scheduledDir}`);

// ── 0. Lockfile to prevent concurrent runs ──────────────────────────
const locksDir = path.join(__dirname, "locks");
if (!fs.existsSync(locksDir)) fs.mkdirSync(locksDir);
const lockFile = path.join(locksDir, "scheduler.lock");

try {
  fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
} catch (e) {
  try {
    const pid = parseInt(fs.readFileSync(lockFile, "utf8"));
    if (pid) {
      process.kill(pid, 0);
      console.log(`Scheduler already running (PID: ${pid}). Exiting.`);
      process.exit(0);
    }
  } catch (err) {
    // Stale lock
    fs.unlinkSync(lockFile);
    fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
  }
}

const cleanup = () => {
  try {
    if (fs.existsSync(lockFile)) {
      const pid = parseInt(fs.readFileSync(lockFile, "utf8"));
      if (pid === process.pid) fs.unlinkSync(lockFile);
    }
  } catch (e) { }
};
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("uncaughtException", (err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");
const force = args.includes("--force") || args.includes("-f");
const youtubeOnly = args.includes("--youtube-only") || args.includes("-yt");
let lookaheadHours = 168; // 1 week lookahead
const lookaheadIdx = args.indexOf("--lookahead");
if (lookaheadIdx !== -1 && args[lookaheadIdx + 1]) {
  lookaheadHours = parseFloat(args[lookaheadIdx + 1]);
}
const lookaheadMs = lookaheadHours * 60 * 60 * 1000;

const matchedPath = path.join(__dirname, "cache", "matched_markets.json");
const unmatchedPath = path.join(__dirname, "cache", "unmatched_markets.json");

// ── 0.1 Perform Matching ─────────────────────────────────────────────
const marketsFile = path.join(__dirname, "cache", "latest_markets.json");
const tvScheduleFile = path.join(__dirname, "cache", "latest_tv_schedule.json");
const espnMatchupsFile = path.join(__dirname, "cache", "espn_matchups.json");
const amazonScheduleFile = path.join(__dirname, "cache", "amazon_nba_search_results.json");
const cspanScheduleFile = path.join(__dirname, "cache", "cspan_schedule.json");

if (!fs.existsSync(marketsFile)) {
  console.error(`Markets file ${marketsFile} not found. Run discovery first.`);
  process.exit(1);
}

const rawMarkets = JSON.parse(fs.readFileSync(marketsFile, "utf8"));
const tvSchedule = fs.existsSync(tvScheduleFile) ? JSON.parse(fs.readFileSync(tvScheduleFile, "utf8")) : [];
const espnSchedule = fs.existsSync(espnMatchupsFile) ? JSON.parse(fs.readFileSync(espnMatchupsFile, "utf8")) : [];
const amazonSchedule = fs.existsSync(amazonScheduleFile) ? JSON.parse(fs.readFileSync(amazonScheduleFile, "utf8")) : [];
const cspanSchedule = fs.existsSync(cspanScheduleFile) ? JSON.parse(fs.readFileSync(cspanScheduleFile, "utf8")) : [];

const configuredMarkets = rawMarkets.map((m) => applyWordConfigurations(m));
const allResults = matchDiscoveryEvents(
  configuredMarkets,
  tvSchedule,
  espnSchedule,
  amazonSchedule,
  cspanSchedule,
);

const matchedMatches = allResults.filter(
  (m) => m.mediaSources && m.mediaSources.length > 0,
);
const unmatchedMarkets = allResults.filter(
  (m) => !m.mediaSources || m.mediaSources.length === 0,
);

fs.writeFileSync(matchedPath, JSON.stringify(matchedMatches, null, 2));
fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedMarkets, null, 2));

// Save speakers markdown table for visibility
const speakersPath = path.join(__dirname, "speakers.md");
const sortedResults = _.sortBy(allResults, (r) => r.startTime || r.market?.eventStartTime || "");
const tableHeader = "| HasMediaSource | Date | Time | Title |\n| :--- | :--- | :--- | :--- |\n";
const tableRows = sortedResults.map((result) => {
  const { market, mediaSources } = result;
  const startTimeVal = result.startTime || market?.eventStartTime || "T";
  const [date, fullTime] = startTimeVal.split("T");
  const title = (market?.title || "N/A").replace("Announcers at ", "");
  const hasMediaSource = mediaSources && mediaSources.length > 0;

  return [
    "",
    hasMediaSource ? "Yes" : "No",
    date || "N/A",
    fullTime?.slice(0, 5) || "N/A",
    title,
    "",
  ].join(" | ").trim();
});
fs.writeFileSync(speakersPath, tableHeader + tableRows.join("\n"));

const now = new Date();
const lookaheadLimit = new Date(now.getTime() + lookaheadMs);

/**
 * Determines the broadcast duration based on market content.
 */
function getDuration(market, match) {
  const { mediaSources, ncaaEvent } = match;
  const espnEvent = mediaSources?.find(s => s.type === 'espn')?.metadata;
  const tvEvent = mediaSources?.find(s => s.type === 'tv')?.metadata;
  const title = (market.title || "").toLowerCase();
  const slug = (market.slug || "").toLowerCase();

  if (title.includes("survivor") || slug.includes("survivor")) {
    return 90;
  }
  if (
    title.includes("snl") ||
    title.includes("saturday night live") ||
    slug.includes("snl") ||
    slug.includes("saturday-night-live")
  ) {
    return 90;
  }
  if (title.includes("earnings") || slug.includes("earnings") || title.includes('his show') || title.includes('her show')) {
    return 60;
  }
  if (ncaaEvent || title.includes("ncaa") || slug.includes("ncaa") || (mediaSources && mediaSources.some(s => s.metadata?.league === 'ncaa'))) {
    return 150;
  }
  if (title.includes("nba") || slug.includes("nba")) {
    return 150;
  }
  if (title.includes("mlb") || slug.includes("mlb") || title.includes("baseball")) {
    return 180;
  }

  if (title.includes("nan fireside chat") || slug.includes("nan-fireside") || slug.includes("fireside-chat")) {
    return 30;
  }

  return 75; // Default
}

// ── 1. Load existing scheduled server windows ───────────────────────
// matchedMatches is already populated from the matching logic above
const manualMatchesPath = path.join(__dirname, "cache", "manual_matches.json");
let manualMatches = [];
if (fs.existsSync(manualMatchesPath)) {
  try {
    manualMatches = JSON.parse(fs.readFileSync(manualMatchesPath, "utf8"));
    // Normalize manual matches
    manualMatches.forEach(m => {
      if (!m.mediaSources) {
        m.mediaSources = [];
        if (m.market.mediaStreamURL) {
          m.mediaSources.push({
            type: 'market',
            name: 'Market Stream',
            url: m.market.mediaStreamURL,
            startTime: m.market.eventStartTime,
            metadata: {}
          });
        }
      }
    });
  } catch (e) {
    console.error(`Error reading ${manualMatchesPath}: ${e.message}`);
  }
}

// Merge and deduplicate (manual takes priority)
const matches = [...manualMatches, ...matchedMatches.filter(m => !manualMatches.find(man => man.market.slug === m.market.slug))];
const matchSlugs = new Set(matches.map((m) => m.market.slug));

const serverWindows = []; // Array of { start: Date, end: Date }
const scheduledFiles = fs
  .readdirSync(scheduledDir)
  .filter((f) => f.endsWith(".json"));

for (const f of scheduledFiles) {
  const slug = f.replace(".json", "");
  if (force && matchSlugs.has(slug)) continue;

  try {
    const data = JSON.parse(
      fs.readFileSync(path.join(scheduledDir, f), "utf8"),
    );
    if (data.eventStartTime && !data.clientOnly) {
      const start = new Date(data.eventStartTime);
      const duration = data.serverDuration || 75;
      // Launch is T-10m, Shutdown is Launch + (duration + 10m) = T + duration
      serverWindows.push({
        start: new Date(start.getTime() - 10 * 60 * 1000),
        end: new Date(start.getTime() + duration * 60 * 1000),
      });
    }
  } catch (e) {
    console.error(`Error reading ${f}: ${e.message}`);
  }
}

// ── 2. Collect and sort candidate markets ────────────────────────────
const candidates = [];

for (const match of matches) {
  const { market, mediaSources } = match;

  // Select the best media source
  const bestSource = mediaSources[0]; // Already sorted by priority in discovery_matcher.js

  let streamURL = bestSource?.url || null;

  if (
    youtubeOnly &&
    !(
      streamURL &&
      (streamURL.includes("youtube.com") || streamURL.includes("youtu.be"))
    )
  )
    continue;

  let scheduleStartTime =
    bestSource?.startTime ||
    market?.eventStartTime ||
    null;

  if (streamURL && scheduleStartTime) {
    let startTime = new Date(scheduleStartTime);
    let alreadyStarted = false;

    // Skip if started more than 60 minutes ago
    const stalenessThresholdMs = 60 * 60 * 1000;
    if (startTime < new Date(now.getTime() - stalenessThresholdMs)) {
      console.log(
        `Skipping ${market.title} - started too long ago (${startTime.toLocaleString()})`,
      );
      continue;
    }

    if (startTime <= now) {
      alreadyStarted = true;
      startTime = new Date(now.getTime() + 5 * 1000); // 5s buffer
    }

    if (startTime <= lookaheadLimit) {
      if (Object.keys(market.keywords || {}).length === 0) {
        console.log(`Skipping ${market.title} - no keywords (likely duration market)`);
        continue;
      }
      market.mediaStreamURL = streamURL;
      market.eventStartTime = startTime;
      market.alreadyStarted = alreadyStarted;
      candidates.push(market);
    }
  }
}

candidates.sort(
  (a, b) => new Date(a.eventStartTime) - new Date(b.eventStartTime),
);

// ── 3. Group into Sequences ─────────────────────────────────────────
const sequences = [];
let currentSequence = null;

for (const m of candidates) {
  if (!currentSequence) {
    currentSequence = [m];
  } else {
    const lastM = currentSequence[currentSequence.length - 1];
    const gapMinutes =
      (new Date(m.eventStartTime) - new Date(lastM.eventStartTime)) / 60000;

    // Group if starts within 60 minutes of the previous one
    if (gapMinutes <= 60) {
      currentSequence.push(m);
    } else {
      sequences.push(currentSequence);
      currentSequence = [m];
    }
  }
}
if (currentSequence) sequences.push(currentSequence);

// ── 4. Process Sequences ─────────────────────────────────────────────
for (const seq of sequences) {
  // Calculate optimal server window for the entire sequence
  const firstM = seq[0];
  const lastM = seq[seq.length - 1];

  const seqStart = new Date(firstM.eventStartTime);
  const seqLastStart = new Date(lastM.eventStartTime);

  // Server should launch 10m before first and shut down based on the longest duration required
  const overallLaunch = new Date(seqStart.getTime() - 10 * 60 * 1000);

  let maxEndTime = 0;
  for (const m of seq) {
    const mStartTime = new Date(m.eventStartTime).getTime();
    // We need to find the original match object to get duration context
    const originalMatch = matches.find((match) => match.market.slug === m.slug);
    const duration = getDuration(m, originalMatch);
    const mEndTime = mStartTime + duration * 60 * 1000;
    if (mEndTime > maxEndTime) maxEndTime = mEndTime;
  }

  const overallShutdown = new Date(maxEndTime);
  const optimizedDuration =
    Math.ceil((overallShutdown - overallLaunch) / 60000) - 10;

  let seqServerWindow = null;

  for (const market of seq) {
    const originalMatch = matches.find(
      (match) => match.market.slug === market.slug,
    );
    const startTime = new Date(market.eventStartTime);
    const slug = market.slug;
    const newFile = path.join(scheduledDir, `${slug}.json`);

    // Check if we can reuse an existing server window (from previous runs or current sequence)
    const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000);
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

    let clientOnly = market.alreadyStarted || !!reusableWindow;
    let serverDuration = clientOnly ? 0 : optimizedDuration;

    const isAlreadyScheduled = fs.existsSync(newFile) && !force;

    if (dryRun) {
      console.log(`[DRY-RUN] Market: ${market.title}`);
      console.log(`          Event:   ${startTime.toLocaleString()}`);
      console.log(`          Stream:  ${market.mediaStreamURL || "NONE"}`);
      console.log(`          Source:  ${scheduledDir}/${slug}.json`);

      if (isAlreadyScheduled) {
        console.log(`          Status:  ALREADY SCHEDULED (Would be skipped)`);
      }
      console.log(
        `          Mode:    ${clientOnly ? (reusableWindow ? "REUSE Server (Client Only)" : "Client Only (Started)") : "NEW Server (Full Run)"}`,
      );
      if (!clientOnly) {
        console.log(
          `          Server:  Launch at ${overallLaunch.toLocaleTimeString()}, Shutdown at ${overallShutdown.toLocaleTimeString()} (${optimizedDuration + 10}m total)`,
        );
        seqServerWindow = { start: overallLaunch, end: overallShutdown };
      } else if (reusableWindow) {
        console.log(
          `          Using:   Existing server window (${reusableWindow.start.toLocaleTimeString()} - ${reusableWindow.end.toLocaleTimeString()})`,
        );
      }

      const originalMatchForCmd = matches.find((m) => m.market.slug === market.slug);
      const marketDuration = getDuration(market, originalMatchForCmd);
      let cmd = `/home/nathan/kalshi/schedule_run.sh ${newFile} --duration ${marketDuration}`;
      if (!clientOnly) cmd += ` --server-duration ${serverDuration}`;
      if (clientOnly) cmd += " --client-only";
      if (market.mediaStreamURL && market.mediaStreamURL.includes("amazon.com")) cmd += " --browser";
      console.log(`          Command: ${cmd}`);
      console.log("");
      continue;
    }

    if (isAlreadyScheduled) {
      console.log(`Skipping ${market.title} - already scheduled`);
      continue;
    }

    // Prepare market file
    if (market.keywords) delete market["keywords"]["event does not qualify"];
    market.clientOnly = clientOnly;
    market.serverDuration = serverDuration;
    fs.writeFileSync(newFile, JSON.stringify(market, null, 2));

    const originalMatchForCmd = matches.find((m) => m.market.slug === market.slug);
    const marketDuration = getDuration(market, originalMatchForCmd);
    let cmd = `/home/nathan/kalshi/schedule_run.sh ${newFile} --duration ${marketDuration}`;
    if (!clientOnly) {
      cmd += ` --server-duration ${serverDuration}`;
    }
    if (clientOnly) {
      cmd += " --client-only";
    }
    if (market.mediaStreamURL && market.mediaStreamURL.includes("amazon.com")) {
      cmd += " --browser";
    }

    try {
      console.log(
        `Scheduling ${market.title} for ${startTime.toLocaleString()}`,
      );
      console.log(
        `          Mode:   ${clientOnly ? (reusableWindow ? "REUSE Server" : "Client Only") : "NEW Server"}`,
      );
      if (market.mediaStreamURL) {
        const displayStream = market.mediaStreamURL.includes("localhost") ? "localhost" : market.mediaStreamURL;
        console.log(`          Stream: ${displayStream}`);
      }
      if (!clientOnly) {
        console.log(
          `          Server: Launch at ${overallLaunch.toLocaleTimeString()}, Shutdown at ${overallShutdown.toLocaleTimeString()} (${optimizedDuration + 10}m total)`,
        );
      }

      execSync(cmd);

      const mode = clientOnly
        ? reusableWindow
          ? "REUSE Server"
          : "Client Only"
        : "NEW Server";
      const message = `✅ Scheduled Match: ${market.title}\n📅 Time: ${startTime.toLocaleString()}\n🚀 Mode: ${mode}\n📺 Stream: ${market.mediaStreamURL || "NONE"}`;
      sendTelegram(message).catch((e) =>
        console.error(`Failed to send Telegram: ${e.message}`),
      );

      if (!clientOnly) {
        seqServerWindow = { start: overallLaunch, end: overallShutdown };
        serverWindows.push(seqServerWindow);
      }
      console.log("");
    } catch (e) {
      console.error(`Failed to schedule ${market.title}: ${e.message}`);
    }
  }
}
