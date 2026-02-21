const fs = require('fs');
const { frontPageMarkets } = require('./lib/discover_markets.js');
const { getStationScheduleByZip } = require('./lib/tv_discovery.js');
const { matchMarkets } = require('./match_markets.js');
const logger = require('./lib/logger');

(async () => {
    try {
        const ZIP = '20001';
        logger.info(`Starting end-to-end discovery. ZIP Code: ${ZIP}`);

        // 1. Discover Kalshi Markets
        logger.info('--- 1. Fetching Kalshi Markets ---');
        const markets = await frontPageMarkets();
        if (!markets || markets.length === 0) {
            logger.warn('No markets found or failed to fetch markets. Aborting.');
            process.exit(1);
        }
        logger.info(`Fetched ${markets.length} Kalshi markets.`);
        fs.writeFileSync('latest_markets.json', JSON.stringify(markets, null, 2));

        // 2. Discover TV Schedules (covering today and tomorrow)
        logger.info('--- 2. Fetching TV Schedules ---');
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        // Look 48 hours into the future to ensure we catch everything
        const end = start + 48 * 60 * 60 * 1000;

        logger.info(`Fetching schedule for ${ZIP} from ${new Date(start).toLocaleString()} to ${new Date(end).toLocaleString()}`);
        const scheduleData = await getStationScheduleByZip(ZIP, start, end);

        if (!scheduleData || scheduleData.length === 0) {
            logger.warn('No schedule found or failed to fetch schedule. Aborting.');
            process.exit(1);
        }
        logger.info(`Fetched schedule for ${scheduleData.length} stations.`);
        fs.writeFileSync('latest_schedule.json', JSON.stringify(scheduleData, null, 2));

        // 3. Match
        logger.info('--- 3. Matching Markets to TV Schedule ---');
        const matches = matchMarkets(markets, scheduleData);

        fs.writeFileSync('latest_matches.json', JSON.stringify(matches, null, 2));

        logger.info(`=== DISCOVERY COMPLETE ===`);
        logger.info(`Found ${matches.length} matching events! Results saved to latest_matches.json`);

        matches.forEach((m, idx) => {
            console.log(`\nMatch #${idx + 1}:`);
            console.log(`  Kalshi Market: ${m.market.title} (${m.market.eventStartTime})`);
            console.log(`  TV Program:    [${m.tv_program.stationCallSign}] ${m.tv_program.title} - ${m.tv_program.subTitle}`);
            console.log(`  TV Air Time:   ${new Date(m.tv_program.startDateTime).toLocaleString()}`);
        });

    } catch (e) {
        logger.error('Failed to run end-to-end discovery script:', e);
        process.exit(1);
    }
})();
