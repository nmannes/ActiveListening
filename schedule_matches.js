const fs = require("fs");
const path = require("path");
const { acquireLock } = require("./lib/lockfile");
const { matchDiscoveryEvents } = require("./lib/discovery_matcher");
const { applyWordConfigurations } = require("./lib/word_configurations");
const { sendTelegram } = require("./lib/telegram");
const {
  loadServerWindows,
  loadManualMatches,
  collectCandidates,
  processSequences,
} = require("./lib/scheduling");
const { connection } = require("./lib/queues");
const {
  MAX_SCHEDULED_FILE_AGE_MS,
  DEFAULT_LOOKAHEAD_HOURS,
} = require("./lib/constants");

// ── CLI argument parsing ─────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    dryRun: false,
    force: false,
    youtubeOnly: false,
    targetSlug: null,
    lookaheadHours: DEFAULT_LOOKAHEAD_HOURS,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run" || a === "-d") result.dryRun = true;
    else if (a === "--force" || a === "-f") result.force = true;
    else if (a === "--youtube-only" || a === "-yt") result.youtubeOnly = true;
    else if ((a === "--slug" || a === "-s") && i + 1 < args.length)
      result.targetSlug = args[++i];
    else if (a === "--lookahead" && i + 1 < args.length)
      result.lookaheadHours = parseFloat(args[++i]);
  }

  result.lookaheadMs = result.lookaheadHours * 60 * 60 * 1000;
  return result;
}

// ── Directory setup ──────────────────────────────────────────────────────

function setupDirs(DATA_DIR) {
  const CACHE_DIR = process.env.KALSHI_CACHE_DIR || path.join(DATA_DIR, "cache");
  const scheduledDir = path.join(DATA_DIR, "scheduled");
  fs.mkdirSync(scheduledDir, { recursive: true });

  let homeScheduledDir = null;
  if (process.env.KALSHI_CACHE_DIR) {
    homeScheduledDir = path.resolve(process.env.KALSHI_CACHE_DIR, "../scheduled");
    if (homeScheduledDir !== scheduledDir) {
      fs.mkdirSync(homeScheduledDir, { recursive: true });
    } else {
      homeScheduledDir = null;
    }
  }

  return { DATA_DIR, CACHE_DIR, scheduledDir, homeScheduledDir };
}

// ── Cleanup old scheduled files ──────────────────────────────────────────

function cleanupOldScheduledFiles(scheduledDir, homeScheduledDir) {
  const dirs = [scheduledDir];
  if (homeScheduledDir) dirs.push(homeScheduledDir);

  const now = Date.now();
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > MAX_SCHEDULED_FILE_AGE_MS) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old scheduled file: ${filePath}`);
        } catch (e) {
          console.error(`Failed to clean up ${filePath}: ${e.message}`);
        }
      }
    });
  });
}

// ── Matching phase ───────────────────────────────────────────────────────

function runMatching(CACHE_DIR, DATA_DIR) {
  const marketsFile = path.join(CACHE_DIR, "latest_markets.json");
  const tvScheduleFile = path.join(CACHE_DIR, "latest_tv_schedule.json");
  const espnMatchupsFile = path.join(CACHE_DIR, "espn_matchups.json");
  const amazonScheduleFile = path.join(CACHE_DIR, "amazon_nba_search_results.json");
  const cspanScheduleFile = path.join(CACHE_DIR, "cspan_schedule.json");
  const foxnewsScheduleFile = path.join(CACHE_DIR, "foxnews_schedule.json");
  const youtubeUpcomingFile = path.join(CACHE_DIR, "youtube_upcoming.json");

  if (!fs.existsSync(marketsFile)) {
    console.error(`Markets file ${marketsFile} not found. Run discovery first.`);
    process.exit(1);
  }

  const rawMarkets = JSON.parse(fs.readFileSync(marketsFile, "utf8"));
  const tvSchedule = fs.existsSync(tvScheduleFile)
    ? JSON.parse(fs.readFileSync(tvScheduleFile, "utf8"))
    : [];
  const espnSchedule = fs.existsSync(espnMatchupsFile)
    ? JSON.parse(fs.readFileSync(espnMatchupsFile, "utf8"))
    : [];
  const amazonSchedule = fs.existsSync(amazonScheduleFile)
    ? JSON.parse(fs.readFileSync(amazonScheduleFile, "utf8"))
    : [];
  const cspanSchedule = (
    fs.existsSync(cspanScheduleFile)
      ? JSON.parse(fs.readFileSync(cspanScheduleFile, "utf8"))
      : []
  ).filter((event) => event.title && event.title.includes("LIVE"));
  const foxnewsSchedule = fs.existsSync(foxnewsScheduleFile)
    ? JSON.parse(fs.readFileSync(foxnewsScheduleFile, "utf8"))
    : [];
  const youtubeUpcoming = fs.existsSync(youtubeUpcomingFile)
    ? JSON.parse(fs.readFileSync(youtubeUpcomingFile, "utf8"))
    : [];

  const configuredMarkets = rawMarkets.map((m) => applyWordConfigurations(m));
  const allResults = matchDiscoveryEvents(
    configuredMarkets,
    tvSchedule,
    espnSchedule,
    amazonSchedule,
    cspanSchedule,
    foxnewsSchedule,
    youtubeUpcoming,
  );

  const matchedMatches = allResults.filter(
    (m) => m.mediaSources && m.mediaSources.length > 0,
  );
  const unmatchedMarkets = allResults.filter(
    (m) => !m.mediaSources || m.mediaSources.length === 0,
  );

  const matchedPath = path.join(CACHE_DIR, "matched_markets.json");
  const unmatchedPath = path.join(CACHE_DIR, "unmatched_markets.json");
  fs.writeFileSync(matchedPath, JSON.stringify(matchedMatches, null, 2));
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedMarkets, null, 2));

  // Write speakers markdown table
  const speakersPath = path.join(DATA_DIR, "speakers.md");
  const sortedResults = [...allResults].sort((a, b) => {
    const aTime = a.startTime || a.market?.eventStartTime || "";
    const bTime = b.startTime || b.market?.eventStartTime || "";
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  });
  const tableHeader =
    "| HasMediaSource | Date | Time | Title |\n| :--- | :--- | :--- | :--- |\n";
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
    ]
      .join(" | ")
      .trim();
  });
  fs.writeFileSync(speakersPath, tableHeader + tableRows.join("\n"));

  return { matchedMatches, unmatchedMarkets };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);

  // 0. Acquire scheduler lock
  const DATA_DIR = process.env.KALSHI_DATA_DIR || __dirname;
  acquireLock("scheduler", { locksDir: path.join(DATA_DIR, "locks") });

  // 1. Setup directories and cleanup old files
  const { CACHE_DIR, scheduledDir, homeScheduledDir } = setupDirs(DATA_DIR);
  cleanupOldScheduledFiles(scheduledDir, homeScheduledDir);

  // 2. Run market-to-media matching
  const { matchedMatches } = runMatching(CACHE_DIR, DATA_DIR);

  // 3. Load manual matches and existing server windows
  const manualMatches = loadManualMatches(CACHE_DIR);
  const matches = [
    ...manualMatches,
    ...matchedMatches.filter(
      (m) => !manualMatches.find((man) => man.market.slug === m.market.slug),
    ),
  ];
  const matchSlugs = new Set(matches.map((m) => m.market.slug));
  const serverWindows = loadServerWindows(scheduledDir, opts.force, matchSlugs);

  // 4. Collect candidates and group into sequences
  const now = new Date();
  const { sequences } = collectCandidates(matches, {
    targetSlug: opts.targetSlug,
    youtubeOnly: opts.youtubeOnly,
    lookaheadMs: opts.lookaheadMs,
    now,
  });

  // 5. Schedule (or dry-run)
  await processSequences(sequences, matches, serverWindows, {
    force: opts.force,
    dryRun: opts.dryRun,
    scheduledDir,
    homeScheduledDir,
    sendTelegram,
  });

  await connection.quit();
}

main().catch((err) => {
  console.error("Fatal scheduling error:", err);
  process.exit(1);
});
