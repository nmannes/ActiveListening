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
        const scheduleData = await findProgramsByZipAndKeyword(ZIP, "basketball");

        if (!scheduleData || scheduleData.length === 0) {
            logger.warn('No schedule found or failed to fetch schedule. Aborting.');
            process.exit(1);
        }
        logger.info(`Fetched schedule for ${scheduleData.length} stations.`);
        fs.writeFileSync('latest_schedule.json', JSON.stringify(scheduleData, null, 2));

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
                market.mediaStreamURL = match.channelURL;
            }
        }

        const marketsWithStreams = markets.filter(m => m.mediaStreamURL);
        logger.info(`Discovery complete. Found streams for ${marketsWithStreams.length} out of ${markets.length} markets.`);

        fs.writeFileSync('final_markets_with_streams.json', JSON.stringify(markets, null, 2));

        if (marketsWithStreams.length > 0) {
            logger.info('Sample matches:');
            marketsWithStreams.slice(0, 5).forEach(m => {
                logger.info(` - ${m.title} -> ${m.mediaStreamURL}`);
            });
        }

    } catch (e) {
        logger.error('Failed to run end-to-end discovery script:', e);
        process.exit(1);
    }
})();
