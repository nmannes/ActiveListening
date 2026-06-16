const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
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

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = process.env.KALSHI_DATA_DIR || __dirname;
const CACHE_DIR = process.env.KALSHI_CACHE_DIR || path.join(DATA_DIR, "cache");
const MATCHED_PATH = path.join(CACHE_DIR, "matched_markets.json");
const UNMATCHED_PATH = path.join(CACHE_DIR, "unmatched_markets.json");
const MANUAL_MATCHES_PATH = path.join(CACHE_DIR, "manual_matches.json");
const DATA_ENTRIES_PATH = path.join(CACHE_DIR, "data_entries.json");
const SAMPLES_DIR = path.join(DATA_DIR, "sample-scheduling");

// Ensure files exist
[MATCHED_PATH, UNMATCHED_PATH, MANUAL_MATCHES_PATH].forEach(p => {
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});
if (!fs.existsSync(DATA_ENTRIES_PATH)) fs.writeFileSync(DATA_ENTRIES_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

function readJsonFile(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
        console.error(`Error reading ${filePath}: ${e.message}`);
        return defaultValue;
    }
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

        const scheduledSlugs = new Set(
            fs.readdirSync(path.join(DATA_DIR, "scheduled"))
                .filter(f => f.endsWith(".json"))
                .map(f => f.replace(".json", ""))
        );

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
            const duration = getDuration(m.market, m);
            return {
                ...m,
                market: {
                    ...m.market,
                    mediaStreamURL: m.market.mediaStreamURL || streamInfo.url,
                    channelName: streamInfo.name,
                    isScheduled: scheduledSlugs.has(m.market.slug),
                    duration,
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
        const { market, mediaStreamURL, startTime } = req.body;
        if (!market || !mediaStreamURL) {
            return res.status(400).json({ error: "Missing market or mediaStreamURL" });
        }

        let manual = readJsonFile(MANUAL_MATCHES_PATH);

        // Update if exists, otherwise append
        const index = manual.findIndex(m => m.market.slug === market.slug);
        const updatedMarket = {
            market: { ...market, mediaStreamURL },
            startTime: startTime || market.eventStartTime,
            manual: true
        };

        if (index !== -1) {
            manual[index] = updatedMarket;
        } else {
            manual.push(updatedMarket);
        }

        fs.writeFileSync(MANUAL_MATCHES_PATH, JSON.stringify(manual, null, 2));
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

app.get("/signals", (req, res) => {
    res.sendFile(path.join(DATA_DIR, "signal_vs_no_closeout.html"));
});

app.get("/logs", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "logs.html"));
});

app.get("/voice", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "voice.html"));
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
        const cmd = `bash run_sample.sh "${samplePath}" >> data-entry.log`;
        exec(cmd,
            (err) => { if (err) fs.appendFileSync(path.join(DATA_DIR, "data-entry.log"), `${new Date().toISOString()} Retry run error (${entry.slug}): ${err.message}\n`); }
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

        const cmd = `bash run_sample.sh "${samplePath}" >> data-entry.log`;
        exec(cmd,
            (err) => { if (err) fs.appendFileSync(path.join(DATA_DIR, "data-entry.log"), `${new Date().toISOString()} Retry run error (${entry.slug}): ${err.message}\n`); }
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

        // Load metadata
        const slugToTitle = loadMarketTitles();
        const resolutions = loadResolutions();
        const mediaSources = parseMediaSources();

        // Parse signals for this session only
        const signals = parseLogFiles(slug);

        // Open session DB
        const db = openDb(slug);
        const tickers = db ? getTickers(db) : [];

        // Deduplicate signals by timestamp
        const seen = new Set();
        const uniqueSignals = [];
        for (const sig of signals) {
            if (!seen.has(sig.timestamp)) {
                seen.add(sig.timestamp);
                uniqueSignals.push(sig);
            }
        }

        // Analyze each signal
        const tickerSet = new Set();
        const results = [];
        for (const sig of uniqueSignals) {
            // Resolve ticker
            let matchedTicker = null;
            if (tickers.length > 0) {
                matchedTicker = fuzzyMatchTicker(sig.word, tickers);
            }
            if (matchedTicker) tickerSet.add(matchedTicker);

            const signalTime = parseSignalTs(sig.timestamp, sig.tz);
            const signalIso = signalTime.toISOString();

            // Market change analysis
            const mktChange = (db && matchedTicker) ? findMarketChange(db, matchedTicker, signalIso) : null;
            const mktChangeTs = mktChange ? mktChange.ts : null;
            const mktChangeTime = mktChangeTs ? new Date(mktChangeTs) : null;

            let deltaMs = null;
            let status = "NO_CHANGE";
            if (mktChangeTime) {
                deltaMs = mktChangeTime.getTime() - signalTime.getTime();
                status = deltaMs > 0 ? "BEFORE" : "AFTER";
            }

            let signalPrice = null;
            let changePrice = null;
            let changeSide = "—";
            if (db && matchedTicker) {
                signalPrice = getNoPriceAt(db, matchedTicker, signalIso);
                if (mktChange) {
                    changePrice = mktChange.price;
                    changeSide = mktChange.side || "no";
                    if (changeSide === 'yes') {
                        signalPrice = getYesPriceAt(db, matchedTicker, signalIso);
                    }
                }
            }

            // Resolution
            let resolution = "PENDING";
            let resolutionResult = null;
            if (matchedTicker && resolutions[matchedTicker]) {
                const r = resolutions[matchedTicker];
                if (r.status === "settled" && r.result) {
                    resolution = r.result.toUpperCase();
                    resolutionResult = r.result;
                }
            }

            const suffix = matchedTicker ? matchedTicker.split("-").pop() : "???";

            results.push({
                session: slug,
                word: sig.word,
                ticker: matchedTicker || null,
                suffix,
                signalTs: sig.timestamp,
                signalIso,
                mktChangeTs: mktChangeTs || null,
                mktChangeQty: mktChange ? mktChange.absChange : 0,
                deltaMs,
                deltaHuman: formatDeltaHuman(deltaMs),
                deltaCs: deltaMs !== null ? (deltaMs / 10).toFixed(0) : null,
                status,
                changeSide,
                changePrice,
                signalPrice,
                resolution,
                resolutionResult,
                noAskSeries: (db && matchedTicker) ? getNoAskSeries(db, matchedTicker) : [],
                yesBidSeries: (db && matchedTicker) ? getYesBidSeries(db, matchedTicker) : [],
            });
        }

        // Sort by signal time
        results.sort((a, b) => new Date(b.signalIso).getTime() - new Date(a.signalIso).getTime());

        // Summary stats
        const beforeCount = results.filter(r => r.status === "BEFORE").length;
        const afterCount = results.filter(r => r.status === "AFTER").length;
        const noChangeCount = results.filter(r => r.status === "NO_CHANGE").length;
        const resolvedYes = results.filter(r => r.resolution === "YES").length;
        const resolvedNo = results.filter(r => r.resolution === "NO").length;
        const resolvedPending = results.filter(r => r.resolution === "PENDING").length;

        const beforeDeltas = results.filter(r => r.status === "BEFORE" && r.deltaMs !== null).map(r => r.deltaMs);
        const avgLeadMs = beforeDeltas.length ? beforeDeltas.reduce((a, b) => a + b, 0) / beforeDeltas.length : 0;
        const medianLeadMs = beforeDeltas.length ? [...beforeDeltas].sort((a, b) => a - b)[Math.floor(beforeDeltas.length / 2)] : 0;

        // Per-ticker summaries
        const tickerSummaries = [];
        for (const ticker of tickerSet) {
            const tickerResults = results.filter(r => r.ticker === ticker);
            const tickerRes = resolutions[ticker];
            let tickerResolution = "PENDING";
            if (tickerRes && tickerRes.status === "settled" && tickerRes.result) {
                tickerResolution = tickerRes.result.toUpperCase();
            }
            tickerSummaries.push({
                ticker,
                suffix: ticker.split("-").pop(),
                resolution: tickerResolution,
                signalCount: tickerResults.length,
                noAskSeries: (db ? getNoAskSeries(db, ticker) : []),
                yesBidSeries: (db ? getYesBidSeries(db, ticker) : []),
            });
        }

        if (db) db.close();

        res.json({
            slug,
            session: sessionName,
            title: slugToTitle.get(slug) || slug,
            mediaSource: mediaSources.get(slug) || slug.split("-")[0],
            tickers: [...tickerSet],
            stats: {
                totalSignals: results.length,
                uniqueWords: new Set(results.map(r => r.word)).size,
                beforeCount, afterCount, noChangeCount,
                resolvedYes, resolvedNo, resolvedPending,
                avgLeadMs, avgLeadHuman: formatDeltaHuman(avgLeadMs),
                medianLeadMs, medianLeadHuman: formatDeltaHuman(medianLeadMs),
            },
            signals: results,
            tickerSummaries,
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
        const { target } = req.body;
        if (!target || typeof target !== "string" || !target.trim()) {
            return res.status(400).json({ error: "Missing or invalid target name" });
        }

        const slug = target.toLowerCase().trim()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/[\s]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        const job = await sampleGenQueue.add("generate_samples", {
            target: target.trim(),
        });

        const counts = await sampleGenQueue.getJobCounts();
        const depth = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);

        res.json({ success: true, jobId: job.id, slug, queueDepth: depth });
    } catch (e) {
        console.error(`Error in POST /api/voice/generate: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/voice/verifications", async (req, res) => {
    try {
        const slugs = await pendingVerifications();
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
            const vidId = source.includes("_") ? source.split("_").pop() : source;
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
        segments.sort((a, b) => a.index - b.index);

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

    const allStates = await getAllVerificationStates(slug);
    const resolved = Object.values(allStates).every(s => s.approved !== null);

    let saveJob = null;
    if (resolved && Object.keys(allStates).length > 0) {
        const approvedIdxs = Object.entries(allStates)
            .filter(([, v]) => v.approved === true)
            .map(([k]) => parseInt(k, 10));
        const target = state.target || slug;

        saveJob = await saveSamplesQueue.add("save_samples", {
            slug, target, approved_indices: approvedIdxs,
        });
    }

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

// ── Bull Board ────────────────────────────────────────────────────────
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");
const { runClientQueue, logSyncQueue, schedulingLoopQueue, sampleGenQueue, saveSamplesQueue, connection } = require("./lib/queues");

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [
    new BullMQAdapter(runClientQueue),
    new BullMQAdapter(logSyncQueue),
    new BullMQAdapter(schedulingLoopQueue),
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
