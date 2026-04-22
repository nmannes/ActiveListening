const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

/**
 * Heuristic parser for Amazon time strings
 * Rule: "Live at" indicates today (April 10, 2026).
 */
function parseToEstISO(rawTime) {
    if (!rawTime || !rawTime.toLowerCase().includes("live at")) return null;

    try {
        const year = 2026;
        const month = 3; // April (0-indexed)
        const day = 10;
        let hours = 0;
        let minutes = 0;

        const clean = rawTime.toLowerCase();
        const timeMatch = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
        if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            if (timeMatch[3] === "pm" && hours < 12) hours += 12;
            if (timeMatch[3] === "am" && hours === 12) hours = 0;

            // Generate full date in local system time
            // Adjusted for the current date provided in system message
            let d = new Date(year, month, day, hours, minutes);
            return d.toISOString();
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function scrapeAmazonNBA(browser) {

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1080 });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['font', 'stylesheet'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    const searchUrl = 'https://www.amazon.com/gp/video/search?phrase=nba+on+prime';
    console.log(`Navigating to search page: ${searchUrl}...`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log("Scrolling...");
    let currentHeight = await page.evaluate('document.body.scrollHeight');
    let scrollPos = 0;
    let unchangedCount = 0;
    while (unchangedCount < 5) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        scrollPos += 1000;
        await new Promise(r => setTimeout(r, 800));
        const newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight > currentHeight) {
            currentHeight = newHeight;
            unchangedCount = 0;
        } else if (scrollPos >= currentHeight) {
            unchangedCount++;
        }
    }

    console.log("Extracting results...");
    const rawResults = await page.evaluate(() => {
        const items = [];
        const articles = document.querySelectorAll('article, li[data-testid*="card"]');

        articles.forEach(art => {
            const titleEl = art.querySelector('p[class*="title"], h2, a[aria-label]');
            const linkEl = art.querySelector('a[href*="/detail/"], a[href*="/gp/video"]');
            const timeEl = art.querySelector('p[class*="dateTime"], span[class*="dateTime"], span[class*="metadata"]');

            let title = "";
            if (titleEl) {
                title = titleEl.getAttribute('aria-label') || titleEl.textContent.trim();
            } else if (linkEl) {
                title = linkEl.getAttribute('aria-label') || linkEl.textContent.trim();
            }

            const href = linkEl ? linkEl.href : "";
            const rawTime = timeEl ? timeEl.textContent.trim() : "";

            if (title && title.length > 2 && href && !title.toLowerCase().includes("free trial") && !title.toLowerCase().includes("watch with prime") && !title.toLowerCase().includes("more details")) {
                if (!items.some(r => r.href === href)) {
                    items.push({ title, rawTime, href });
                }
            }
        });
        return items;
    });

    const finalResults = rawResults.map(item => {
        const lowerTime = item.rawTime.toLowerCase();
        let time = item.rawTime;

        // Updated rule: if "live at" is present, format it.
        if (lowerTime.includes("live at")) {
            const formatted = parseToEstISO(item.rawTime);
            if (formatted) {
                time = formatted;
            }
        }

        return {
            title: item.title,
            time: time,
            href: item.href
        };
    });

    return finalResults;
}

if (require.main === module) {
    (async () => {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        try {
            const finalResults = await scrapeAmazonNBA(browser);

            console.log(`Found ${finalResults.length} search results.`);
            const cacheDir = path.join(__dirname, "..", "cache");
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            const filePath = path.join(cacheDir, "nba_search_results.json");
            fs.writeFileSync(filePath, JSON.stringify(finalResults, null, 2));
            console.log(`Saved output to ${filePath}`);

        } catch (e) {
            console.error("Error encountered:", e);
        } finally {
            await browser.close();
        }
    })();
}

module.exports = { scrapeAmazonNBA, parseToEstISO };
