
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { getEvent } = require('./api');
const _ = require('lodash')

puppeteer.use(StealthPlugin());

require('./args');

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

        const url = process.env.KALSHI_ENV === 'prod' ?
            'https://kalshi.com/category/mentions' :
            'https://demo.kalshi.co/category/mentions';

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

        logger.debug(`title: ${event.title}: ${event.markets.length}`)

        if (event) {
            const scrapedStartTime = await getMarketStartTime(browser, market.link);
            logger.debug(`scrapedStartTime: ${scrapedStartTime}`);

            let keywords = {};

            try {
                _.forEach(event.markets, m => {
                    const splitted = m.custom_strike.Word.split('/')
                    splitted.forEach(word => {
                        const w = word.trim().toLowerCase()
                        keywords[w] = m.ticker;
                    });
                });
            } catch (err) {
                logger.warn(`Failed to extract keywords for ${ticker}: ${err.message}. Probably this is a 1 word event so we are gonna ignore it`);
                keywords = [];
            }

            return {
                ...market,
                eventStartTimeTS: scrapedStartTime,
                eventStartTime: scrapedStartTime ? new Date(scrapedStartTime).toLocaleString() : null,
                mediaStreamURL: await getMediaStreamURL(browser, market.link),
                keywords
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

        // Forward logs from browser to node console

        // Use networkidle2 to ensure dynamic content load
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const result = await page.evaluate(() => {
            const nodes = document.querySelectorAll('span');
            const spans = Array.from(nodes).map(n => n.innerText);

            // Pattern: MMM D, H:mm(am|pm) Z
            const dateRegex = /([A-Z][a-z]{2}\s\d{1,2},\s\d{1,2}:\d{2}[ap]m\s[A-Z]{3})/;

            for (const text of spans) {
                const match = text.match(dateRegex);

                if (match) {
                    return match[0]; // e.g., "Feb 18, 5:00pm EST"
                }
            }
            return null;
        });

        logger.debug(`Scraped start time string: ${url}: ${result}`);

        if (result) {
            const currentYear = new Date().getFullYear();
            // result e.g., "Feb 18, 5:00pm EST"

            // Split by comma: "Feb 18", " 5:00pm EST"
            const parts = result.split(',');
            if (parts.length === 2) {
                const datePart = parts[0].trim(); // "Feb 18"
                let timePart = parts[1].trim(); // "5:00pm EST"

                // Fix: insert space before am/pm if missing
                // "5:00pm" -> "5:00 pm"
                timePart = timePart.replace(/(\d)(am|pm)/i, '$1 $2');

                // Construct string like "Feb 18 2026, 5:00 pm EST"
                const fullDateStr = `${datePart} ${currentYear}, ${timePart}`;

                const timestamp = new Date(fullDateStr).getTime();
                if (!isNaN(timestamp)) {
                    return timestamp;
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

async function getMediaStreamURL(browser, url) {
    return "https://www.youtube.com/watch?v=OfczGzr4zmA"
}

async function frontPageMarkets() {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome',
            headless: true, // Use headless for performance unless debugging visually
            args: [
                '--user-data-dir=/home/nathan/.config/google-chrome/Default',
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
            fs.writeFileSync(`${process.env.KALSHI_ENV}_markets_with_event_times.json`, JSON.stringify(markets, null, 2));
        } catch (err) {
            logger.error('Failed to run market discovery:', err);
            process.exit(1);
        }
    })();
}