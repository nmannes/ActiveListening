const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const { execSync } = require('child_process');

puppeteer.use(StealthPlugin());

/**
 * Discovers TV stations for a given location using RabbitEars.info.
 * @param {Object} [location] - The location to search for. If omitted, uses ipinfo.io.
 * @param {string} [location.zip] - Zip code.
 * @param {number} [location.lat] - Latitude.
 * @param {number} [location.lon] - Longitude.
 * @returns {Promise<Array>} - A list of discovered stations.
 */
async function discoverStations(location = {}) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });

    const page = await browser.newPage();

    try {
        // Handle auto-location if no specific location is provided
        if (!location.zip && (!location.lat || !location.lon)) {
            logger.info('No location provided. Fetching location from ipinfo.io...');
            try {
                const ipInfoRaw = execSync('curl -s ipinfo.io').toString();
                const ipInfo = JSON.parse(ipInfoRaw);
                const [lat, lon] = ipInfo.loc.split(',');
                location.lat = lat;
                location.lon = lon;
                logger.info(`Auto-detected location: ${lat}, ${lon} (${ipInfo.city}, ${ipInfo.region})`);
            } catch (err) {
                throw new Error(`Failed to auto-detect location: ${err.message}`);
            }
        }

        logger.info('Navigating to RabbitEars Search Map...');
        await page.goto('https://www.rabbitears.info/searchmap.php', { waitUntil: 'networkidle2' });

        if (location.zip) {
            logger.info(`Searching by ZIP code: ${location.zip}`);
            await page.waitForSelector('input[placeholder="Enter location"]');
            await page.type('input[placeholder="Enter location"]', location.zip + ', USA');

            // Click the geocoder search button
            await page.click('.leaflet-control-geocoder-form input[type="submit"]');

            // Wait for map to center
            await new Promise(r => setTimeout(r, 4000));

            // Click the "Move Pushpin to Center of Map View" button to update lat/lon fields
            logger.info('Updating pushpin coordinates...');
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const moveBtn = buttons.find(b => b.innerText.includes('Move Pushpin'));
                if (moveBtn) moveBtn.click();
            });

            await new Promise(r => setTimeout(r, 1000));

            const coords = await page.evaluate(() => {
                return {
                    lat: document.querySelector('input#latitude').value,
                    lon: document.querySelector('input#longitude').value
                };
            });
            logger.info(`Geosearch resolved to: ${coords.lat}, ${coords.lon}`);
        } else if (location.lat && location.lon) {
            logger.info(`Searching by coordinates: ${location.lat}, ${location.lon}`);
            await page.waitForSelector('input#latitude');
            await page.$eval('input#latitude', (el, val) => el.value = val, location.lat);
            await page.$eval('input#longitude', (el, val) => el.value = val, location.lon);
        } else {
            throw new Error('Either ZIP or Lat/Lon must be provided');
        }

        logger.info('Submitting search...');
        await page.click('input[type="submit"][value="Go"]');

        logger.info('Waiting for results...');
        await page.waitForSelector('table.sortable', { timeout: 30000 });

        const stations = await page.evaluate(() => {
            const results = [];
            const table = document.querySelector('table.sortable');
            if (!table) return [];
            const rows = table.querySelectorAll('tbody tr');

            for (let row of rows) {
                const cols = row.querySelectorAll('td');
                if (cols.length < 10) continue;

                const channelText = cols[0].innerText.replace(/\s+/g, ' ').trim();
                const callsignEl = cols[1].querySelector('a') || cols[1];
                const callsign = callsignEl.innerText.trim();
                const network = cols[2].innerText.trim().split('\n')[0];
                const strength = cols[9].innerText.trim();

                if (!callsign) continue;

                let virtualChan = '';
                let physicalChan = '';
                const chanMatch = channelText.match(/(\d+(?:\.\d+)?)(?:[-–—‑](\d+))?\s*\((\d+)\)/);

                if (chanMatch) {
                    virtualChan = chanMatch[1] + (chanMatch[2] ? '-' + chanMatch[2] : '');
                    physicalChan = chanMatch[3];
                } else {
                    const parts = channelText.split('(');
                    virtualChan = parts[0].trim().replace(/\s+/g, '-');
                    physicalChan = parts[1] ? parts[1].replace(')', '').trim() : '';
                }

                results.push({
                    virtualChannel: virtualChan,
                    physicalChannel: physicalChan,
                    callsign: callsign,
                    network: network,
                    signalStrength: strength,
                    rawChannel: channelText
                });
            }
            return results;
        });

        logger.info(`Found ${stations.length} stations.`);
        return stations;

    } catch (error) {
        logger.error(`Error discovering stations: ${error.message}`);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = {
    discoverStations
};
