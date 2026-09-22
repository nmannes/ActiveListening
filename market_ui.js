const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const MarkdownIt = require("markdown-it");
const { CHANNEL_MAPPINGS } = require("./lib/yttv_channels");
const { execSync, exec } = require("child_process");
const {
  parseLogFiles, loadMarketTitles, loadResolutions,
  fuzzyMatchTicker, openDb, getTickers,
  getNoAskSeries, getYesBidSeries, findMarketChange,
  getYesPriceAt, getNoPriceAt,
  parseSignalTs, parseMediaSources,
  formatDelta, formatDeltaHuman, formatPriceChange,
} = require("./lib/signal_analysis");
const { getDuration } = require("./lib/market_duration");
const { listMarkets, getMarketLogs, getMarketManifest } = require("./lib/market_logs");
const { analyzeSession } = require("./lib/signal_analysis");
const KalshiClient = require("./lib/kalshi");
const { computeMarketPnL, summarizeOrders } = require("./lib/kalshi_trade_history");

const app = express();
const PORT = process.env.UI_PORT || 80;

const md = new MarkdownIt({ html: false, linkify: true });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = process.env.KALSHI_DATA_DIR || __dirname;
const CACHE_DIR = process.env.KALSHI_CACHE_DIR || path.join(DATA_DIR, "cache");
const MATCHED_PATH = path.join(CACHE_DIR, "matched_markets.json");
const UNMATCHED_PATH = path.join(CACHE_DIR, "unmatched_markets.json");
const MANUAL_MATCHES_PATH = path.join(CACHE_DIR, "manual_matches.json");
const UNSCHEDULED_PATH = path.join(CACHE_DIR, "unscheduled.json");
const DATA_ENTRIES_PATH = path.join(CACHE_DIR, "data_entries.json");
const SAMPLES_DIR = path.join(DATA_DIR, "sample-scheduling");

// Ensure files exist
[MATCHED_PATH, UNMATCHED_PATH, MANUAL_MATCHES_PATH].forEach(p => {
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});
if (!fs.existsSync(UNSCHEDULED_PATH)) fs.writeFileSync(UNSCHEDULED_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(DATA_ENTRIES_PATH)) fs.writeFileSync(DATA_ENTRIES_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

// ── KalshiClient singleton ──────────────────────────────────────────────────
const KALSHI_BASE_URL = (process.env.KALSHI_ENV === "prod") ? "https://kalshi.com" : "https://demo.kalshi.co";

let kalshiClient = null;
try {
  kalshiClient = new KalshiClient(
    process.env.KALSHI_KEY_ID,
    process.env.KALSHI_PRIVATE_KEY_PATH,
    process.env.KALSHI_ENV || "demo"
  );
  console.log("KalshiClient initialized for trade history queries");
} catch (e) {
  console.error(`KalshiClient init failed (trade history unavailable): ${e.message}`);
}

function readJsonFile(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
        console.error(`Error reading ${filePath}: ${e.message}`);
        return defaultValue;
    }
}

// ── Market speaker lookup ───────────────────────────────────────────────────
function getAllMarketSpeakers() {
    const speakers = new Set();
    for (const cachePath of [MATCHED_PATH, UNMATCHED_PATH, MANUAL_MATCHES_PATH]) {
        const entries = readJsonFile(cachePath, []);
        for (const entry of entries) {
            const entities = entry.market?.speakerEntities;
            if (Array.isArray(entities)) {
                for (const name of entities) {
                    speakers.add(name.toLowerCase().trim());
                }
            }
        }
    }
    return speakers;
}

// ── Redis verification state helpers ──────────────────────────────────────
const REDIS_TTL = 604800;  // 1 week, matches verification_state.py

async function getVerificationState(slug, index) {
    const raw = await connection.hget(`verify:${slug}`, String(index));
    return raw ? JSON.parse(raw) : null;
}

async function getAllVerificationStates(slug) {
    const raw = await connection.hgetall(`verify:${slug}`);
    const result = {};
    for (const [k, v] of Object.entries(raw || {})) {
        result[parseInt(k, 10)] = JSON.parse(v);
    }
    return result;
}

async function updateVerificationState(slug, index, updates) {
    const data = await getVerificationState(slug, index) || {};
    Object.assign(data, updates);
    await connection.hset(`verify:${slug}`, String(index), JSON.stringify(data));
    await connection.expire(`verify:${slug}`, REDIS_TTL);
}

async function pendingVerifications() {
    const keys = await connection.keys("verify:*");
    return keys.map(k => {
        const colonIdx = k.indexOf(":");
        return colonIdx >= 0 ? k.slice(colonIdx + 1) : k;
    });
}

app.get("/api/markets", (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] GET /api/markets`);
        const matched = readJsonFile(MATCHED_PATH);
        const unmatched = readJsonFile(UNMATCHED_PATH);
        const manual = readJsonFile(MANUAL_MATCHES_PATH);

        const scheduledDir = path.join(DATA_DIR, "scheduled");
        const scheduledData = new Map();
        if (fs.existsSync(scheduledDir)) {
            for (const f of fs.readdirSync(scheduledDir)) {
                if (!f.endsWith(".json")) continue;
                const slug = f.replace(".json", "");
                try {
                    const sched = readJsonFile(path.join(scheduledDir, f));
                    scheduledData.set(slug, sched);
                } catch (e) {
                    scheduledData.set(slug, {});
                }
            }
        }
        function getStreamInfo(m) {
            // Priority 1: Market defined URL (often from manual override or market metadata)
            if (m.market.mediaStreamURL) {
                for (const [name, url] of Object.entries(CHANNEL_MAPPINGS)) {
                    if (url === m.market.mediaStreamURL) return { url: m.market.mediaStreamURL, name };
                }
                return { url: m.market.mediaStreamURL, name: "Custom URL" };
            }

            // Priority 2: Normalized mediaSources (already prioritized in discovery_matcher.js)
            if (m.mediaSources && m.mediaSources.length > 0) {
                const bestSource = m.mediaSources[0];
                let name = bestSource.name;

                // Try to get a prettier name from CHANNEL_MAPPINGS if it's a URL we recognize
                for (const [mappedName, url] of Object.entries(CHANNEL_MAPPINGS)) {
                    if (url === bestSource.url) {
                        name = mappedName;
                        break;
                    }
                }

                return { url: bestSource.url, name: name };
            }

            // Fallback for legacy data (if any remains)
            let url = m.tvEvent?.channelURL || m.espnEvent?.gameLink || null;
            let name = m.tvEvent?.station || (m.espnEvent?.gameLink ? "Prime Video" : null);

            if (m.espnEvent?.tvChannels) {
                for (const ch of m.espnEvent.tvChannels) {
                    if (CHANNEL_MAPPINGS[ch.name]) {
                        return { url: CHANNEL_MAPPINGS[ch.name], name: ch.name };
                    }
                }
            }
            if (m.ncaaEvent?.network && CHANNEL_MAPPINGS[m.ncaaEvent.network]) {
                return { url: CHANNEL_MAPPINGS[m.ncaaEvent.network], name: m.ncaaEvent.network };
            }
            return { url, name };
        }

        const enrich = (m) => {
            const streamInfo = getStreamInfo(m);
            const duration = m.duration != null ? m.duration : getDuration(m.market, m);
            const sched = scheduledData.get(m.market.slug);
            const scheduledStartTime = sched?.eventStartTime || null;
            return {
                ...m,
                startTime: m.startTime || scheduledStartTime,
                market: {
                    ...m.market,
                    eventStartTime: m.market.eventStartTime || scheduledStartTime,
                    mediaStreamURL: m.market.mediaStreamURL || streamInfo.url,
                    channelName: streamInfo.name,
                    isScheduled: scheduledData.has(m.market.slug),
                    duration,
                    kalshiUrl: `${KALSHI_BASE_URL}/markets/${m.market.slug}`,
                }
            };
        };

        res.json({
            matched: matched.map(enrich),
            unmatched: unmatched.map(enrich),
            manual: manual.map(enrich)
        });
    } catch (e) {
        console.error(`Error in /api/markets: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/manual-match", (req, res) => {
    try {
        const { market, mediaStreamURL, startTime, duration, speakerEntities } = req.body;
        if (!market || !mediaStreamURL) {
            return res.status(400).json({ error: "Missing market or mediaStreamURL" });
        }

        let manual = readJsonFile(MANUAL_MATCHES_PATH);

        // Update if exists, otherwise append
        const index = manual.findIndex(m => m.market.slug === market.slug);
        const updatedMarket = {
            market: { ...market, mediaStreamURL, speakerEntities: speakerEntities || market.speakerEntities },
            startTime: startTime || market.eventStartTime,
            manual: true,
            duration: duration != null ? duration : undefined,
        };

        if (index !== -1) {
            // Preserve existing duration if not explicitly provided
            if (duration == null && manual[index].duration != null) {
                updatedMarket.duration = manual[index].duration;
            }
            manual[index] = updatedMarket;
        } else {
            manual.push(updatedMarket);
        }

        fs.writeFileSync(MANUAL_MATCHES_PATH, JSON.stringify(manual, null, 2));

        // Also update the scheduled job file if it exists
        const schedPath = path.join(SCHEDULED_DIR, `${market.slug}.json`);
        if (speakerEntities !== undefined && fs.existsSync(schedPath)) {
            const sched = JSON.parse(fs.readFileSync(schedPath, "utf8"));
            sched.speakerEntities = speakerEntities || market.speakerEntities;
            fs.writeFileSync(schedPath, JSON.stringify(sched, null, 2));
            console.log(`Updated speakerEntities in scheduled file: ${market.slug} -> [${sched.speakerEntities.join(", ")}]`);
        }

        res.json({ success: true, market: updatedMarket });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/manual-match/:slug", (req, res) => {
    try {
        const slug = req.params.slug;
        let manual = readJsonFile(MANUAL_MATCHES_PATH);
        manual = manual.filter(m => m.market.slug !== slug);
        fs.writeFileSync(MANUAL_MATCHES_PATH, JSON.stringify(manual, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/scheduled/:slug", async (req, res) => {
    try {
        const slug = req.params.slug;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const scheduledDir = path.join(DATA_DIR, "scheduled");
        const filePath = path.join(scheduledDir, `${slug}.json`);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Also check the alternate scheduled dir if KALSHI_CACHE_DIR is set
        if (process.env.KALSHI_CACHE_DIR) {
            const altDir = path.resolve(process.env.KALSHI_CACHE_DIR, "../scheduled");
            if (altDir !== scheduledDir) {
                const altPath = path.join(altDir, `${slug}.json`);
                if (fs.existsSync(altPath)) {
                    fs.unlinkSync(altPath);
                }
            }
        }

        // Add to blocklist so the next scheduling run won't re-schedule
        const blocked = readJsonFile(UNSCHEDULED_PATH, []);
        if (!blocked.includes(slug)) {
            blocked.push(slug);
            fs.writeFileSync(UNSCHEDULED_PATH, JSON.stringify(blocked, null, 2));
        }

        // Remove pending BullMQ run-client jobs for this slug
        try {
            const jobs = await runClientQueue.getJobs(["delayed", "waiting", "paused"]);
            for (const job of jobs) {
                if (job.id && job.id.startsWith(`${slug}-`)) {
                    await job.remove();
                }
            }
        } catch (e) {
            console.error(`Failed to remove BullMQ jobs for ${slug}: ${e.message}`);
        }

        res.json({ success: true, unscheduled: slug });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Process status & stop ──────────────────────────────────────────────
const LOCKS_DIR = path.join(DATA_DIR, "locks");
const SCHEDULED_DIR = path.join(DATA_DIR, "scheduled");

function checkProcessRunning(slug) {
    const lockPath = path.join(LOCKS_DIR, `${slug}.lock`);
    if (!fs.existsSync(lockPath)) return { running: false, source: null, pid: null };

    try {
        const pid = parseInt(fs.readFileSync(lockPath, "utf8").trim(), 10);
        if (!pid || isNaN(pid)) return { running: false, source: null, pid: null };
        process.kill(pid, 0); // signal 0 just checks existence
        return { running: true, source: "lockfile", pid };
    } catch (e) {
        if (e.code === "ESRCH") {
            // Stale lock — process is dead
            try { fs.unlinkSync(lockPath); } catch (_) {}
            return { running: false, source: null, pid: null };
        }
        return { running: false, source: null, pid: null };
    }
}

app.get("/api/market/:slug/status", async (req, res) => {
    try {
        const slug = req.params.slug;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const localStatus = checkProcessRunning(slug);

        // Also check BullMQ queue for pending/active jobs
        let queueStatus = { pending: false, active: false, completed: false };
        try {
            const allJobs = [
                ...(await runClientQueue.getJobs(["waiting", "delayed"])),
                ...(await runClientQueue.getJobs(["active"])),
            ];
            for (const job of allJobs) {
                if (job.data && job.data.slug === slug) {
                    const state = await runClientQueue.getJobState(job.id).catch(() => null);
                    if (state === "active") queueStatus.active = true;
                    else queueStatus.pending = true;
                }
            }
            // Check if this slug has ever completed a job
            const completedJobs = await runClientQueue.getJobs(["completed", "failed"]);
            for (const job of completedJobs) {
                if (job.data && job.data.slug === slug) {
                    queueStatus.completed = true;
                    break;
                }
            }
        } catch (e) {
            // Queue check is best-effort
        }

        // Check for s3 session data (recordings from a previous run)
        let hasSessionData = false;
        try {
            const s3Dir = path.join(DATA_DIR, "s3");
            if (fs.existsSync(s3Dir)) {
                const dirs = fs.readdirSync(s3Dir, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                    .map(d => d.name);
                hasSessionData = dirs.some(d => d.startsWith(slug + "_"));
            }
        } catch (_) {}

        // Running = process is actively executing (lockfile exists + PID alive, or active BullMQ job)
        const running = localStatus.running || queueStatus.active;
        // Pending = scheduled but not started yet (delayed/waiting job, no active process)
        const pending = !running && queueStatus.pending;
        // Previously run = completed BullMQ job or session data exists, and not currently running/pending
        const previouslyRun = !running && !pending && (queueStatus.completed || hasSessionData);

        res.json({
            slug,
            running,
            pending,
            previouslyRun,
            local: localStatus,
            queue: queueStatus,
        });
    } catch (e) {
        console.error(`Error in /api/market/:slug/status: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/market/:slug/stop", async (req, res) => {
    try {
        const slug = req.params.slug;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const results = [];

        // 1. Kill local process via lockfile
        const lockPath = path.join(LOCKS_DIR, `${slug}.lock`);
        if (fs.existsSync(lockPath)) {
            try {
                const pid = parseInt(fs.readFileSync(lockPath, "utf8").trim(), 10);
                if (pid && !isNaN(pid)) {
                    process.kill(pid, "SIGTERM");
                    results.push(`Sent SIGTERM to PID ${pid}`);
                }
            } catch (e) {
                if (e.code === "ESRCH") {
                    results.push("Process already exited");
                } else {
                    results.push(`Failed to kill process: ${e.message}`);
                }
            }
            // Clean up stale lockfile
            try { fs.unlinkSync(lockPath); } catch (_) {}
        }

        // 2. Remove pending BullMQ run-client jobs for this slug
        try {
            const jobs = await runClientQueue.getJobs(["delayed", "waiting", "paused", "active"]);
            let removed = 0;
            for (const job of jobs) {
                if (job.data && job.data.slug === slug) {
                    await job.remove().catch(() => {});
                    removed++;
                }
            }
            if (removed > 0) results.push(`Removed ${removed} BullMQ job(s)`);
        } catch (e) {
            results.push(`Queue cleanup warning: ${e.message}`);
        }

        // 3. Terminate EC2 instances tagged with this slug
        try {
            const awsOut = execSync(
                `aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Name,Values=${slug}" "Name=instance-state-name,Values=running,pending,stopped" --query 'Reservations[].Instances[].InstanceId' --output text`,
                { encoding: "utf8", timeout: 15000 }
            ).trim();
            if (awsOut) {
                const instanceIds = awsOut.split(/\s+/).filter(Boolean);
                for (const id of instanceIds) {
                    execSync(`aws ec2 terminate-instances --region us-east-1 --instance-ids ${id}`,
                        { encoding: "utf8", timeout: 15000 });
                    results.push(`Terminated EC2 instance ${id}`);
                }
            }
        } catch (e) {
            // EC2 cleanup is best-effort
            if (!e.message.includes("No instances")) {
                results.push(`EC2 cleanup note: ${(e.stderr || e.message || "").slice(0, 100)}`);
            }
        }

        // 4. Remove scheduled file
        const schedPath = path.join(SCHEDULED_DIR, `${slug}.json`);
        if (fs.existsSync(schedPath)) {
            try { fs.unlinkSync(schedPath); results.push("Removed scheduled file"); } catch (e) {
                results.push(`Failed to remove scheduled file: ${e.message}`);
            }
        }

        // 5. Add to blocklist
        const blocked = readJsonFile(UNSCHEDULED_PATH, []);
        if (!blocked.includes(slug)) {
            blocked.push(slug);
            fs.writeFileSync(UNSCHEDULED_PATH, JSON.stringify(blocked, null, 2));
            results.push("Added to unscheduled blocklist");
        }

        res.json({ success: true, slug, results });
    } catch (e) {
        console.error(`Error in /api/market/:slug/stop: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/logs", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "market.html"));
});

app.get("/raw-logs", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "logs.html"));
});

app.get("/voice", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "voice.html"));
});

// Earnings reports (markdown → HTML, generated by the transcript refresh job)
const EARNINGS_REPORTS = [
    { file: "earnings-report-report.md", label: "Earnings Report" },
    { file: "earnings-backtest.md", label: "Earnings Backtest" },
    { file: "earnings-backtest-fills.md", label: "Earnings Backtest (fillable prices)" },
];

app.get("/reports", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "reports.html"));
});

app.get("/api/reports", (req, res) => {
    const items = [];
    for (const r of EARNINGS_REPORTS) {
        const p = path.join(__dirname, r.file);
        if (!fs.existsSync(p)) continue;
        const st = fs.statSync(p);
        items.push({ name: r.file, label: r.label, mtime: st.mtime.toISOString(), size: st.size });
    }
    res.json(items);
});

app.get("/api/reports/:name", (req, res) => {
    const r = EARNINGS_REPORTS.find((x) => x.file === req.params.name);
    if (!r) return res.status(404).json({ error: "Unknown report" });
    const p = path.join(__dirname, r.file);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Report not generated yet" });
    res.send(md.render(fs.readFileSync(p, "utf8")));
});

app.get("/data-entry", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "data-entry.html"));
});

app.get("/api/data-entry", (req, res) => {
    res.json(readJsonFile(DATA_ENTRIES_PATH, []));
});

app.post("/api/data-entry", (req, res) => {
    try {
        const { slug, youtube, speaker, speakerName } = req.body;
        if (!slug || !youtube) {
            return res.status(400).json({ error: "Missing slug or youtube" });
        }
        const entries = readJsonFile(DATA_ENTRIES_PATH, []);
        entries.push({ slug, youtube, speaker: speaker || "", speakerName: speakerName || "" });
        fs.writeFileSync(DATA_ENTRIES_PATH, JSON.stringify(entries, null, 2));

        // Create sample-scheduling file
        if (!fs.existsSync(SAMPLES_DIR)) {
            fs.mkdirSync(SAMPLES_DIR, { recursive: true });
        }
        const sample = {
            slug,
            youtube,
            speaker: speaker || "",
            speakerName: speakerName || "",
            mediaStreamURL: youtube,
            eventStartTime: null,
            keywords: {},
            clipProfile: null,
            audioOnly: true,
        };
        if (speakerName) {
            sample.speakerEntities = [speakerName];
        }
        const samplePath = path.join(SAMPLES_DIR, `${slug}.json`);
        fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2));

        // Start local recording: server + client, both backgrounded with timeout
        const cmd = `bash scripts/run_sample.sh "${samplePath}" >> data-entry.log`;
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 },
            (err) => { if (err) fs.appendFileSync(path.join(DATA_DIR, "data-entry.log"), `${new Date().toISOString()} Retry run error (${entry.slug}): ${err.message || String(err)}\n`); }
        );


        res.json({ success: true, recording: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/data-entry/:index/retry", (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const entries = readJsonFile(DATA_ENTRIES_PATH, []);
        if (index < 0 || index >= entries.length) {
            return res.status(404).json({ error: "Index out of range" });
        }
        const entry = entries[index];

        if (!entry.slug || !entry.youtube) {
            return res.status(400).json({ error: "Entry missing slug or youtube" });
        }

        // Create/update sample-scheduling file
        if (!fs.existsSync(SAMPLES_DIR)) {
            fs.mkdirSync(SAMPLES_DIR, { recursive: true });
        }
        const sample = {
            slug: entry.slug,
            youtube: entry.youtube,
            speaker: entry.speaker || "",
            speakerName: entry.speakerName || "",
            mediaStreamURL: entry.youtube,
            eventStartTime: null,
            keywords: {},
            clipProfile: null,
            audioOnly: true,
        };
        if (entry.speakerName) {
            sample.speakerEntities = [entry.speakerName];
        }
        const samplePath = path.join(SAMPLES_DIR, `${entry.slug}.json`);
        fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2));

        const cmd = `bash scripts/run_sample.sh "${samplePath}" >> data-entry.log`;
        exec(cmd, { maxBuffer: 10 * 1024 * 1024 },
            (err) => { if (err) fs.appendFileSync(path.join(DATA_DIR, "data-entry.log"), `${new Date().toISOString()} Retry run error (${entry.slug}): ${err.message || String(err)}\n`); }
        );

        res.json({ success: true, recording: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/data-entry/logs", (req, res) => {
    try {
        const logPath = path.join(DATA_DIR, "data-entry.log");
        if (!fs.existsSync(logPath)) {
            return res.json([]);
        }
        const raw = fs.readFileSync(logPath, "utf-8");
        const entries = raw.trim().split("\n").filter(Boolean).map((line) => {
            const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s/);
            const ts = tsMatch ? tsMatch[1] : null;
            const msg = tsMatch ? line.slice(tsMatch[0].length) : line;
            return { ts, msg, raw: line };
        });
        entries.reverse();
        res.json(entries);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/data-entry/:index", (req, res) => {
    try {
        const index = parseInt(req.params.index);
        const entries = readJsonFile(DATA_ENTRIES_PATH, []);
        if (index < 0 || index >= entries.length) {
            return res.status(404).json({ error: "Index out of range" });
        }
        entries.splice(index, 1);
        fs.writeFileSync(DATA_ENTRIES_PATH, JSON.stringify(entries, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


app.get("/sessions", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "sessions.html"));
});

app.get("/transcript/:session", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "transcript.html"));
});

app.get("/api/sessions", (req, res) => {
    try {
        const s3Dir = path.join(DATA_DIR, "s3");
        if (!fs.existsSync(s3Dir)) {
            return res.json({ sessions: [] });
        }

        const sessions = [];

        const dirs = fs.readdirSync(s3Dir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const session of dirs) {
            const dgDir = path.join(s3Dir, session, "deepgram_responses");
            if (!fs.existsSync(dgDir)) continue;

            const dgFiles = fs.readdirSync(dgDir)
                .filter(f => f.startsWith("dg_") && f.endsWith(".json"))
                .sort();

            if (dgFiles.length === 0) continue;

            // Extract nanosecond timestamp from first file: dg_{ns}.json
            const firstFile = dgFiles[0];
            const tsNs = parseInt(firstFile.match(/^dg_(\d+)\.json$/)?.[1], 10);
            const firstTs = tsNs ? new Date(Number(tsNs) / 1_000_000) : null;

            // Extract slug (everything before the _YYYY-MM-DD_HH-MM-SS timestamp)
            const slugMatch = session.match(/^(.+)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/);
            const slug = slugMatch ? slugMatch[1] : session;

            const hasTranscript = fs.existsSync(path.join(s3Dir, session, "transcript.json"));

            sessions.push({
                session,
                slug,
                first_timestamp_ns: tsNs ? String(tsNs) : null,
                first_timestamp_iso: firstTs ? firstTs.toISOString() : null,
                deepgram_count: dgFiles.length,
                has_transcript: hasTranscript,
            });
        }

        // Sort by first timestamp descending (most recent first)
        sessions.sort((a, b) => {
            if (!a.first_timestamp_iso) return 1;
            if (!b.first_timestamp_iso) return -1;
            return b.first_timestamp_iso.localeCompare(a.first_timestamp_iso);
        });

        res.json({ sessions });
    } catch (e) {
        console.error(`Error in /api/sessions: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/transcript/:session", (req, res) => {
    try {
        const session = req.params.session;
        if (!/^[\w.-]+$/.test(session)) {
            return res.status(400).json({ error: "Invalid session name" });
        }

        const sessionDir = path.join(DATA_DIR, "s3", session);
        if (!fs.existsSync(sessionDir)) {
            return res.status(404).json({ error: "Session not found" });
        }

        const dgDir = path.join(sessionDir, "deepgram_responses");
        if (!fs.existsSync(dgDir)) {
            return res.status(404).json({ error: "No Deepgram responses for this session" });
        }

        const dgFiles = fs.readdirSync(dgDir)
            .filter(f => f.startsWith("dg_") && f.endsWith(".json"))
            .sort();

        if (dgFiles.length === 0) {
            return res.status(404).json({ error: "No Deepgram response files found" });
        }

        const slugMatch = session.match(/^(.+)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})$/);
        const slug = slugMatch ? slugMatch[1] : session;
        const sessionTs = slugMatch ? slugMatch[2] : null;

        // Pagination
        const limit = Math.min(parseInt(req.query.limit) || dgFiles.length, 10000);
        const offset = parseInt(req.query.offset) || 0;
        const pageFiles = dgFiles.slice(offset, offset + limit);

        const lines = [];
        for (const file of pageFiles) {
            try {
                const raw = fs.readFileSync(path.join(dgDir, file), "utf8");
                const msg = JSON.parse(raw);
                const alt = msg.channel?.alternatives?.[0] || {};
                const transcript = alt.transcript || "";
                const confidence = alt.confidence ?? null;
                const words = alt.words || [];
                const speakers = [...new Set(words.map(w => w.speaker).filter(s => s != null))];

                lines.push({
                    file,
                    ts_ns: file.match(/^dg_(\d+)\.json$/)?.[1] || null,
                    type: msg.type || null,
                    start: msg.start ?? null,
                    duration: msg.duration ?? null,
                    is_final: msg.is_final || false,
                    transcript,
                    confidence,
                    speakers,
                });
            } catch (e) {
                lines.push({ file, error: e.message });
            }
        }

        // Filter out blank transcripts
        const filtered = lines.filter(l => l.error || l.transcript);

        // Parse signals for this session
        const signals = parseLogFiles(slug.toLowerCase());

        res.json({
            session,
            slug,
            session_timestamp: sessionTs,
            total: filtered.length,
            offset,
            limit,
            lines: filtered,
            signals,
        });
    } catch (e) {
        console.error(`Error in /api/transcript/:session: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/runtime-logs/:slug", (req, res) => {
    try {
        const slug = req.params.slug;
        if (!/^[\w.-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const logPath = path.join(DATA_DIR, "runtime_logs", `${slug}_merged.log`);
        if (!fs.existsSync(logPath)) {
            return res.status(404).json({ error: "No merged runtime logs for this session. Run sync_logs.sh first." });
        }

        const raw = fs.readFileSync(logPath, "utf8").trim();
        const allLines = raw ? raw.split("\n").filter(Boolean) : [];

        const limit = Math.min(parseInt(req.query.limit) || 500, 5000);
        const offset = parseInt(req.query.offset) || 0;
        const page = allLines.slice(offset, offset + limit);

        const logs = [];
        for (const line of page) {
            try {
                logs.push(JSON.parse(line));
            } catch {
                logs.push({ raw: line });
            }
        }

        res.json({
            slug,
            total: allLines.length,
            offset,
            limit,
            logs,
        });
    } catch (e) {
        console.error(`Error in /api/runtime-logs/:slug: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/runtime-logs", (req, res) => {
    try {
        const logsDir = path.join(DATA_DIR, "runtime_logs");
        if (!fs.existsSync(logsDir)) {
            return res.json({ files: [] });
        }

        const files = [];
        const entries = fs.readdirSync(logsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(".log")) continue;
            const filePath = path.join(logsDir, entry.name);
            const stat = fs.statSync(filePath);

            // Parse first line for timestamp
            let firstTime = null;
            try {
                const fd = fs.openSync(filePath, "r");
                const buf = Buffer.alloc(4096);
                fs.readSync(fd, buf, 0, 4096, 0);
                fs.closeSync(fd);
                const firstLine = buf.toString("utf8").split("\n")[0];
                const parsed = JSON.parse(firstLine);
                if (parsed.time) {
                    firstTime = new Date(parsed.time).toISOString();
                }
            } catch (e) {
                // Can't parse first line, leave firstTime null
            }

            // Estimate line count from file size
            const avgLineBytes = 200; // rough estimate
            const estimatedLines = Math.round(stat.size / avgLineBytes);

            files.push({
                filename: entry.name,
                size: stat.size,
                lines: estimatedLines,
                firstTime,
                mtime: stat.mtime.toISOString(),
            });
        }

        // Sort by firstTime descending (most recent first, nulls at end)
        files.sort((a, b) => {
            if (!a.firstTime) return 1;
            if (!b.firstTime) return -1;
            return b.firstTime.localeCompare(a.firstTime);
        });

        res.json({ files });
    } catch (e) {
        console.error(`Error in /api/runtime-logs: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/runtime-logs-view/:filename", (req, res) => {
    try {
        const filename = req.params.filename;
        // Validate to prevent path traversal
        if (!/^[\w.:-]+\.log$/.test(filename) || filename.includes("..")) {
            return res.status(400).json({ error: "Invalid filename" });
        }

        const filePath = path.join(DATA_DIR, "runtime_logs", filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }

        const stat = fs.statSync(filePath);
        const limit = Math.min(parseInt(req.query.lines) || 5000, 100000);

        // Read last N lines efficiently for large files
        let content;
        if (stat.size < 10 * 1024 * 1024) {
            // Under 10MB: read whole file and take last N lines
            const raw = fs.readFileSync(filePath, "utf8");
            const allLines = raw.split("\n").filter(Boolean);
            content = allLines.slice(-limit).join("\n");
        } else {
            // Large file: read last ~N*avgLineBytes bytes
            const avgLineBytes = 200;
            const readSize = Math.min(limit * avgLineBytes, stat.size);
            const fd = fs.openSync(filePath, "r");
            const buf = Buffer.alloc(readSize);
            fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
            fs.closeSync(fd);
            let text = buf.toString("utf8");
            // Chop off partial first line
            const newlineIdx = text.indexOf("\n");
            if (newlineIdx >= 0) {
                text = text.slice(newlineIdx + 1);
            }
            content = text;
        }

        res.type("text/plain").send(content);
    } catch (e) {
        console.error(`Error in /api/runtime-logs-view/:filename: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// ── Market Logs API ──────────────────────────────────────────────────────────
let marketListCache = null;
let marketListCacheTime = 0;
const MARKET_LIST_CACHE_TTL = 30000; // 30 seconds

app.get("/api/market-logs", (req, res) => {
    try {
        const now = Date.now();
        if (!marketListCache || (now - marketListCacheTime) > MARKET_LIST_CACHE_TTL) {
            marketListCache = listMarkets();
            marketListCacheTime = now;
        }
        res.json({ markets: marketListCache, kalshiBaseUrl: KALSHI_BASE_URL });
    } catch (e) {
        console.error(`Error in /api/market-logs: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/market-logs/:slug", async (req, res) => {
    try {
        const slug = req.params.slug;
        if (!/^[\w.-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const result = await getMarketLogs(slug, {
            type: req.query.type || "all",
            lines: req.query.lines,
            offset: req.query.offset,
            search: req.query.search,
        });

        if (!result) {
            return res.status(404).json({ error: "Market not found" });
        }

        res.json(result);
    } catch (e) {
        console.error(`Error in /api/market-logs/:slug: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/market-logs/:slug/manifest", (req, res) => {
    try {
        const slug = req.params.slug;
        if (!/^[\w.-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const manifest = getMarketManifest(slug);
        if (!manifest) {
            return res.status(404).json({ error: "Market not found" });
        }

        res.json(manifest);
    } catch (e) {
        console.error(`Error in /api/market-logs/:slug/manifest: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// ── Market Revenue API ─────────────────────────────────────────────────────
let revenueCache = null;
let revenueCacheTime = 0;
const REVENUE_CACHE_TTL = 300000; // 5 minutes

function buildTickerToSlug() {
  const t2s = new Map();
  const cacheFiles = ["matched_markets.json", "unmatched_markets.json", "manual_matches.json"];
  for (const file of cacheFiles) {
    const p = path.join(CACHE_DIR, file);
    if (!fs.existsSync(p)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      for (const entry of data) {
        const market = entry.market || entry;
        if (market.slug && market.keywords) {
          for (const ticker of Object.values(market.keywords)) {
            t2s.set(String(ticker).toLowerCase(), market.slug.toLowerCase());
          }
        }
      }
    } catch (_) {}
  }
  // Also scan scheduled files
  const schedDir = path.join(DATA_DIR, "scheduled");
  if (fs.existsSync(schedDir)) {
    const files = fs.readdirSync(schedDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(schedDir, file), "utf8"));
        const market = data.market || data;
        if (market.slug && market.keywords) {
          for (const ticker of Object.values(market.keywords)) {
            t2s.set(String(ticker).toLowerCase(), market.slug.toLowerCase());
          }
        }
      } catch (_) {}
    }
  }
  return t2s;
}

app.get("/api/market-revenue", async (req, res) => {
  try {
    if (revenueCache && (Date.now() - revenueCacheTime) < REVENUE_CACHE_TTL) {
      return res.json({ ...revenueCache, cached: true });
    }

    if (!kalshiClient) {
      return res.json({ revenue: {}, available: false, message: "Kalshi not configured" });
    }

    const t2s = buildTickerToSlug();
    // Derive slug from ticker: KXWCMENTION-26JUL11NORENG-SOME → kxwcmention-26jul11noreng
    function tickerToSlug(ticker) {
      const cached = t2s.get(ticker.toLowerCase());
      if (cached) return cached;
      const t = ticker.toLowerCase();
      const dashIdx = t.lastIndexOf("-");
      return dashIdx > 0 ? t.slice(0, dashIdx) : t;
    }

    // Fetch orders and settlements in parallel
    const [orders, settlements] = await Promise.all([
      kalshiClient.getOrders(undefined, undefined, 200).catch(() => []),
      kalshiClient.getSettlements(undefined, 200).catch(() => []),
    ]);

    const revBySlug = {};
    for (const s of settlements) {
      const slug = tickerToSlug(s.ticker || "");
      revBySlug[slug] = (revBySlug[slug] || 0) + parseFloat(s.revenue || 0);
    }

    const ordersBySlug = {};
    for (const o of orders) {
      const slug = tickerToSlug(o.ticker || "");
      ordersBySlug[slug] = (ordersBySlug[slug] || 0) + 1;
    }

    revenueCache = { revenue: revBySlug, orders: ordersBySlug };
    revenueCacheTime = Date.now();
    res.json({ revenue: revBySlug, orders: ordersBySlug, cached: false, settlementCount: settlements.length, orderCount: orders.length });
  } catch (e) {
    console.error(`Error in /api/market-revenue: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ── Market Overview API ─────────────────────────────────────────────────────
app.get("/api/market/:slug/overview", async (req, res) => {
    try {
        const slug = req.params.slug.toLowerCase();
        if (!/^[\w.-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const analysis = analyzeSession(slug);
        const slugToTitle = loadMarketTitles();
        const manifest = getMarketManifest(slug);

        // Get all tickers from DB (even without signals)
        const db = openDb(slug);
        const allTickers = db ? getTickers(db) : [];
        const tickerSet = [...new Set([...analysis.tickers, ...allTickers])];

        // Build ticker details (charts + summaries)
        const tickerDetails = [];
        for (const ticker of tickerSet) {
            tickerDetails.push({
                ticker,
                suffix: ticker.split("-").pop(),
                noAskSeries: db ? getNoAskSeries(db, ticker) : [],
                yesBidSeries: db ? getYesBidSeries(db, ticker) : [],
                signalCount: analysis.signals.filter(s => s.ticker === ticker).length,
            });
        }
        if (db) db.close();

        // Fetch trade history from Kalshi API
        let tradeHistory = { available: false, fills: [], settlements: [], pnl: null };
        let ordersBySlug = {};
        let revenueBySlug = {};
        if (kalshiClient) {
            try {
                const relevantTickers = tickerSet.length > 0 ? [...tickerSet].slice(0, 20) : allTickers.slice(0, 20);
                if (relevantTickers.length > 0) {
                    const [allFills, allSettlements, allOrders] = await Promise.all([
                        Promise.all(relevantTickers.map(t => kalshiClient.getFills(t, 50).catch(() => []))).then(arrs => arrs.flat()),
                        Promise.all(relevantTickers.map(t => kalshiClient.getSettlements(t, 50).catch(() => []))).then(arrs => arrs.flat()),
                        Promise.all(relevantTickers.map(t => kalshiClient.getOrders(t, undefined, 100).catch(() => []))).then(arrs => arrs.flat()),
                    ]);
                    const pnl = computeMarketPnL(allFills, allSettlements);
                    tradeHistory = { available: true, fills: allFills, settlements: allSettlements, pnl };
                    // Count orders and sum revenue for this market
                    for (const f of allFills) {
                        const t = (f.ticker || '').toLowerCase();
                        const ds = t.lastIndexOf("-");
                        const sl = ds > 0 ? t.slice(0, ds) : t;
                        if (sl === slug) ordersBySlug[slug] = (ordersBySlug[slug] || 0) + 1;
                    }
                    for (const s of allSettlements) {
                        revenueBySlug[slug] = (revenueBySlug[slug] || 0) + parseFloat(s.revenue || 0);
                    }
                    for (const o of allOrders) {
                        ordersBySlug[slug] = (ordersBySlug[slug] || 0) + 1;
                    }
                }
            } catch (e) {
                console.error(`Trade history fetch failed for ${slug}: ${e.message}`);
            }
        }

        // Summary: combine signals + trades + tickers
        const summary = {
            totalTickers: tickerSet.length,
            totalSignals: analysis.stats.totalSignals,
            uniqueWords: analysis.stats.uniqueWords,
            beforeCount: analysis.stats.beforeCount,
            afterCount: analysis.stats.afterCount,
            resolvedYes: analysis.stats.resolvedYes,
            resolvedNo: analysis.stats.resolvedNo,
            avgLead: analysis.stats.avgLeadHuman,
            orderCount: ordersBySlug[slug] || 0,
            revenue: revenueBySlug[slug] || 0,
            hasOrderbook: allTickers.length > 0,
            tradeAvailable: tradeHistory.available,
        };

        res.json({
            slug,
            title: slugToTitle.get(slug) || (manifest && manifest.title) || slug,
            eventStartTime: manifest ? manifest.eventStartTime : null,
            keywords: manifest ? manifest.keywords : {},
            summary,
            tickers: tickerSet,
            signals: analysis.signals,
            tickerDetails,
            tradeHistory,
        });
    } catch (e) {
        console.error(`Error in /api/market/:slug/overview: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/market/:slug/trades", async (req, res) => {
    try {
        const slug = req.params.slug.toLowerCase();
        if (!/^[\w.-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        if (!kalshiClient) {
            return res.json({ available: false, message: "Kalshi credentials not configured" });
        }

        const ticker = req.query.ticker || null;
        const limit = Math.min(parseInt(req.query.limit) || 100, 200);

        const tickers = ticker ? [ticker] : (() => {
            const analysis = analyzeSession(slug);
            return analysis.tickers;
        })();

        const fillPromises = tickers.map(t => kalshiClient.getFills(t, limit).catch(() => []));
        const settlementPromises = tickers.map(t => kalshiClient.getSettlements(t, limit).catch(() => []));
        const orderPromises = tickers.map(t => kalshiClient.getOrders(t, "executed", limit).catch(() => []));

        const [allFills, allSettlements, allOrders] = await Promise.all([
            Promise.all(fillPromises).then(arrs => arrs.flat()),
            Promise.all(settlementPromises).then(arrs => arrs.flat()),
            Promise.all(orderPromises).then(arrs => arrs.flat()),
        ]);

        const pnl = computeMarketPnL(allFills, allSettlements);
        const orderSummary = summarizeOrders(allOrders);

        res.json({
            available: true,
            fills: allFills,
            settlements: allSettlements,
            orders: allOrders,
            pnl,
            orderSummary,
        });
    } catch (e) {
        console.error(`Error in /api/market/:slug/trades: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/session/:slug", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "session-detail.html"));
});

// ── Session detail API ──────────────────────────────────────────────────────
app.get("/api/session/:slug", (req, res) => {
    try {
        const slug = req.params.slug.toLowerCase();

        // Find full session directory name for transcript linking
        let sessionName = slug;
        const s3Dir = path.join(DATA_DIR, "s3");
        if (fs.existsSync(s3Dir)) {
            const dirs = fs.readdirSync(s3Dir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);
            const match = dirs.find(d => d.startsWith(slug + "_") && /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(d));
            if (match) sessionName = match;
        }

        const slugToTitle = loadMarketTitles();
        const mediaSources = parseMediaSources();
        const analysis = analyzeSession(slug);

        res.json({
            slug,
            session: sessionName,
            title: slugToTitle.get(slug) || slug,
            mediaSource: mediaSources.get(slug) || slug.split("-")[0],
            tickers: analysis.tickers,
            stats: analysis.stats,
            signals: analysis.signals,
            tickerSummaries: analysis.tickerSummaries,
        });
    } catch (e) {
        console.error(`Error in /api/session/:slug: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// ── Voice Sample Management API ──────────────────────────────────────────

const AUDIO_LIBRARY = path.join(require("os").homedir(), "audio-library");

app.post("/api/voice/generate", async (req, res) => {
    try {
        let { target, urls } = req.body;
        if (!target || typeof target !== "string" || !target.trim()) {
            return res.status(400).json({ error: "Missing or invalid target name" });
        }

        // Collect URLs from the urls array (if provided)
        const allUrls = [];
        if (urls && Array.isArray(urls)) {
            for (const u of urls) {
                if (u && typeof u === "string" && u.trim()) {
                    allUrls.push(u.trim());
                }
            }
        }

        // Also detect YouTube URLs pasted directly into the target name field
        const urlRegex = /\b(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|youtube\.com\/(embed|shorts|live)\/[\w-]+)(\S*)?\b/gi;
        const foundUrls = target.match(urlRegex) || [];
        for (const u of foundUrls) {
            allUrls.push(u);
        }
        // Remove URLs from the target name so they don't become part of the search
        target = target.replace(urlRegex, "").replace(/\s+/g, " ").trim();

        if (!target) {
            return res.status(400).json({ error: "Missing or invalid target name after removing URLs" });
        }

        const slug = target.toLowerCase().trim()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/[\s]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        const jobData = { target: target.trim() };
        const deduped = [...new Set(allUrls)];
        if (deduped.length > 0) {
            jobData.urls = deduped;
        }

        const job = await sampleGenQueue.add("generate_samples", jobData);

        const counts = await sampleGenQueue.getJobCounts();
        const depth = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);

        res.json({ success: true, jobId: job.id, slug, queueDepth: depth, urls: deduped.length });
    } catch (e) {
        console.error(`Error in POST /api/voice/generate: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/voice/verifications", async (req, res) => {
    try {
        const slugs = await pendingVerifications();
        const marketSpeakers = getAllMarketSpeakers();
        const results = [];

        for (const slug of slugs) {
            const states = await getAllVerificationStates(slug);
            const segmentCount = Object.keys(states).length;
            let approved = 0, rejected = 0, pending = 0;
            let target = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

            for (const v of Object.values(states)) {
                if (v.approved === true) approved++;
                else if (v.approved === false) rejected++;
                else pending++;
                if (v.target) target = v.target;
            }

            results.push({
                slug, target, segmentCount, approved, rejected, pending,
                resolved: pending === 0,
                hasMarket: marketSpeakers.has(target.toLowerCase().trim()),
            });
        }

        res.json(results);
    } catch (e) {
        console.error(`Error in GET /api/voice/verifications: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/voice/verification/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const states = await getAllVerificationStates(slug);
        if (Object.keys(states).length === 0) {
            return res.status(404).json({ error: "No verification state found for this slug" });
        }

        const segments = [];
        for (const [idx, data] of Object.entries(states)) {
            const source = (data.source || "").replace(/\.wav$/, "");
            const vidId = source.includes("_") ? source.split(/_(.+)/)[1] : source;
            segments.push({
                index: parseInt(idx, 10),
                target: data.target || "",
                score: data.score,
                refScore: data.ref_score ?? null,
                duration: data.duration,
                jobId: data.job_id || null,
                approved: data.approved,
                sourceUrl: vidId ? `https://youtube.com/watch?v=${vidId}` : null,
                audioUrl: `/api/voice/audio/${slug}/${idx}`,
            });
        }
        segments.sort((a, b) => {
            // Push rejected segments to the end
            if (a.approved === false && b.approved !== false) return 1;
            if (a.approved !== false && b.approved === false) return -1;
            return a.index - b.index;
        });

        const target = segments[0]?.target || slug;
        const resolved = segments.every(s => s.approved !== null);
        const approvedCount = segments.filter(s => s.approved === true).length;
        const rejectedCount = segments.filter(s => s.approved === false).length;

        res.json({
            slug, target, segments, resolved, approvedCount, rejectedCount,
            pendingCount: segments.length - approvedCount - rejectedCount,
        });
    } catch (e) {
        console.error(`Error in GET /api/voice/verification/:slug: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

async function handleSegmentDecision(slug, index, approved) {
    if (!/^[\w-]+$/.test(slug)) {
        return { error: "Invalid slug", status: 400 };
    }
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0) {
        return { error: "Invalid segment index", status: 400 };
    }

    const state = await getVerificationState(slug, idx);
    if (!state) {
        return { error: "Segment not found or verification expired", status: 404 };
    }

    await updateVerificationState(slug, idx, { approved });

    // Save individual samples immediately on approval
    let saveJob = null;
    if (approved) {
        const target = state.target || slug;
        saveJob = await saveSamplesQueue.add("save_samples", {
            slug, target, approved_indices: [idx],
        });
    }

    const allStates = await getAllVerificationStates(slug);
    const resolved = Object.values(allStates).every(s => s.approved !== null);

    return { success: true, slug, index: idx, approved, resolved, saveJobId: saveJob ? saveJob.id : null };
}

app.post("/api/voice/approve/:slug/:index", async (req, res) => {
    try {
        const result = await handleSegmentDecision(req.params.slug, req.params.index, true);
        res.status(result.status || 200).json(result);
    } catch (e) {
        console.error(`Error in approve: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/voice/reject/:slug/:index", async (req, res) => {
    try {
        const result = await handleSegmentDecision(req.params.slug, req.params.index, false);
        res.status(result.status || 200).json(result);
    } catch (e) {
        console.error(`Error in reject: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/voice/auto-approve/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const allStates = await getAllVerificationStates(slug);
        if (Object.keys(allStates).length === 0) {
            return res.status(404).json({ error: "No verification state found" });
        }

        let autoCount = 0;
        for (const [idx, data] of Object.entries(allStates)) {
            if (data.approved === null) {
                await updateVerificationState(slug, parseInt(idx, 10), { approved: true });
                autoCount++;
            }
        }

        const approvedIdxs = Object.entries(allStates)
            .filter(([, v]) => v.approved === true || v.approved === null)
            .map(([k]) => parseInt(k, 10));
        const target = Object.values(allStates)[0]?.target || slug;

        const saveJob = await saveSamplesQueue.add("save_samples", {
            slug, target, approved_indices: approvedIdxs,
        });

        res.json({ success: true, slug, autoApproved: autoCount, saveJobId: saveJob.id });
    } catch (e) {
        console.error(`Error in auto-approve: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/voice/reject-all/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        const allStates = await getAllVerificationStates(slug);
        if (Object.keys(allStates).length === 0) {
            return res.status(404).json({ error: "No verification state found" });
        }

        let rejectedCount = 0;
        for (const [idx, data] of Object.entries(allStates)) {
            if (data.approved === null) {
                await updateVerificationState(slug, parseInt(idx, 10), { approved: false });
                rejectedCount++;
            }
        }

        res.json({ success: true, slug, rejectedCount });
    } catch (e) {
        console.error(`Error in reject-all: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/voice/reject-source/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }
        const { sourceUrl } = req.body;
        if (!sourceUrl) {
            return res.status(400).json({ error: "Missing sourceUrl" });
        }

        // Extract video ID to match against stored source field
        const vidId = sourceUrl.includes("v=") ? sourceUrl.split("v=").pop() : sourceUrl;

        const allStates = await getAllVerificationStates(slug);
        if (Object.keys(allStates).length === 0) {
            return res.status(404).json({ error: "No verification state found" });
        }

        let rejectedCount = 0;
        for (const [idx, data] of Object.entries(allStates)) {
            if (data.approved === null && (data.source || "").includes(vidId)) {
                await updateVerificationState(slug, parseInt(idx, 10), { approved: false });
                rejectedCount++;
            }
        }

        res.json({ success: true, slug, rejectedCount, sourceUrl });
    } catch (e) {
        console.error(`Error in reject-source: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/voice/clear/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        // Delete Redis verification state for this slug
        const key = `verify:${slug}`;
        const deleted = await connection.del(key);

        // Remove pending-identification work directories for this slug
        const pendingDir = path.join(require("os").homedir(), "pending-identifications");
        let dirsRemoved = 0;
        if (fs.existsSync(pendingDir)) {
            const prefix = slug + "_";
            for (const entry of fs.readdirSync(pendingDir)) {
                if (entry.startsWith(prefix) && !entry.includes("..")) {
                    fs.rmSync(path.join(pendingDir, entry), { recursive: true, force: true });
                    dirsRemoved++;
                }
            }
        }

        res.json({ success: true, slug, deleted, dirsRemoved });
    } catch (e) {
        console.error(`Error in clear slug: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/voice/clear-all", async (req, res) => {
    try {
        // 1. Clear Redis verification state
        const keys = await connection.keys("verify:*");
        let deletedCount = 0;
        for (const key of keys) {
            const result = await connection.del(key);
            deletedCount += result;
        }

        // 2. Nuke pending-identifications work directories
        const pendingDir = path.join(require("os").homedir(), "pending-identifications");
        let pendingRemoved = 0;
        if (fs.existsSync(pendingDir)) {
            const entries = fs.readdirSync(pendingDir);
            for (const entry of entries) {
                const entryPath = path.join(pendingDir, entry);
                if (!entry.includes("..")) {
                    fs.rmSync(entryPath, { recursive: true, force: true });
                    pendingRemoved++;
                }
            }
        }

        res.json({
            success: true,
            deletedKeys: deletedCount,
            totalKeys: keys.length,
            pendingRemoved,
        });
    } catch (e) {
        console.error(`Error in clear-all: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/voice/audio/:slug/:index", async (req, res) => {
    try {
        const { slug, index } = req.params;
        if (!/^[\w-]+$/.test(slug)) {
            return res.status(400).json({ error: "Invalid slug" });
        }
        if (!/^\d+$/.test(index)) {
            return res.status(400).json({ error: "Invalid index" });
        }

        const state = await getVerificationState(slug, parseInt(index, 10));
        if (!state || !state.ogg_path) {
            return res.status(404).json({ error: "Audio not found or verification expired" });
        }

        if (!fs.existsSync(state.ogg_path)) {
            return res.status(404).json({ error: "Audio file no longer exists on disk" });
        }

        res.setHeader("Content-Type", "audio/ogg");
        res.sendFile(state.ogg_path);
    } catch (e) {
        console.error(`Error serving audio: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/voice/library", (req, res) => {
    try {
        if (!fs.existsSync(AUDIO_LIBRARY)) {
            return res.json({ speakers: [] });
        }

        const files = fs.readdirSync(AUDIO_LIBRARY);
        const wavFiles = files.filter(f => f.endsWith(".wav"));

        const grouped = {};
        for (const f of wavFiles) {
            const stem = f.replace(/\.wav$/, "");
            const parts = stem.match(/^(.+?)(?:-(\d+))?$/);
            if (!parts) continue;
            const baseSlug = parts[1];

            if (!grouped[baseSlug]) {
                grouped[baseSlug] = { files: [], totalCount: 0 };
            }

            const filePath = path.join(AUDIO_LIBRARY, f);
            const embPath = filePath.replace(/\.wav$/, ".embedding");
            const stat = fs.statSync(filePath);

            grouped[baseSlug].files.push({
                filename: f,
                size: stat.size,
                hasEmbedding: fs.existsSync(embPath),
                audioUrl: `/api/voice/library-audio/${f}`,
            });
            grouped[baseSlug].totalCount++;
        }

        const speakers = Object.entries(grouped).map(([slug, data]) => {
            data.files.sort((a, b) => {
                const aNum = parseInt((a.filename.match(/-(\d+)\.wav$/) || ["", "0"])[1], 10);
                const bNum = parseInt((b.filename.match(/-(\d+)\.wav$/) || ["", "0"])[1], 10);
                return aNum - bNum;
            });
            return { slug, ...data };
        });

        speakers.sort((a, b) => a.slug.localeCompare(b.slug));
        res.json({ speakers });
    } catch (e) {
        console.error(`Error listing library: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/voice/library-audio/:file", (req, res) => {
    const { file } = req.params;
    if (!/^[\w.-]+\.wav$/.test(file) || file.includes("..")) {
        return res.status(400).json({ error: "Invalid filename" });
    }
    const filePath = path.join(AUDIO_LIBRARY, file);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("Content-Type", "audio/wav");
    res.sendFile(filePath);
});

app.delete("/api/voice/library/:file", (req, res) => {
    try {
        const { file } = req.params;
        if (!/^[\w.-]+\.(wav|embedding)$/.test(file) || file.includes("..")) {
            return res.status(400).json({ error: "Invalid filename" });
        }

        const filePath = path.join(AUDIO_LIBRARY, file);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }

        fs.unlinkSync(filePath);

        const partnerExt = file.endsWith(".wav") ? ".embedding" : ".wav";
        const partnerPath = filePath.replace(/\.(wav|embedding)$/, partnerExt);
        if (fs.existsSync(partnerPath)) {
            fs.unlinkSync(partnerPath);
        }

        res.json({ success: true });
    } catch (e) {
        console.error(`Error deleting library file: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/voice/library/speaker/:slug", (req, res) => {
    try {
        const { slug } = req.params;
        if (!/^[\w-]+$/.test(slug) || slug.includes("..")) {
            return res.status(400).json({ error: "Invalid slug" });
        }

        if (!fs.existsSync(AUDIO_LIBRARY)) {
            return res.status(404).json({ error: "Library not found" });
        }

        const files = fs.readdirSync(AUDIO_LIBRARY);
        const prefix = slug + "-";
        const prefixAlt = slug + ".";
        let deleted = 0;

        for (const f of files) {
            if (f.startsWith(prefix) || f.startsWith(prefixAlt)) {
                const filePath = path.join(AUDIO_LIBRARY, f);
                if (!f.includes("..")) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            }
        }

        res.json({ success: true, deleted });
    } catch (e) {
        console.error(`Error deleting speaker: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// ── Bull Board ────────────────────────────────────────────────────────
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { runClientQueue, logSyncQueue, schedulingLoopQueue, transcriptRefreshQueue, socialFetchQueue, sampleGenQueue, saveSamplesQueue, connection } = require("./lib/queues");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [
    new BullMQAdapter(runClientQueue),
    new BullMQAdapter(logSyncQueue),
    new BullMQAdapter(schedulingLoopQueue),
    new BullMQAdapter(transcriptRefreshQueue),
    new BullMQAdapter(socialFetchQueue),
    new BullMQAdapter(sampleGenQueue),
    new BullMQAdapter(saveSamplesQueue),
  ],
  serverAdapter,
});
app.use("/admin/queues", serverAdapter.getRouter());

app.listen(PORT, () => {
    console.log(`Market Manager UI running at http://localhost:${PORT}`);
    console.log(`Bull Board running at http://localhost:${PORT}/admin/queues`);
});
