

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

    let scheduleStartTime = ncaaEvent && ncaaEvent?.time
        || espnEvent && espnEvent?.startTimestamp
        || market?.eventStartTime
        || null;


    if (market.mediaStreamURL && scheduleStartTime) {
        let startTime = new Date(scheduleStartTime);
        let alreadyStarted = false;
        if (startTime <= new Date()) {
            alreadyStarted = true;
            startTime = new Date(Date.now() + 3 * 1000);
            scheduleStartTime = startTime.toISOString();
        }

        delete market['keywords']['event does not qualify']
        const newFile = path.join(__dirname, 'scheduled', `${market.slug}.json`);

        if (fs.existsSync(newFile)) {
            console.log('File already exists, skipping');
            continue;
        }

        market.eventStartTime = startTime;
        fs.writeFileSync(newFile, JSON.stringify(market, null, 2));
        console.log(`Scheduled ${market.title} for ${market.eventStartTime}`);

        let cmd = `/home/nathan/kalshi/schedule_run.sh ${newFile} --duration 75`;
        if (alreadyStarted) {
            cmd += " --client-only";
        }
        execSync(cmd);
    }

}