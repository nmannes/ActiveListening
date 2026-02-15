import fs from "fs";

const mentions = JSON.parse(fs.readFileSync('event_mentions.json', 'utf8'));

console.log(`Printing all ${mentions.length} mention events:\n`);

mentions.forEach((e, i) => {
    const title = e.title || 'No Title';
    const ticker = e.event_ticker || 'No Ticker';
    const category = e.category || 'N/A';
    const subTitle = e.sub_title ? ` (${e.sub_title})` : '';

    console.log(`${(i + 1).toString().padStart(3)}. [${category}] ${ticker}`);
    console.log(`     ${title}${subTitle}`);
    console.log('---');
});

console.log(`\nFinished printing ${mentions.length} events.`);
