const fs = require("fs");
const path = require("path");
const { getDuration } = require("./market_duration");
const { getHostScheduleTime } = require("./host_schedules");
const { runClientQueue, extractEventId } = require("./queues");
const { getTeamNames } = require("./discover_markets");
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

function loadBlocklist(cacheDir) {
  const blocklistPath = path.join(cacheDir, "unscheduled.json");
  if (!fs.existsSync(blocklistPath)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(blocklistPath, "utf8")));
  } catch (e) {
    console.error(`Error reading blocklist: ${e.message}`);
    return new Set();
  }
}

function collectCandidates(matches, opts) {
  const { targetSlug, youtubeOnly, lookaheadMs, now } = opts;
  const lookaheadLimit = new Date(now.getTime() + lookaheadMs);
  const stalenessMs = STALE_THRESHOLD_MINUTES * 60 * 1000;

  const cacheDir = process.env.KALSHI_CACHE_DIR || path.join(process.env.KALSHI_DATA_DIR || __dirname, "cache");
  const blocked = loadBlocklist(cacheDir);

  let candidates = [];

  for (const match of matches) {
    const { market, mediaSources } = match;

    if (targetSlug && market.slug !== targetSlug) continue;
    if (blocked.has(market.slug)) continue;

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

    const espnSource = mediaSources.find((s) => s.type === "espn");

    let scheduleStartTime =
      espnSource?.startTime ||
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
    market.mediaSources = mediaSources;
    market.bestMediaSource = bestSource;
    market.mediaSourceCommonName = bestSource?.commonName || "Unknown";

    candidates.push(market);
  }

  candidates.sort(
    (a, b) => new Date(a.eventStartTime) - new Date(b.eventStartTime),
  );

  // Group markets sharing the same stream URL and time bucket so they
  // share one EC2 instance / media stream instead of duplicating.
  candidates = groupByStreamUrl(candidates);

  // Resolve overlapping baseball games by checking TV event descriptions
  // for team names, so we don't schedule two games at the same time.
  candidates = resolveOverlappingBaseballCandidates(candidates);

  return { candidates };
}

/**
 * Groups candidates that share the same stream URL and start-time hour bucket
 * into a single combined session. Markets keep their individual keywords,
 * speakerEntities, and trading config so the server can route signals correctly.
 *
 * Single-market candidates pass through unchanged.
 */
function groupByStreamUrl(candidates) {
  const groups = new Map();

  for (const market of candidates) {
    const streamURL = market.mediaStreamURL;
    if (!streamURL) {
      // Can't group without a stream URL — keep as single
      groups.set(market.slug, [market]);
      continue;
    }
    // Bucket by (streamURL, exact start time) — only identical start times group
    const startTime = market.eventStartTime
      ? new Date(market.eventStartTime).toISOString()
      : market.slug;
    const key = `${streamURL}|${startTime}`;

    if (!groups.has(key)) {
      groups.set(key, [market]);
    } else {
      groups.get(key).push(market);
    }
  }

  const result = [];
  for (const [key, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const merged = buildCombinedMarket(group);
      console.log(
        `[SCHEDULE] Grouped ${group.length} markets sharing stream ${key}: ${group.map(m => m.slug).join(', ')}`
      );
      result.push(merged);
    }
  }

  return result;
}

/**
 * Creates a combined market wrapper from multiple markets sharing a stream.
 * Each original market is preserved in the `markets` array so the server
 * can route keyword matches to the correct trading config.
 */
function buildCombinedMarket(group) {
  const first = group[0];
  const mergedKeywords = {};
  const mergedSpeakerEntities = [];
  // Map each phrase to its market index so the server can route signals
  const keywordMarketMap = {};
  const seenEntities = new Set();

  for (let i = 0; i < group.length; i++) {
    const m = group[i];
    // Merge keywords (tickers are unique per market, so no collisions)
    Object.assign(mergedKeywords, m.keywords || {});
    for (const phrase of Object.keys(m.keywords || {})) {
      const k = phrase.toLowerCase();
      if (!keywordMarketMap[k]) keywordMarketMap[k] = [];
      keywordMarketMap[k].push(i);
    }
    // Union speaker entities
    for (const entity of (m.speakerEntities || [])) {
      const lower = entity.toLowerCase();
      if (!seenEntities.has(lower)) {
        seenEntities.add(lower);
        mergedSpeakerEntities.push(entity);
      }
    }
  }

  const slugs = group.map(m => m.slug).join('-');
  const combinedSlug = `combined-${slugs}`.slice(0, 80);

  return {
    markets: group,
    slug: combinedSlug,
    // Flattened top-level fields that the server and client already read
    keywords: mergedKeywords,
    keywordMarketMap,
    speakerEntities: mergedSpeakerEntities,
    title: group.map(m => m.title).join(' + '),
    mediaStreamURL: first.mediaStreamURL,
    eventStartTime: first.eventStartTime,
    mediaSources: first.mediaSources,
    bestMediaSource: first.bestMediaSource,
    mediaSourceCommonName: first.mediaSourceCommonName,
    serverDuration: first.serverDuration,
  };
}

// ── 3b. Resolve overlapping baseball games ──────────────────────────────

/**
 * Detects baseball candidates with overlapping start times and uses TV event
 * descriptions to disambiguate which game is actually being broadcast.
 *
 * When two Kalshi baseball markets start at the same time (e.g., Mets vs
 * Phillies and Yankees vs Red Sox both at 7 PM), the OTA TV guide listing
 * for that channel/time slot typically has a description like
 * "Mets at Phillies. From Citizens Bank Park." that names the specific teams.
 * We check that description against each candidate's team names and keep
 * only the candidate whose teams appear in the description.
 *
 * If we can't disambiguate (no TV descriptions with team names, or both
 * match), we keep all candidates and log a warning.
 */
function resolveOverlappingBaseballCandidates(candidates) {
  const OVERLAP_WINDOW_MINUTES = 30; // games within 30 min of each other
  const OVERLAP_WINDOW_MS = OVERLAP_WINDOW_MINUTES * 60 * 1000;

  // Only consider baseball candidates
  const baseballCandidates = candidates.filter((c) => {
    const slug = (c.slug || "").toLowerCase();
    const profile = (c.clipProfile || "").toLowerCase();
    const title = (c.title || "").toLowerCase();
    return (
      slug.includes("mlb") ||
      slug.includes("kxbb") ||
      profile === "baseball" ||
      title.includes("baseball game") ||
      title.includes("mlb game")
    );
  });

  if (baseballCandidates.length < 2) return candidates;

  // Group by overlapping start times
  const groups = [];
  const seen = new Set();

  for (const cand of baseballCandidates) {
    if (seen.has(cand.slug)) continue;

    const candTime = new Date(cand.eventStartTime).getTime();
    const group = [cand];
    seen.add(cand.slug);

    for (const other of baseballCandidates) {
      if (seen.has(other.slug)) continue;
      const otherTime = new Date(other.eventStartTime).getTime();
      if (Math.abs(candTime - otherTime) <= OVERLAP_WINDOW_MS) {
        group.push(other);
        seen.add(other.slug);
      }
    }

    groups.push(group);
  }

  // For each group with >1 candidate, try to disambiguate using TV descriptions
  const toRemove = new Set();

  for (const group of groups) {
    if (group.length <= 1) continue;

    console.log(
      `[SCHEDULE] Overlapping baseball games detected (${group.length} candidates):`
    );
    for (const c of group) {
      console.log(`  - ${c.title} (${c.slug}) @ ${c.eventStartTime}`);
    }

    // For each candidate, extract per-team name variants (array of arrays)
    const candidateTeams = group.map((c) => ({
      candidate: c,
      teamVariants: getTeamNames(c.title),
    }));

    // Collect all TV source descriptions across the group
    const tvDescriptions = [];
    for (const c of group) {
      const sources = c.mediaSources || [];
      for (const src of sources) {
        if (src.type === "tv" && src.metadata?.description) {
          tvDescriptions.push({
            candidate: c,
            description: src.metadata.description.toLowerCase(),
          });
        }
      }
    }

    if (tvDescriptions.length === 0) {
      console.log(
        `  [SCHEDULE] No TV descriptions available — cannot disambiguate, keeping all.`
      );
      continue;
    }

    // First pass: try raw team names (high precision). The first variant in each
    // group is the original team name from the market title (e.g. "yankees",
    // "dodgers"). These are specific and won't produce cross-team false positives
    // the way city-level expanded variants do.
    const rawMatchedCandidates = new Set();
    for (const { candidate, teamVariants } of candidateTeams) {
      if (teamVariants.length === 0) continue;
      const rawNames = teamVariants.map((v) => v[0]);
      for (const { description } of tvDescriptions) {
        const allRawMatch = rawNames.every((name) =>
          description.includes(name.toLowerCase())
        );
        if (allRawMatch) {
          rawMatchedCandidates.add(candidate.slug);
          console.log(
            `  [SCHEDULE] TV description (raw names) matches: "${candidate.title}" (teams: ${rawNames.join(", ")})`
          );
          break;
        }
      }
    }

    // Fall back to expanded variants only if raw names produced 0 or >1 matches
    let matchedCandidates;
    if (rawMatchedCandidates.size === 1) {
      matchedCandidates = rawMatchedCandidates;
    } else {
      if (rawMatchedCandidates.size > 1) {
        console.log(
          `  [SCHEDULE] Raw team names ambiguous (${rawMatchedCandidates.size} matches) — falling back to expanded variants.`
        );
      } else {
        console.log(
          `  [SCHEDULE] No raw team name matches — falling back to expanded variants.`
        );
      }
      matchedCandidates = new Set();
      for (const { candidate, teamVariants } of candidateTeams) {
        if (teamVariants.length === 0) continue;
        for (const { description } of tvDescriptions) {
          const allTeamsMatch = teamVariants.every((variants) =>
            variants.some((v) => description.includes(v.toLowerCase()))
          );
          if (allTeamsMatch) {
            matchedCandidates.add(candidate.slug);
            const primaryNames = teamVariants.map((v) => v[0]).join(", ");
            console.log(
              `  [SCHEDULE] TV description (expanded) matches: "${candidate.title}" (teams: ${primaryNames})`
            );
            break;
          }
        }
      }
    }

    if (matchedCandidates.size === 1) {
      // Success: keep only the matched candidate, remove the rest
      for (const c of group) {
        if (!matchedCandidates.has(c.slug)) {
          console.log(
            `  [SCHEDULE] Removing ${c.slug} — TV description matches different game`
          );
          toRemove.add(c.slug);
        }
      }
    } else if (matchedCandidates.size > 1) {
      console.log(
        `  [SCHEDULE] TV description ambiguous (matches ${matchedCandidates.size} candidates) — keeping all.`
      );
    } else {
      console.log(
        `  [SCHEDULE] No team names found in TV descriptions — keeping all.`
      );
    }
  }

  if (toRemove.size > 0) {
    return candidates.filter((c) => !toRemove.has(c.slug));
  }
  return candidates;
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

    const marketDuration = originalMatch?.duration != null
      ? originalMatch.duration
      : getDuration(market, originalMatch);

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
          duration: marketDuration,
          browser: !isTv && !isYoutube,
          slug,
          shutdownMinutes: serverDuration,
        },
        { delay: Math.max(0, clientDelay), jobId: `${slug}-${eventId}` },
      );

      const channelName = market.mediaSourceCommonName || "NONE";
      const message = [
        `Scheduled Match: ${market.title}`,
        `Time: ${startTime.toLocaleString()}`,
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
  groupByStreamUrl,
  buildCombinedMarket,
};
