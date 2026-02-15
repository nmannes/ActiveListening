import { getEvents } from "./api.js";

import fs from "fs";

const now = Date.now();
const one_month_ago = now - (30 * 24 * 60 * 60 * 1000);

console.log(`Fetching events settled since ${new Date(one_month_ago).toISOString()}...`);

let allEvents = [];
let totalMentions = 0;
let cursor = null;

if (fs.existsSync('cursor.txt')) {
    cursor = fs.readFileSync('cursor.txt', 'utf8').trim();
    console.log(`Resuming from cursor: ${cursor}`);
}

let pageCount = 0;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isMention = (e) =>
    (e.title && e.title.toLowerCase().includes('mention')) ||
    (e.event_ticker && e.event_ticker.toLowerCase().includes('mention')) ||
    (e.sub_title && e.sub_title.toLowerCase().includes('mention'));

while (true) {
    pageCount++;
    console.log(`\n--- Page ${pageCount} ---`);
    await wait(1000); // 1s delay

    const data = await getEvents({
        limit: 200,
        status: 'settled',
        min_close_ts: Math.floor(one_month_ago / 1000),
        max_close_ts: Math.floor(now / 1000),
        cursor: cursor,
    });

    if (data.error) {
        console.error("API Error:", data.error);
        break;
    }

    if (data.events && data.events.length > 0) {
        const pageMentions = data.events.filter(isMention);
        totalMentions += pageMentions.length;
        allEvents.push(...data.events);

        console.log(`Events in page: ${data.events.length}`);
        console.log(`Mentions in page: ${pageMentions.length}`);
        console.log(`Total events so far: ${allEvents.length}`);
        console.log(`Total mentions so far: ${totalMentions}`);

        // Save data after each iteration
        saveEvents(allEvents);
    }

    cursor = data.cursor;

    // Write cursor to file
    if (cursor) {
        fs.writeFileSync('cursor.txt', cursor);
        console.log(`Cursor saved: ${cursor}`);
    } else {
        if (fs.existsSync('cursor.txt')) fs.unlinkSync('cursor.txt');
        console.log("No more cursors.");
    }

    if (allEvents.length >= 50000 || !cursor) {
        break;
    }
}

console.log(`\nFinished fetching. Total events: ${allEvents.length}`);

function saveEvents(events) {
    fs.writeFileSync('events.json', JSON.stringify(events, null, 2));

    // Filter for mentions events specifically
    const mentions = events.filter(e =>
        (e.title && e.title.toLowerCase().includes('mention')) ||
        (e.event_ticker && e.event_ticker.toLowerCase().includes('mention')) ||
        (e.sub_title && e.sub_title.toLowerCase().includes('mention'))
    );

    console.log(`Found ${mentions.length} mention-related events.`);
    fs.writeFileSync('event_mentions.json', JSON.stringify(mentions, null, 2));
}