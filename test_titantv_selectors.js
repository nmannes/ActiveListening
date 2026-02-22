const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    try {
        console.log("Navigating to TitanTV...");
        await page.goto('https://www.titantv.com/', { waitUntil: 'networkidle2' });

        // Wait for search box
        console.log("Waiting for search box...");
        await page.waitForSelector('input[type="text"]', { timeout: 10000 });
        const searchInput = await page.$('input[type="text"]');
        await searchInput.type('basketball');
        await searchInput.press('Enter');

        console.log("Searching...");
        await new Promise(r => setTimeout(r, 5000));

        // Get DOM outline of body to see what happened
        const bodyContent = await page.evaluate(() => {
            return document.body.innerText.substring(0, 1000);
        });
        console.log("Body text snippet:", bodyContent);

        const selectors = [
            '.search-result',
            'div[id^="listing-"]',
            'a.program-link',
            '.program-title',
            '.channel-callsign',
            '.channel-number',
            '.time-range',
            '.air-time'
        ];

        for (const selector of selectors) {
            const exists = await page.$(selector) !== null;
            console.log(`Selector "${selector}" exists: ${exists}`);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
})();
