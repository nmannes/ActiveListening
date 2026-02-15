import fs from "fs";
import { getEvent } from "./api.js";

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAnnouncerMarkets() {
    try {
        const mentions = JSON.parse(fs.readFileSync('event_mentions.json', 'utf8'));

        // Identify announcer events
        const announcers = mentions.filter(e =>
            (e.title && e.title.toLowerCase().includes('announcer')) ||
            (e.series_ticker && (
                e.series_ticker.includes('NBAMENTION') ||
                e.series_ticker.includes('NCAABMENTION') ||
                e.series_ticker.includes('NFLMENTION')
            ))
        );

        console.log(`Found ${announcers.length} announcer events. Fetching nested markets...`);

        const results = [];
        for (let i = 0; i < announcers.length; i++) {
            const event = announcers[i];
            console.log(`[${i + 1}/${announcers.length}] Fetching markets for: ${event.event_ticker}`);

            try {
                const detailedEvent = await getEvent(event.event_ticker, true);
                results.push(detailedEvent);
            } catch (err) {
                console.error(`Failed to fetch ${event.event_ticker}:`, err.message);
            }

            // Respect rate limits
            await wait(1000);

            // Periodic save
            if ((i + 1) % 10 === 0) {
                fs.writeFileSync('announcer_markets_partial.json', JSON.stringify(results, null, 2));
            }
        }

        fs.writeFileSync('announcer_markets.json', JSON.stringify(results, null, 2));
        console.log(`\nSuccessfully saved ${results.length} events with markets to announcer_markets.json`);

    } catch (error) {
        console.error("Extraction failed:", error);
    }
}

fetchAnnouncerMarkets();
