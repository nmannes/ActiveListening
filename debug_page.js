const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://kalshi.com/markets/kxsecpressmention/sec-press-mentions/kxsecpressmention-26mar08', { timeout: 30000 });

    // Wait a bit for page to load
    await new Promise(r => setTimeout(r, 3000));

    const data = await page.evaluate(() => {
        // Find all time elements
        const timeElements = Array.from(document.querySelectorAll('time'));
        const times = timeElements.map(t => ({
            datetime: t.getAttribute('datetime'),
            text: t.textContent,
            html: t.outerHTML
        }));

        // Find text containing "close" or "expire"
        const bodyText = document.body.innerText;
        const closeMatches = bodyText.match(/close[sd]?.*?\d{1,2}:\d{2}/gi) || [];
        const expireMatches = bodyText.match(/expire[sd]?.*?\d{1,2}:\d{2}/gi) || [];

        return {
            timeElements: times,
            closeMatches,
            expireMatches,
            allText: bodyText.substring(0, 2000)
        };
    });

    console.log(JSON.stringify(data, null, 2));

    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
})();
