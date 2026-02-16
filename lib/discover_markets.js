
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { getEvent } = require('./api');
const _ = require('lodash')

puppeteer.use(StealthPlugin());


async function getEventsFromMentionsHomepage(browser) {
    let page;
    try {
        logger.info('Starting visual market discovery...')
        page = await browser.newPage();

        // Forward logs
        page.on('console', msg => {
            const type = msg.type();
            /* if (type === 'error') logger.error(`[Browser] ${msg.text()}`); */
        });

        const url = 'https://kalshi.com/category/mentions';
        logger.info(`Navigating to ${url}...`);

        await page.goto(url, { timeout: 60000 });

        const a = await page.waitForSelector('a[href^="/markets/"]')

        logger.info('Extracting market data...');
        const markets = await page.evaluate(() => {
            const cards = document.querySelectorAll('a[href^="/markets/"]');
            const uniqueSlugs = new Set();
            const results = [];

            cards.forEach(card => {
                const link = card.href;
                const slug = link.split('/').pop();

                if (link && !uniqueSlugs.has(slug)) {
                    uniqueSlugs.add(slug);
                    results.push({
                        link,
                        slug
                    });
                }
            });
            return results;
        });

        logger.info(`Discovered ${markets.length} potential markets.`);

        // Export to JSON
        const outputPath = path.join(__dirname, 'scraped_events.json');
        fs.writeFileSync(outputPath, JSON.stringify(markets, null, 2));
        logger.info(`Exported markets to ${outputPath}`);

        // Keep open for a bit if running manually, or return if module
        await new Promise(r => setTimeout(r, 500));
        return markets;
    } catch (error) {
        logger.error('Market discovery failed:', error);
        return null
    } finally {
        if (page) await page.close();
    }
}

/**
 * Enrich market data with exact event times from Kalshi API
 */
async function getEventMetadata(browser, market) {
    const ticker = market.slug.toUpperCase();

    try {
        const { event } = await getEvent(ticker, true);

        // logger.debug(`title: ${event.title}: ${event.markets.length}`)

        if (event) {
            const scrapedStartTime = await getMarketStartTime(browser, market.link);
            const firstMarket = event.markets.length > 0 ? event.markets[0] : null;


            return {
                ...market,
                eventStartTimeTS: scrapedStartTime || (firstMarket ? new Date(firstMarket.open_time).getTime() : null),
                eventStartTime: new Date(scrapedStartTime || (firstMarket ? new Date(firstMarket.open_time).getTime() : null)).toISOString(),
                keywords: _.map(event.markets.flatMap(m => m.custom_strike.Word.split('/')), w => w.trim())
            };
        }
        return null;

    } catch (err) {
        logger.warn(`Failed to fetch event time for ${ticker}: ${err.message}`);
        return null
    }
}


async function getMarketStartTime(browser, url) {
    let page;
    try {
        page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Look for text like "Begins in 20h 36m 44s \n Feb 16, 7:00pm EST"
        // or "Starts at..."
        const timeString = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*'));
            const target = elements.find(el =>
                el.innerText &&
                (el.innerText.includes('Begins on') || el.innerText.includes('Starts at')) &&
                (el.innerText.includes('AM') || el.innerText.includes('PM'))
            );

            if (target) {
                // Return the full text to be parsed node-side
                return target.innerText;
            }
            return null;
        });

        if (timeString) {
            // Check for date pattern: MMM D, H:mm(am|pm) Z
            // Example: Feb 16, 7:00pm EST
            const dateMatch = timeString.match(/([A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}[ap]m [A-Z]{3})/);
            if (dateMatch) {
                const dateStr = dateMatch[1];
                const currentYear = new Date().getFullYear();
                const fullDateStr = `${dateStr.slice(0, 6)} ${currentYear},${dateStr.slice(6)}`; // Insert year: Feb 16 2026, 7:00pm EST
                // Actually parsing "Feb 16, 7:00pm EST" with year
                // Let's try appending year at the end or begin?
                // "Feb 16, 7:00pm EST" -> "Feb 16, 2026 7:00pm EST"
                const parts = dateStr.split(',');
                if (parts.length === 2) {
                    const finalStr = `${parts[0]} ${currentYear},${parts[1]}`; // Feb 16 2026, 7:00pm EST
                    return new Date(finalStr).getTime();
                }
            }
        }

        return null;
    } catch (err) {
        logger.warn(`Error extracting start time for ${url}: ${err.message}`);
        return null;
    } finally {
        if (page) await page.close();
    }
}

async function frontPageMarkets() {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            headless: true, // Use headless for performance unless debugging visually
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized'
            ],
            defaultViewport: null
        });

        const markets = await getEventsFromMentionsHomepage(browser);
        logger.info(`Found ${markets.length} markets with event data`);

        const enrichedMarkets = [];

        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];

            // Check liveness
            // logger.info(`Checking liveness for ${market.slug}...`);
            // const isLive = await isMarketLive(browser, market.link);
            // if (!isLive) {
            //     logger.info(`Skipping closed/inactive market: ${market.slug}`);
            //     continue;
            // }

            // logger.debug(`[${i + 1}/${markets.length}] Fetching event metadata for ${market.slug}`);
            const enriched = await getEventMetadata(browser, market);
            if (enriched) {
                logger.debug(`Enriched market: ${JSON.stringify(enriched, null, 2)}`)
                enrichedMarkets.push(enriched);
            }

            // Rate limiting - wait 100ms between API calls
            if (i < markets.length - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        return enrichedMarkets;
    } catch (err) {
        logger.error('Error in frontPageMarkets:', err);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = {
    frontPageMarkets
};

if (require.main === module) {
    (async () => {
        try {
            const markets = await frontPageMarkets();
            console.log(markets);
        } catch (err) {
            logger.error('Failed to run market discovery:', err);
            process.exit(1);
        }
    })();
}