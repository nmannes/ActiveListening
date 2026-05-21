const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const { CHANNEL_MAPPINGS } = require("./lib/yttv_channels");
const { execSync } = require("child_process");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const DATA_DIR = process.env.KALSHI_DATA_DIR || __dirname;
const CACHE_DIR = process.env.KALSHI_CACHE_DIR || path.join(DATA_DIR, "cache");
const MATCHED_PATH = path.join(CACHE_DIR, "matched_markets.json");
const UNMATCHED_PATH = path.join(CACHE_DIR, "unmatched_markets.json");
const MANUAL_MATCHES_PATH = path.join(CACHE_DIR, "manual_matches.json");
const SPEAKER_LABELS_PATH = path.join(DATA_DIR, "speaker_labels.json");
const DATA_ENTRIES_PATH = path.join(CACHE_DIR, "data_entries.json");
const SAMPLES_DIR = path.join(DATA_DIR, "sample-scheduling");

// Ensure files exist
[MATCHED_PATH, UNMATCHED_PATH, MANUAL_MATCHES_PATH].forEach(p => {
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});
if (!fs.existsSync(SPEAKER_LABELS_PATH)) fs.writeFileSync(SPEAKER_LABELS_PATH, JSON.stringify({}, null, 2));
if (!fs.existsSync(DATA_ENTRIES_PATH)) fs.writeFileSync(DATA_ENTRIES_PATH, JSON.stringify([], null, 2));
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

app.use("/speakers_audio", express.static(path.join(DATA_DIR, "speakers.wav")));

function readJsonFile(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
        console.error(`Error reading ${filePath}: ${e.message}`);
        return defaultValue;
    }
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
            return {
                ...m,
                market: {
                    ...m.market,
                    mediaStreamURL: m.market.mediaStreamURL || streamInfo.url,
                    channelName: streamInfo.name,
                    isScheduled: scheduledSlugs.has(m.market.slug)
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

app.get("/api/speakers", (req, res) => {
    try {
        const labels = readJsonFile(SPEAKER_LABELS_PATH, {});
        const speakersDir = path.join(DATA_DIR, "speakers.wav");
        const s3Dir = path.join(DATA_DIR, "s3");

        if (!fs.existsSync(speakersDir)) {
            return res.json({});
        }

        const files = fs.readdirSync(speakersDir).filter(f => f.endsWith('.wav'));
        const grouped = {};
        const sessionTargets = {}; // Cache for target speakers

        for (const file of files) {
            // Expected format: session_name_speaker_1.wav
            const match = file.match(/^(.*?)_speaker_(.*?)\.wav$/);
            if (!match) continue;

            const session = match[1];
            const speakerId = match[2];

            if (session.startsWith("kxmlb") || session.startsWith("kxnba")) {
                continue;
            }

            // Look up target speaker for this session if not cached
            if (sessionTargets[session] === undefined) {
                sessionTargets[session] = null;
                const sessionPath = path.join(s3Dir, session);
                if (fs.existsSync(sessionPath)) {
                    const s3Files = fs.readdirSync(sessionPath);
                    const metaFile = s3Files.find(f => f.endsWith(".json") && f !== "transcript.json");
                    if (metaFile) {
                        try {
                            const meta = JSON.parse(fs.readFileSync(path.join(sessionPath, metaFile), "utf8"));
                            if (meta.speakerEntities && meta.speakerEntities.length > 0) {
                                sessionTargets[session] = meta.speakerEntities.join(", ");
                            }
                        } catch (e) {
                            console.error(`Error reading meta for ${session}: ${e.message}`);
                        }
                    }
                }
            }

            if (!grouped[session]) {
                grouped[session] = [];
            }

            let duration = 0;
            try {
                const stats = fs.statSync(path.join(speakersDir, file));
                duration = Math.max(0, (stats.size - 44) / 32000);
            } catch (e) { }

            grouped[session].push({
                speaker_id: speakerId,
                fileUrl: `/speakers_audio/${file}`,
                label: (labels[session] && labels[session][speakerId]) ? labels[session][speakerId] : "",
                targetSpeaker: sessionTargets[session],
                duration: duration
            });
        }

        res.json(grouped);
    } catch (e) {
        console.error(`Error in /api/speakers: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/speakers/label", (req, res) => {
    try {
        const { session, speaker_id, label } = req.body;
        if (!session || !speaker_id) {
            return res.status(400).json({ error: "Missing session or speaker_id" });
        }

        let labels = readJsonFile(SPEAKER_LABELS_PATH, {});
        if (!labels[session]) {
            labels[session] = {};
        }
        labels[session][speaker_id] = label;

        fs.writeFileSync(SPEAKER_LABELS_PATH, JSON.stringify(labels, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/signals", (req, res) => {
    res.sendFile(path.join(DATA_DIR, "signal_vs_no_closeout.html"));
});

app.get("/speakers", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "speakers.html"));
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
        res.json({ success: true });
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

app.post("/api/data-entry/generate-samples", (req, res) => {
    try {
        const entries = readJsonFile(DATA_ENTRIES_PATH, []);
        if (!entries.length) {
            return res.status(400).json({ error: "No entries to generate from." });
        }

        if (!fs.existsSync(SAMPLES_DIR)) {
            fs.mkdirSync(SAMPLES_DIR, { recursive: true });
        }

        const createdFiles = [];
        for (const entry of entries) {
            const sample = {
                mediaStreamURL: entry.youtube,
                slug: entry.slug,
                title: entry.slug,
                eventStartTime: null,
                keywords: {},
                clipProfile: null,
                audioOnly: true,
                speakerEntities: []
            };
            if (entry.speakerName) {
                sample.speakerEntities = [entry.speakerName];
            }

            const filePath = path.join(SAMPLES_DIR, `${entry.slug}.json`);
            fs.writeFileSync(filePath, JSON.stringify(sample, null, 2));
            createdFiles.push(filePath);
        }


        const at = (cmd, when = "now") =>
            execSync(`echo ${JSON.stringify(cmd)} | at ${when}`, { encoding: "utf8" }).trim();

        const jobs = [
            { type: "server", job: at("timeout 11m python server.py --local") },
            ...createdFiles.map(f => ({
                type: "client",
                slug: path.basename(f, ".json"),
                job: at(`timeout 10m bun run client.js --fromFile ${f} --local`, "now + 1 minute")
            })),
            {
                type: "identity",
                job: at(
                    "sh /home/nathan/kalshi/pull_s3_responses.sh && python /home/nathan/kalshi/extract_all_speakers.py",
                    "now + 13 minutes"
                )
            }
        ];

        res.json({ success: true, created: createdFiles, count: createdFiles.length, jobs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Market Manager UI running at http://localhost:${PORT}`);
});
