const fs = require("fs");
const path = require("path");
const { acquireLock } = require("./lib/lockfile");
const { matchDiscoveryEvents } = require("./lib/discovery_matcher");
const { computeTvDurations, setDefaultTvDurations } = require("./lib/market_duration");
const { applyWordConfigurations } = require("./lib/word_configurations");
const { sendTelegram } = require("./lib/telegram");
const {
  loadManualMatches,
  collectCandidates,
  processCandidates,
} = require("./lib/scheduling");
const { connection, sampleGenQueue } = require("./lib/queues");
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
  const msnbcScheduleFile = path.join(CACHE_DIR, "msnbc_schedule.json");
  const youtubeUpcomingFile = path.join(CACHE_DIR, "youtube_upcoming.json");

  if (!fs.existsSync(marketsFile)) {
    console.error(`Markets file ${marketsFile} not found. Run discovery first.`);
    process.exit(1);
  }

  const rawMarkets = JSON.parse(fs.readFileSync(marketsFile, "utf8"));
  const tvSchedule = (fs.existsSync(tvScheduleFile)
    ? JSON.parse(fs.readFileSync(tvScheduleFile, "utf8"))
    : []
  ).filter((entry) => {
    const title = (entry.title || "").toUpperCase();
    // "CBS News Mornings" is a different show from "CBS Mornings" — the
    // matcher's NEWS normalization would conflate them, giving the event
    // a 30-minute duration instead of the correct 2-hour window.
    if (title === "CBS NEWS MORNINGS") return false;
    return true;
  });
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
    ? computeTvDurations(JSON.parse(fs.readFileSync(foxnewsScheduleFile, "utf8")))
    : [];
  const msnbcSchedule = fs.existsSync(msnbcScheduleFile)
    ? setDefaultTvDurations(JSON.parse(fs.readFileSync(msnbcScheduleFile, "utf8")))
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
    msnbcSchedule,
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

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const MIN_SAMPLES = 5;
const os = require("os");
const AUDIO_LIB = path.join(os.homedir(), "audio-library");

async function enqueueMissingSamples(matches) {
  if (!fs.existsSync(AUDIO_LIB)) return;

  const speakers = new Set();
  for (const m of matches) {
    const entities = m.market?.speakerEntities;
    if (!entities) continue;
    for (const name of entities) {
      const lower = name ? name.toLowerCase() : "";
      if (lower && lower !== "announcer" && lower !== "panelist" && lower !== "cast" && !lower.includes("employee") && !lower.includes("contestant") && !lower.includes("houseguest")) {
        speakers.add(name);
      }
    }
  }

  for (const name of speakers) {
    const slug = slugify(name);
    const files = fs.readdirSync(AUDIO_LIB);
    const wavs = files.filter((f) => f.startsWith(slug) && f.endsWith(".wav"));
    if (wavs.length >= MIN_SAMPLES) continue;

    // Skip if this speaker already has many pending verification samples
    const pendingCount = await connection.hlen(`verify:${slug}`);
    if (pendingCount >= 20) {
      console.log(`Skipping sample generation for "${name}": ${pendingCount} pending verifications (>= 20)`);
      continue;
    }

    console.log(`Enqueuing sample generation for "${name}" (${wavs.length} samples, need ${MIN_SAMPLES})`);
    await sampleGenQueue.add("generate_samples", { target: name });
  }
}

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

  // 3. Load manual matches
  const manualMatches = loadManualMatches(CACHE_DIR);
  const matches = [
    ...manualMatches,
    ...matchedMatches.filter(
      (m) => !manualMatches.find((man) => man.market.slug === m.market.slug),
    ),
  ];

  // 4. Enqueue sample generation for speakers with fewer than 5 embeddings
  await enqueueMissingSamples(matches);

  // 5. Collect candidates
  const now = new Date();
  const { candidates } = collectCandidates(matches, {
    targetSlug: opts.targetSlug,
    youtubeOnly: opts.youtubeOnly,
    lookaheadMs: opts.lookaheadMs,
    now,
  });

  // 6. Schedule (or dry-run)
  await processCandidates(candidates, matches, {
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
