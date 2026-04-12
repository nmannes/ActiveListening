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

app.get("/api/markets", (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] GET /api/markets`);
        const matched = JSON.parse(fs.readFileSync(MATCHED_PATH, "utf8"));
        const unmatched = JSON.parse(fs.readFileSync(UNMATCHED_PATH, "utf8"));
        const manual = JSON.parse(fs.readFileSync(MANUAL_MATCHES_PATH, "utf8"));
        
        const scheduledSlugs = new Set(
            fs.readdirSync(path.join(__dirname, "scheduled"))
                .filter(f => f.endsWith(".json"))
                .map(f => f.replace(".json", ""))
        );

        function getStreamURL(m) {
            if (m.market.mediaStreamURL) return m.market.mediaStreamURL;
            
            let url = m.tvEvent?.channelURL || m.espnEvent?.gameLink || null;
            if (m.espnEvent?.tvChannels) {
                for (const ch of m.espnEvent.tvChannels) {
                    if (CHANNEL_MAPPINGS[ch.name]) {
                        url = CHANNEL_MAPPINGS[ch.name];
                        break;
                    }
                }
            }
            if (m.ncaaEvent?.network && CHANNEL_MAPPINGS[m.ncaaEvent.network]) {
                url = CHANNEL_MAPPINGS[m.ncaaEvent.network];
            }
            return url;
        }

        const enrich = (m) => ({
            ...m,
            market: {
                ...m.market,
                mediaStreamURL: m.market.mediaStreamURL || getStreamURL(m),
                isScheduled: scheduledSlugs.has(m.market.slug)
            }
        });

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

        let manual = JSON.parse(fs.readFileSync(MANUAL_MATCHES_PATH, "utf8"));
        
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
        let manual = JSON.parse(fs.readFileSync(MANUAL_MATCHES_PATH, "utf8"));
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
