import fs from "fs";

const mentions = JSON.parse(fs.readFileSync('event_mentions.json', 'utf8'));

const categories = {};
const series = {};

mentions.forEach(e => {
    // Count categories
    const cat = e.category || 'Unknown';
    categories[cat] = (categories[cat] || 0) + 1;

    // Count series prefixes (useful for seeing "types" of mention patterns)
    const ser = e.series_ticker ? e.series_ticker.replace(/-.*$/, '') : 'Unknown';
    series[ser] = (series[ser] || 0) + 1;
});

console.log("\n=== Breakdown by API Category ===");
Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
        console.log(`${cat.padEnd(20)}: ${count} events`);
    });

console.log("\n=== Top Mention Series (Types of Triggers) ===");
Object.entries(series)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([ser, count]) => {
        // Find a sample title for this series
        const sample = mentions.find(e => e.series_ticker && e.series_ticker.startsWith(ser))?.title || '';
        console.log(`${ser.padEnd(25)}: ${count.toString().padEnd(5)} | e.g., "${sample.substring(0, 60)}..."`);
    });

console.log(`\nTotal Mention Events Analyzed: ${mentions.length}`);
