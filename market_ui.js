const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const { CHANNEL_MAPPINGS } = require("./lib/yttv_channels");

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

// Ensure files exist
[MATCHED_PATH, UNMATCHED_PATH, MANUAL_MATCHES_PATH].forEach(p => {
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});
if (!fs.existsSync(SPEAKER_LABELS_PATH)) fs.writeFileSync(SPEAKER_LABELS_PATH, JSON.stringify({}, null, 2));

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
        if (!fs.existsSync(speakersDir)) {
            return res.json({});
        }

        const files = fs.readdirSync(speakersDir).filter(f => f.endsWith('.wav'));
        const grouped = {};

        for (const file of files) {
            // Expected format: session_name_speaker_1.wav
            const match = file.match(/^(.*?)_speaker_(.*?)\.wav$/);
            if (!match) continue;

            const session = match[1];
            const speakerId = match[2];

            if (session.startsWith("kxmlb") || session.startsWith("kxnba")) {
                continue;
            }

            if (!grouped[session]) {
                grouped[session] = [];
            }

            grouped[session].push({
                speaker_id: speakerId,
                fileUrl: `/speakers_audio/${file}`,
                label: (labels[session] && labels[session][speakerId]) ? labels[session][speakerId] : ""
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

app.listen(PORT, () => {
    console.log(`Market Manager UI running at http://localhost:${PORT}`);
});
