import { getMarkets } from "./api.js";

import fs from "fs";

const now = Math.floor(Date.now() / 1000);
const one_week_ago = now - (7 * 24 * 60 * 60);

console.log(`Fetching markets settled since ${new Date(one_week_ago * 1000).toISOString()}...`);

let allMarkets = [];
let cursor = null;
let pageCount = 0;

while (true) {
    pageCount++;
    console.log(`Fetching page ${pageCount}...`);

    const data = await getMarkets({
        limit: 1000,
        status: 'settled',
        min_settled_ts: one_week_ago,
        cursor: cursor
    });

    if (data.error) {
        console.error("API Error:", data.error);
        break;
    }

    if (data.markets && data.markets.length > 0) {
        allMarkets.push(...data.markets);
    }

    cursor = data.cursor;
    if (!cursor) {
        break;
    }
}

console.log(`\nFinished fetching. Total markets: ${allMarkets.length}`);

fs.writeFileSync('markets.json', JSON.stringify(allMarkets, null, 2));

// Filter for mentions markets specifically
const mentions = allMarkets.filter(m =>
    m.title.toLowerCase().includes('mention') ||
    m.ticker.toLowerCase().includes('mention') ||
    m.subtitle.toLowerCase().includes('mention')
);

console.log(`Found ${mentions.length} mention-related markets.`);

fs.writeFileSync('mentions.json', JSON.stringify(mentions, null, 2));
