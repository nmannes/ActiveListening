

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');



execSync('mkdir -p scheduled');

const file = path.join('cache', 'matched_markets.json');

if (fs.existsSync(file)) {
    console.log('File exists');
}

for (const match of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const { market, tvEvent, espnEvent, ncaaEvent } = match;

    market['mediaStreamURL'] = tvEvent && tvEvent?.channelURL
        || espnEvent && espnEvent?.link
        || null;

    const scheduleStartTime = ncaaEvent && ncaaEvent?.time
        || espnEvent && espnEvent?.startTimestamp
        || market?.eventStartTime
        || null;


    if (market.mediaStreamURL && scheduleStartTime && new Date(scheduleStartTime) > new Date()) {

        delete market['keywords']['event does not qualify']
        const newFile = path.join(__dirname, 'scheduled', `${market.slug}.json`);

        if (fs.existsSync(newFile)) {
            console.log('File already exists, skipping');
            continue;
        }

        market.eventStartTime = scheduleStartTime;
        fs.writeFileSync(newFile, JSON.stringify(market, null, 2));
        console.log(`Scheduled ${market.title} for ${market.eventStartTime}`);
        execSync(`/home/nathan/kalshi/schedule_run.sh ${newFile} --duration 75`);
    }

}