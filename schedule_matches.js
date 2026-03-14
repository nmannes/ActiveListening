

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');



execSync('mkdir -p scheduled');

const file = path.join('cache', 'matched_markets.json');

if (fs.existsSync(file)) {
    console.log('File exists');
}

for (const match of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const {market, tvEvent, espnEvent} = match;

    market['mediaStreamURL'] = tvEvent && tvEvent?.mediaStreamURL || espnEvent && espnEvent?.link || null;
    market['eventStartTime'] = tvEvent && tvEvent?.startTimestamp || espnEvent && espnEvent?.startTimestamp || null;

    if (market.eventStartTime && new Date(market.eventStartTime) > new Date()) {
        
        delete market['keywords']['event does not qualify'] 
        const newFile = path.join(__dirname, 'scheduled', `${market.slug}.json`);
        console.log(newFile)

        if (fs.existsSync(newFile)) {
            console.log('File already exists, skipping');
            continue;
        }

        fs.writeFileSync(newFile, JSON.stringify(market, null, 2));
        console.log(`Scheduled ${market.title} for ${market.eventStartTime}`);
        execSync(`/home/nathan/kalshi/schedule_run.sh ${newFile} --shutdown-minutes 45`);
    }
    
    
}