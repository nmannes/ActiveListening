const fs = require('fs');
const { frontPageMarkets } = require('./lib/discover_markets.js');
const { findProgramsByZipAndKeyword } = require('./lib/tv_discovery.js');
const { scrapeEspnSchedule } = require('./lib/espn_discovery.js');
const logger = require('./lib/logger');
const path = require('path');
const _ = require('lodash');


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
        const cacheDir = path.join(__dirname, 'cache');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        let zip = '20001'; // Default ZIP
        try {
            logger.info('Detecting location via ipinfo.io...');
            const ipInfo = await fetch('https://ipinfo.io', { timeout: 5000 });
            if (ipInfo.ok) {
                const ipInfoJson = await ipInfo.json();
                if (ipInfoJson.postal) {
                    zip = ipInfoJson.postal;
                    logger.info(`Detected ZIP: ${zip}`);
                }
            }
        } catch (err) {
            logger.warn(`Failed to detect location, using default ZIP ${zip}: ${err.message}`);
        }

        const cacheTTL = 60 * 60 * 1000; // 1 hour
        const rawData = [
            'latest_markets.json',
            'latest_tv_schedule.json',
            'espn_next_3_days.json'
        ];
        const functionCalls = [
            () => frontPageMarkets(),
            () => findProgramsByZipAndKeyword(zip, "basketball"),
            () => scrapeEspnSchedule(new Date(), 3)
        ];


        for (let i = 0; i < functionCalls.length; i++) {
            const fileName = rawData[i];
            const filePath = path.join(cacheDir, fileName);
            const func = functionCalls[i];

            if (isFileExpired(filePath, cacheTTL)) {
                logger.info(`Fetching fresh data for ${fileName}...`);
                try {
                    const data = await func();
                    if (data) {
                        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                        logger.info(`Saved ${fileName}`);
                    } else {
                        logger.warn(`Fetched data for ${fileName} was empty, skipping write.`);
                    }
                } catch (err) {
                    logger.error(`Error fetching data for ${fileName}: ${err.message}`);
                }
            } else {
                logger.info(`Using cached data from ${fileName}`);
            }
        }

        const combinedData = _.compact(_.map(rawData, (file) => {
            const filePath = path.join(cacheDir, file);
            if (!fs.existsSync(filePath)) {
                logger.warn(`File ${file} does not exist, skipping.`);
                return null;
            }
            try {
                const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                logger.info(`${file}: ${Array.isArray(json) ? json.length : 'Object'} items`);
                return json;
            } catch (err) {
                logger.error(`Failed to parse ${file}: ${err.message}`);
                return null;
            }
        }));

        logger.info('E2E Discovery complete.');

    } catch (err) {
        logger.error(`Fatal execution error: ${err.message}`);
    }
})();
