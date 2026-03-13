

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


const file = path.join('cache', 'matched_markets.json');

if (fs.existsSync(file)) {
    console.log('File exists');
}

for (const match of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    const {market, tvEvent, espnEvent} = match;

    if (market.eventStartTime && new Date(market.eventStartTime) > new Date()) {
        market['mediaStreamURL'] = tvEvent && tvEvent?.mediaStreamURL || espnEvent && espnEvent?.link || null;
        delete market['keywords']['event does not qualify'] 
        const newFile = path.join(__dirname, 'scheduled', `${market.slug}.json`);
        console.log(newFile)

        if (fs.existsSync(newFile)) {
            console.log('File already exists, skipping');
            continue;
        }

        fs.writeFileSync(newFile, JSON.stringify(market, null, 2));
        execSync(`./schedule_run.sh --fromFile ${newFile}`);
    }
    
    
}