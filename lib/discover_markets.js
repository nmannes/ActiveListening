
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');
const { getMarket } = require('./api');

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

        // Scroll to load more content
        logger.info('Scrolling to load markets...');
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 10000) { // Limit scroll
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        logger.info('Extracting market data...');
        const markets = await page.evaluate(() => {
            // Helper function to parse date from Kalshi slug format
            // Examples: kxsecpressmention-26mar08 -> March 8, 2026
            //           kxtrumpsay-26feb23 -> February 23, 2026
            function parseSlugDate(slug) {
                // Match patterns like: 26mar08, 26feb23, 26apr01, 25oct28
                const dateMatch = slug.match(/(\d{2})([a-z]{3})(\d{2})?$/i);
                if (dateMatch) {
                    const [, year, month, day] = dateMatch;
                    const monthMap = {
                        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                    };

                    const monthNum = monthMap[month.toLowerCase()];
                    if (monthNum !== undefined) {
                        const fullYear = 2000 + parseInt(year);
                        const dayNum = day ? parseInt(day) : 1; // Default to 1st if no day

                        try {
                            const date = new Date(fullYear, monthNum, dayNum);
                            return date.getTime();
                        } catch (e) {
                            return null;
                        }
                    }
                }
                return null;
            }

            // This selector might need adjustment based on Kalshi's actual DOM
            // Look for common market card elements
            const cards = document.querySelectorAll('a[href^="/markets/"]');
            const results = [];
            cards.forEach(card => {
                const title = card.innerText.split('\n')[0]; // Often title is first text
                const link = card.href;
                const slug = link.split('/').pop();

                // Try to extract event start time from the card
                let eventStartTime = null;

                // First, try to parse from the slug
                eventStartTime = parseSlugDate(slug);

                // Look for time elements within the card
                if (!eventStartTime) {
                    const timeElement = card.querySelector('time[datetime]');
                    if (timeElement) {
                        eventStartTime = new Date(timeElement.getAttribute('datetime')).getTime();
                    }
                }

                // Look for any text that might contain a date
                if (!eventStartTime) {
                    const cardText = card.innerText;
                    // Common patterns: "Closes Mar 15", "Ends 2026-03-15", etc.
                    const dateMatch = cardText.match(/(\d{4}-\d{2}-\d{2})|(\w{3}\s+\d{1,2}(?:,\s+\d{4})?)/);
                    if (dateMatch) {
                        try {
                            eventStartTime = new Date(dateMatch[0]).getTime();
                        } catch (e) {
                            // Invalid date format, skip
                        }
                    }
                }

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
            const data = await getMarket(ticker);
            marketData = data.market;
        } catch (err) {
            logger.warn(`Failed to fetch event time for ${ticker}: ${err.message}`);
            return market;
        }

        if (marketData) {
            return {
                ...market,
                eventStartTime: marketData.close_time ? new Date(marketData.close_time).getTime() : market.eventStartTime,
                eventCloseTime: marketData.close_time ? new Date(marketData.close_time).getTime() : null,
                eventExpiration: marketData.expiration_time ? new Date(marketData.expiration_time).getTime() : null,
                eventTitle: marketData.title || market.title,
                eventStatus: marketData.status
            };
        }

        return market;
    } catch (error) {
        logger.error(`Error enriching market ${market.slug}:`, error.message);
        return market;
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
        enrichedMarkets.push(enriched);

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