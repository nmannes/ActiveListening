const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

/**
 * Scrapes tip-off time schedule metadata from NCAA scoreboard.
 * @param {string} dateString - e.g., '2026/03/21'
 * @returns {Array} - Array of game objects containing teams, time, and network.
 */
async function scrapeNCAASchedule(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}/${month}/${day}`;
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome",
            headless: true,
            args: [
                "--user-data-dir=/home/nathan/.config/google-chrome/Default",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--start-maximized"
            ],
            defaultViewport: null,
        });

        const page = await browser.newPage();
        const url = `https://www.ncaa.com/scoreboard/basketball-men/d1/${dateString}/all-conf`;
        console.log(`Navigating to ${url}...`);

        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Wait for games container to load
        await page.waitForSelector('.gamePod', { timeout: 15000 }).catch(() => console.log("No game pods found or timeout"));

        const rawGames = await page.evaluate(() => {
            const pods = document.querySelectorAll('.gamePod');
            let results = [];

            pods.forEach((pod) => {
                const teamNodes = pod.querySelectorAll('li .gamePod-game-team-name:not(.short)');
                const teams = Array.from(teamNodes).map(el => el.innerText.trim());
                if (teams.length >= 2) {
                    const statusText = pod.querySelector('.gamePod-status')?.innerText.trim() || "";
                    const clock = pod.querySelector('.game-clock')?.innerText.trim() || "";
                    const gameTime = pod.querySelector('.game-time')?.innerText.trim() || "";
                    const network = pod.querySelector('.game-network')?.innerText.trim() || "";

                    let finalTime = gameTime;
                    if (statusText || clock) {
                        finalTime = `${statusText} ${clock}`.trim() || gameTime;
                    }

                    results.push({
                        awayTeam: teams[0],
                        homeTeam: teams[1],
                        time: finalTime,
                        network: network
                    });
                }
            });
            return results;
        });

        const games = rawGames.map(game => {
            let parsedDate = null;
            let estString = null;

            if (game.time.includes("PM") || game.time.includes("AM")) {
                parsedDate = new Date(`${dateString} ${game.time}`);
                if (isNaN(parsedDate)) parsedDate = null;
            } else if (game.time.toLowerCase().includes("live") || game.time.toLowerCase().includes("halftime")) {
                parsedDate = new Date();
            }

            if (parsedDate) {
                const tzStr = "-04:00"; // March Madness falls in EDT
                estString = parsedDate.toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T") + ".000" + tzStr;
            }

            return {
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                timeString: game.time,
                time: estString,
                network: game.network
            };
        });

        console.log(`Found ${games.length} games on the NCAA scoreboard.`);
        return games;

    } catch (err) {
        console.error("Error scraping NCAA schedule:", err);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrapeNCAASchedule };

if (require.main === module) {
    (async () => {
        const games = await scrapeNCAASchedule("2026/03/21");
        console.log(JSON.stringify(games, null, 2));
    })();
}