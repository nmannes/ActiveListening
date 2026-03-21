const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function run() {
    let browser;
    try {
        browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome" });
        const page = await browser.newPage();
        await page.goto("https://www.ncaa.com/scoreboard/basketball-men/d1/2026/03/21/all-conf", { waitUntil: "networkidle2" });
        const data = await page.evaluate(() => {
            const pods = Array.from(document.querySelectorAll('.gamePod'));
            const htmls = pods.map((p, i) => `${i}: ${p.innerHTML}`);
            return htmls.join("\n\n---\n\n");
        });
        console.log(data);
    } catch(e) {
        console.error(e);
    } finally {
        if(browser) await browser.close();
    }
}
run();
