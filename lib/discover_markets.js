
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { getMarket, getEvent } = require('./api');

puppeteer.use(StealthPlugin());


async function getEventsFromMentionsHomepage() {
    let browser;
    let results;
    try {
        logger.info('Starting visual market discovery...');

        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized'
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();

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
            // This selector might need adjustment based on Kalshi's actual DOM
            // Look for common market card elements
            const cards = document.querySelectorAll('a[href^="/markets/"]');
            const results = [];
            cards.forEach(card => {
                const title = card.innerText.split('\n')[0]; // Often title is first text
                const link = card.href;
                const slug = link.split('/').pop();


                // Removed broken eventStartTime logic for now, relying on API enrichment


                if (title && link) {
                    results.push({
                        title,
                        link,
                        slug,
                        sourceUrl: 'https://www.youtube.com/watch?v=AxxVM_Vfcck',
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

        markets.slice(0, 10).forEach(m => logger.info(`- ${m.title} (${m.link})`));

        // Keep open for a bit if running manually, or return if module
        await new Promise(r => setTimeout(r, 500));
        results = markets

    } catch (error) {
        logger.error('Market discovery failed:', error);
    } finally {
        if (browser) await browser.close();
        return results
    }
}

/**
 * Enrich market data with exact event times from Kalshi API
 */
async function enrichMarketWithEventTime(market) {
    try {
        const ticker = market.slug.toUpperCase();
        let marketData;

        try {
            const response = await getEvent(ticker, true);
            marketData = response.event;
        } catch (err) {
            logger.warn(`Failed to fetch event time for ${ticker}: ${err.message}`);
            return null
        }

        if (marketData) {
            return {
                ...market,
                eventStartTime: marketData.open_time ? new Date(marketData.open_time).getTime() : market.eventStartTime,
                eventCloseTime: marketData.expiration_time ? new Date(marketData.expiration_time).getTime() : null,
                // Some events might use different properties, fallback to known ones
                eventExpiration: null,
                eventTitle: marketData.title || market.title,
                eventStatus: marketData.status
            };
        }

        return market;
    } catch (error) {
        logger.error(`Error enriching market ${market.slug}:`, error.message);
        return null;
    }
}


async function frontPageMarkets() {
    const markets = await getEventsFromMentionsHomepage();
    logger.info(`Found ${markets.length} markets with event data`);

    // Enrich markets with exact event times from API
    logger.info('Enriching markets with exact event times from Kalshi API...');
    const enrichedMarkets = [];

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        logger.info(`[${i + 1}/${markets.length}] Fetching event time for ${market.slug}`);
        const enriched = await enrichMarketWithEventTime(market);
        if (enriched) {
            enrichedMarkets.push(enriched);
        }

        // Rate limiting - wait 100ms between API calls
        if (i < markets.length - 1) {
            await new Promise(r => setTimeout(r, 100));
        }
    }

    return enrichedMarkets;
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