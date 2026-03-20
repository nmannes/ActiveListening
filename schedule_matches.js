

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
    if (!scheduleStartTime && tvEvent && tvEvent.startTimestamp && tvEvent.endTimestamp) {
        const start = new Date(tvEvent.startTimestamp);
        const end = new Date(tvEvent.endTimestamp);
        const durationMinutes = (end - start) / (1000 * 60);
        if (durationMinutes === 150) {
            scheduleStartTime = new Date(start.getTime() + 20 * 60 * 1000).toISOString();
        } else {
            scheduleStartTime = tvEvent.startTimestamp;
        }
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
        execSync(`/home/nathan/kalshi/schedule_run.sh ${newFile} --shutdown-minutes 45`);
    }
    
    
}