import fs from "fs";

const mentions = JSON.parse(fs.readFileSync('event_mentions.json', 'utf8'));

const announcers = mentions.filter(e =>
    (e.title && e.title.toLowerCase().includes('announcer')) ||
    (e.event_ticker && e.event_ticker.toLowerCase().includes('mention')) &&
    (e.title && (e.title.toLowerCase().includes('vs') || e.title.toLowerCase().includes('at')))
);

console.log(`\n=== Found ${announcers.length} Announcer-Related Events ===\n`);

announcers.forEach((e, i) => {
    console.log(`${(i + 1).toString().padStart(3)}. [${e.series_ticker}] ${e.title}`);
    if (e.sub_title) console.log(`     Sub-title: ${e.sub_title}`);
    console.log(`     Ticker: ${e.event_ticker}`);
    console.log('---');
});

// Summary by Series
const seriesCounts = {};
announcers.forEach(e => {
    const ser = e.series_ticker || 'Unknown';
    seriesCounts[ser] = (seriesCounts[ser] || 0) + 1;
});

console.log("\n=== Summary by Series ===");
Object.entries(seriesCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ser, count]) => {
        console.log(`${ser.padEnd(25)}: ${count} events`);
    });
