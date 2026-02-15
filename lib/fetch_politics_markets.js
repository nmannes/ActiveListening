import fs from "fs";
import { getEvent } from "./api.js";

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPoliticsMarkets() {
    try {
        const mentions = JSON.parse(fs.readFileSync('event_mentions.json', 'utf8'));

        // Identify politics events
        const politics = mentions.filter(e =>
            e.series_ticker && (
                e.series_ticker.includes('TRUMPMENTION') ||
                e.series_ticker.includes('GOVERNORMENTION') ||
                e.series_ticker.includes('WITNESSMENTION') ||
                e.series_ticker.includes('RFKMENTION') ||
                e.series_ticker.includes('NEWSNATIONMENTION') ||
                e.series_ticker.includes('FOXNEWSMENTION') ||
                e.series_ticker.includes('FTNMENTION') ||
                e.series_ticker.includes('LATEIGHTMENTION')
            )
        );

        console.log(`Found ${politics.length} politics/media events. Fetching nested markets...`);

        const results = [];
        for (let i = 0; i < politics.length; i++) {
            const event = politics[i];
            console.log(`[${i + 1}/${politics.length}] Fetching: ${event.event_ticker}`);

            try {
                const detailedEvent = await getEvent(event.event_ticker, true);
                results.push(detailedEvent);
            } catch (err) {
                console.error(`Failed to fetch ${event.event_ticker}:`, err.message);
            }

            await wait(1000);

            if ((i + 1) % 10 === 0) {
                fs.writeFileSync('politics_markets_partial.json', JSON.stringify(results, null, 2));
            }
        }

        fs.writeFileSync('politics_markets.json', JSON.stringify(results, null, 2));
        console.log(`\nSuccessfully saved ${results.length} events to politics_markets.json`);

    } catch (error) {
        console.error("Extraction failed:", error);
    }
}

fetchPoliticsMarkets();
