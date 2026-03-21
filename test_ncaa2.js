const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function test() {
    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
        ]
    });
    
    try {
        const page = await browser.newPage();
        await page.goto("https://www.ncaa.com/scoreboard/basketball-men/d1/2026/03/21/all-conf", { waitUntil: "networkidle2" });
        
        const games = await page.evaluate(() => {
            const pods = document.querySelectorAll('.gamePod');
            let results = [];
            pods.forEach((pod) => {
                const teams = Array.from(pod.querySelectorAll('.gamePod-game-team-name')).map(el => el.innerText.trim());
                const status = pod.querySelector('.gamePod-game-status')?.innerText.trim();
                const network = pod.querySelector('.gamePod-game-network')?.innerText.trim();
                if (teams.length > 0) {
                    results.append({ teams, status, network });
                }
            });
            return results;
        });
        
        console.log("Found games:", games);
    } catch(err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}
test();
