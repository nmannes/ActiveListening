const fs = require('fs');
const { frontPageMarkets } = require('./lib/discover_markets.js');
const { findProgramsByZipAndKeyword } = require('./lib/tv_discovery.js');
const { getTeamNames } = require('./lib/discover_markets.js');
const { getChannelURLByBand } = require('./lib/xml.js');
const logger = require('./lib/logger');
const path = require('path');

(async () => {
    try {
        const ZIP = '20001';
        logger.info(`Starting end-to-end discovery. ZIP Code: ${ZIP}`);

        // 1. Discover Kalshi Markets
        logger.info('--- 1. Fetching Kalshi Markets ---');
        let markets = [];
        const marketsFile = path.join('cache', 'latest_markets.json');
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
        const scheduleFile = path.join('cache', 'latest_schedule.json');

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
                // Refresh channelURL in case it was null in cache
                if (!match.channelURL && match.band) {
                    match.channelURL = await getChannelURLByBand(match.band);
                }

                logger.info(`[MATCH] Found TV program for "${market.title}" -> ${match.station} (Stream URL: ${match.channelURL || 'NOT FOUND'})`);
                market['channelURL'] = match['channelURL'];
                market['station'] = match['station'];
                market['matchedProgram'] = match;
            }
        }

        const marketsWithMatches = markets.filter(m => m.matchedProgram);
        logger.info(`Discovery complete. Found matches for ${marketsWithMatches.length} out of ${markets.length} markets.`);

        const marketsWithStreams = marketsWithMatches.filter(m => m.channelURL);
        logger.info(`Of those, ${marketsWithStreams.length} have valid stream URLs.`);

        fs.writeFileSync(path.join('cache', 'final_markets_with_streams.json'), JSON.stringify(marketsWithMatches, null, 2));

        if (marketsWithStreams.length > 0) {
            logger.info('All matches:');
            marketsWithStreams.forEach(m => {
                logger.info(` - ${m.title} ${new Date(m.eventStartTime).toLocaleString()}`);

            });
        }

    } catch (e) {
        logger.error({ err: e }, 'Failed to run end-to-end discovery script: ' + e.message);
        process.exit(1);
    }
})();
