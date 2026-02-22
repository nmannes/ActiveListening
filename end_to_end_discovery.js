const fs = require('fs');
const { frontPageMarkets } = require('./lib/discover_markets.js');
const { findProgramsByZipAndKeyword } = require('./lib/tv_discovery.js');
const { getTeamNames } = require('./lib/discover_markets.js');
const logger = require('./lib/logger');

(async () => {
    try {
        const ZIP = '20001';
        logger.info(`Starting end-to-end discovery. ZIP Code: ${ZIP}`);

        // 1. Discover Kalshi Markets
        logger.info('--- 1. Fetching Kalshi Markets ---');
        let markets = [];
        const marketsFile = 'latest_markets.json';
        const cacheTTL = 60 * 60 * 1000; // 1 hour

        if (fs.existsSync(marketsFile)) {
            const stats = fs.statSync(marketsFile);
            const age = Date.now() - stats.ctimeMs;
            if (age < cacheTTL) {
                logger.info(`Using cached markets from ${marketsFile} (age: ${Math.round(age / 1000 / 60)} mins)`);
                markets = JSON.parse(fs.readFileSync(marketsFile, 'utf8'));
            }
        }

        if (markets.length === 0) {
            markets = await frontPageMarkets();
            if (!markets || markets.length === 0) {
                logger.warn('No markets found or failed to fetch markets. Aborting.');
                process.exit(1);
            }
            logger.info(`Fetched ${markets.length} Kalshi markets.`);
            fs.writeFileSync(marketsFile, JSON.stringify(markets, null, 2));
        }

        // 2. Discover TV Schedules (covering today and tomorrow)
        logger.info('--- 2. Fetching TV Schedules ---');
        let scheduleData = [];
        const scheduleFile = 'latest_schedule.json';

        if (fs.existsSync(scheduleFile)) {
            const stats = fs.statSync(scheduleFile);
            const age = Date.now() - stats.ctimeMs;
            if (age < cacheTTL) {
                logger.info(`Using cached schedule from ${scheduleFile} (age: ${Math.round(age / 1000 / 60)} mins)`);
                scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
            }
        }

        if (scheduleData.length === 0) {
            logger.info(`Fetching fresh schedule for ${ZIP}`);
            scheduleData = await findProgramsByZipAndKeyword(ZIP, "basketball");

            if (!scheduleData || scheduleData.length === 0) {
                logger.warn('No schedule found or failed to fetch schedule. Aborting.');
                process.exit(1);
            }
            logger.info(`Fetched schedule for ${scheduleData.length} stations.`);
            fs.writeFileSync(scheduleFile, JSON.stringify(scheduleData, null, 2));
        }

        // 3. Match
        logger.info('--- 3. Matching Markets to TV Schedule ---');
        for (const market of markets) {
            const teams = getTeamNames(market.title);
            if (teams.length !== 2) continue;

            const [team1, team2] = teams;

            // Simple match: check if both team names appear in the program title or description
            const match = scheduleData.find(p => {
                const searchArea = `${p.title} ${p.description || ''}`.toLowerCase();
                return searchArea.includes(team1) && searchArea.includes(team2);
            });

            if (match) {
                logger.info(`[MATCH] Found TV stream for "${market.title}" -> ${match.station} (${match.channelURL})`);
                market['channelURL'] = match['channelURL'];
            }
        }

        const marketsWithStreams = markets.filter(m => m.channelURL);
        logger.info(`Discovery complete. Found streams for ${marketsWithStreams.length} out of ${markets.length} markets.`);

        fs.writeFileSync('final_markets_with_streams.json', JSON.stringify(markets, null, 2));

        if (marketsWithStreams.length > 0) {
            logger.info('Sample matches:');
            marketsWithStreams.slice(0, 5).forEach(m => {
                logger.info(` - ${m.title} -> ${m.channelURL}`);
            });
        }

    } catch (e) {
        logger.error({ err: e }, 'Failed to run end-to-end discovery script: ' + e.message);
        process.exit(1);
    }
})();
