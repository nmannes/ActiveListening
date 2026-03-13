const fs = require('fs');
const { frontPageMarkets } = require('./lib/discover_markets.js');
const { findProgramsByZipAndKeyword } = require('./lib/tv_discovery.js');
const { getTeamNames } = require('./lib/discover_markets.js');
const { getChannelURLByBand } = require('./lib/xml.js');
const logger = require('./lib/logger');
const path = require('path');


/**
 * Checks if a file exists and is not expired based on TTL.
 * @param {string} filePath - Path to the file.
 * @param {number} ttlMs - TTL in milliseconds.
 * @returns {boolean} - True if file exists and is not expired.
 */
function isFileExpired(filePath, ttlMs) {
    if (!fs.existsSync(filePath)) return true;
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.ctimeMs;
    return age > ttlMs;
}



(async () => {

    try {
        const ipInfo = await fetch('https://ipinfo.io');
        const ipInfoJson = await ipInfo.json();
        const zip = ipInfoJson.postal;
        const cacheTTL = 60 * 60 * 1000; // 1 hour
        const rawData = ['latest_markets.json', 'latest_tv_schedule.json', 'espn_next_3_days.json'];
        const functionCalls = [() => { frontPageMarkets() }, () => { findProgramsByZipAndKeyword(zip, "basketball") }, () => { scrapeEspnSchedule(new Date(), 3) }];


        for (let i = 0; i < functionCalls.length; i++) {
            const func = functionCalls[i];
            if (isFileExpired(path.join('cache', rawData[i]), cacheTTL)) {
                const data = await func();
                fs.writeFileSync(path.join('cache', rawData[i]), JSON.stringify(data, null, 2));
            } else {
                logger.info(`Using cached data from ${rawData[i]}`);
            }
        }
        // 2. Discover TV Schedules (covering today and tomorrow)
        logger.info('--- 2. Fetching TV Schedules ---');
        let scheduleData = [];
        const scheduleFile = path.join('cache', 'latest_schedule.json');

        if (!isFileExpired(scheduleFile, cacheTTL)) {
            const stats = fs.statSync(scheduleFile);
            const age = Date.now() - stats.ctimeMs;
            logger.info(`Using cached schedule from ${scheduleFile} (age: ${Math.round(age / 1000 / 60)} mins)`);
            scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
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
