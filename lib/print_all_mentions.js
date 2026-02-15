import fs from "fs";

const mentions = JSON.parse(fs.readFileSync('event_mentions.json', 'utf8'));

process.stdout.write(`Printing all ${mentions.length} mention events:\n\n`);

mentions.forEach((e, i) => {
    const title = e.title || 'No Title';
    const ticker = e.event_ticker || 'No Ticker';
    const category = e.category || 'N/A';
    const subTitle = e.sub_title ? ` (${e.sub_title})` : '';

    process.stdout.write(`${(i + 1).toString().padStart(3)}. [${category}] ${ticker}\n`);
    process.stdout.write(`     ${title}${subTitle}\n`);
    process.stdout.write('---\n');
});

process.stdout.write(`\nFinished printing ${mentions.length} events.\n`);
