const fs = require('fs');
const { getStationScheduleByZip } = require('./lib/tv_discovery.js');

(async () => {
    try {
        const now = new Date();
        // Set to tomorrow at midnight
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        const end = start + 24 * 60 * 60 * 1000;

        console.log(`Fetching schedule for 20001 for tomorrow...`);
        console.log(`Start TS: ${start} (${new Date(start).toLocaleString()})`);
        console.log(`End TS: ${end} (${new Date(end).toLocaleString()})`);

        const s = await getStationScheduleByZip('20001', start, end);
        const filePath = 'schedule_tomorrow.json';
        fs.writeFileSync(filePath, JSON.stringify(s, null, 2));
        console.log(`Saved schedule to ${filePath}`);
    } catch (e) {
        console.error('Error:', e);
    }
})();
