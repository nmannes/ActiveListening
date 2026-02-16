
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { getMarket, getEvent } = require('./api');

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
        console.log(a);

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
            const a = {
                ...market,
                live: await isMarketLive(browser, market.link),
            };
            console.log(a)
            return a
        }
        return null;

    } catch (err) {
        logger.warn(`Failed to fetch event time for ${ticker}: ${err.message}`);
        return null
    }
}


async function isMarketLive(browser, url) {
    let page;
    try {
        page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Simple heuristic: check for "Yes" / "No" buttons which imply trading is active
        // Or check for "Market Closed" text

        // This selector is a guess based on typical binary market interfaces
        // Looking for buy/sell buttons or options
        const hasTradingButtons = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (let btn of buttons) {
                if (btn.innerText.includes('Yes') || btn.innerText.includes('No') || btn.innerText.includes('Buy')) {
                    if (!btn.disabled) return true;
                }
            }
            return false;
        });

        const isClosed = await page.evaluate(() => {
            return document.body.innerText.includes('Market Closed') || document.body.innerText.includes('Event Ended');
        });

        return hasTradingButtons && !isClosed;
    } catch (err) {
        logger.warn(`Error checking market liveness for ${url}: ${err.message}`);
        return false;
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
    frontPageMarkets().then(markets => {
        console.log(markets);
    }).catch(err => {
        logger.error('Failed to run market discovery:', err);
        process.exit(1);
    });
}