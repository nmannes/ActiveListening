const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const { CHANNEL_MAPPINGS } = require("./lib/yttv_channels");

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const CACHE_DIR = path.join(__dirname, "cache");
const MATCHED_PATH = path.join(CACHE_DIR, "matched_markets.json");
const UNMATCHED_PATH = path.join(CACHE_DIR, "unmatched_markets.json");
const MANUAL_MATCHES_PATH = path.join(CACHE_DIR, "manual_matches.json");

// Ensure files exist
[MATCHED_PATH, UNMATCHED_PATH, MANUAL_MATCHES_PATH].forEach(p => {
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});

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
            fs.readdirSync(path.join(__dirname, "scheduled"))
                .filter(f => f.endsWith(".json"))
                .map(f => f.replace(".json", ""))
        );

        function getStreamInfo(m) {
            if (m.market.mediaStreamURL) {
                for (const [name, url] of Object.entries(CHANNEL_MAPPINGS)) {
                    if (url === m.market.mediaStreamURL) return { url: m.market.mediaStreamURL, name };
                }
                return { url: m.market.mediaStreamURL, name: "Custom URL" };
            }

            let url = m.tvEvent?.channelURL || m.espnEvent?.gameLink || null;
            let name = m.tvEvent?.station || (m.espnEvent?.gameLink ? "ESPN.com" : null);

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

app.listen(PORT, () => {
    console.log(`Market Manager UI running at http://localhost:${PORT}`);
});
