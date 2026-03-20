

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

    market['mediaStreamURL'] = tvEvent && tvEvent?.channelURL || espnEvent && espnEvent?.link || null;
    market['eventStartTime'] = tvEvent && tvEvent?.startTimestamp || espnEvent && espnEvent?.startTimestamp || null;


    let scheduleStartTime = market.eventStartTime
    if (tvEvent && tvEvent.startTimestamp && tvEvent.title ==="2026 NCAA BASKETBALL TOURNAMENT"){
        scheduleStartTime = new Date(new Date(tvEvent.startTimestamp).getTime() + 20 * 60 * 1000).toISOString();
    }

    if (scheduleStartTime && new Date(scheduleStartTime) > new Date()) {
        
        delete market['keywords']['event does not qualify'] 
        const newFile = path.join(__dirname, 'scheduled', `${market.slug}.json`);
        
        if (fs.existsSync(newFile)) {
            console.log('File already exists, skipping');
            continue;
        }

        market.eventStartTime = scheduleStartTime;
        fs.writeFileSync(newFile, JSON.stringify(market, null, 2));
        console.log(`Scheduled ${market.title} for ${market.eventStartTime}`);
        execSync(`/home/nathan/kalshi/schedule_run.sh ${newFile} --shutdown-minutes 75`);
    }
    
    
}