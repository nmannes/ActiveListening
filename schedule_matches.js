

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');



execSync('mkdir -p scheduled');

const args = process.argv.slice(2);
let lookaheadHours = 20;
const lookaheadIdx = args.indexOf('--lookahead');
if (lookaheadIdx !== -1 && args[lookaheadIdx + 1]) {
    lookaheadHours = parseFloat(args[lookaheadIdx + 1]);
}
const lookaheadMs = lookaheadHours * 60 * 60 * 1000;

const file = path.join('cache', 'matched_markets.json');

if (fs.existsSync(file)) {
    console.log('File exists');
}

const now = new Date();
const lookaheadLimit = new Date(now.getTime() + lookaheadMs);

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
        if (startTime <= now) {
            alreadyStarted = true;
            startTime = new Date(Date.now() + 3 * 1000);
            scheduleStartTime = startTime.toISOString();
        }

        if (startTime > lookaheadLimit) {
            console.log(`Skipping ${market.title} - starts in more than ${lookaheadHours} hours (${startTime.toLocaleString()})`);
            continue;
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

        console.debug(`${JSON.stringify(market, null, 2)}`);

        let cmd = `/home/nathan/kalshi/schedule_run.sh ${newFile} --duration 75`;
        if (alreadyStarted) {
            cmd += " --client-only";
        }
        execSync(cmd);
    }

}