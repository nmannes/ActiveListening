const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function scrapeESPNMatchups() {
    const leagues = ['mlb', 'nba', 'nhl'];
    const games = [];
    for (const league of leagues) {
        games.push(await scrapeESPNForLeague(league));
    }
    return games.flat();
}

/**
 * Scrapes schedule metadata from ESPN for a specific league.
 * @param {string} league - 'mlb', 'nba', 'nhl', etc.
 * @returns {Array} - Array of game objects.
 */
async function scrapeESPNForLeague(league) {
    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome",
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
            defaultViewport: null,
        });

        const page = await browser.newPage();
        const url = `https://www.espn.com/${league}/schedule`;
        console.log(`Navigating to ${url}...`);

        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        const games = await page.evaluate(() => {
            const results = [];
            const containers = document.querySelectorAll(".ScheduleTables");

            containers.forEach(container => {
                const dateHeader = container.querySelector(".Table__Title");
                const dateStr = dateHeader ? dateHeader.textContent.trim() : "";

                const rows = container.querySelectorAll("tr.Table__TR:not(.Table__sub-header)");
                rows.forEach(row => {
                    const awayCell = row.querySelector("td.events__col");
                    const homeCell = row.querySelector("td.colspan__col");

                    if (!awayCell || !homeCell) return;

                    const awayTeam = awayCell.textContent.trim();
                    const homeTeam = homeCell.textContent.trim()
                        .replace(/^@\s+/, "")
                        .replace(/^vs\s+/, "")
                        .trim();

                    if (!awayTeam || !homeTeam) return;

                    const dateCell = row.querySelector("td.date__col");
                    const resultCell = row.querySelector("td.teams__col");
                    const timeCell = dateCell || resultCell;

                    let timeStr = "";
                    let gameLink = "";
                    if (timeCell) {
                        const link = timeCell.querySelector("a");
                        timeStr = link ? link.textContent.trim() : timeCell.textContent.trim();
                        gameLink = link ? link.href : "";
                    }

                    // TV Channels
                    const tvCell = row.querySelector("td.broadcast__col");
                    let tvChannels = [];
                    if (tvCell) {
                        const networkLinks = tvCell.querySelectorAll("a.network-container_link, a.AnchorLink");
                        networkLinks.forEach(nl => {
                            const logo = nl.querySelector("img");
                            let name = logo && logo.alt ? logo.alt.replace("Watch on ", "").trim() : nl.textContent.trim();
                            if (name && !tvChannels.find(tc => tc.name === name)) {
                                tvChannels.push({ name, link: nl.href });
                            }
                        });

                        const textContent = tvCell.innerText.trim();
                        if (textContent && textContent !== "TV") {
                            const names = textContent.split(/\n|,|and|\//).map(n => n.trim()).filter(n => n && n !== "TV");
                            names.forEach(name => {
                                const cleanName = name.replace("Watch on ", "").trim();
                                if (cleanName && !tvChannels.find(tc => tc.name.toLowerCase() === cleanName.toLowerCase())) {
                                    tvChannels.push({ name: cleanName, link: "" });
                                }
                            });
                        }
                    }

                    // Parse startTime if possible
                    let startTime = null;
                    if (timeStr.includes("AM") || timeStr.includes("PM")) {
                        const fullDateStr = `${dateStr} ${timeStr}`;
                        const parsed = new Date(fullDateStr);
                        if (!isNaN(parsed)) {
                            startTime = parsed.toISOString();
                        }
                    }

                    // If time is "LIVE" or a score, set it to null as per user request
                    let finalTime = timeStr;
                    if (timeStr === "LIVE" || /\d+,\s/.test(timeStr) || /\d+-\d+/.test(timeStr) || timeStr.includes("Final")) {
                        finalTime = null;
                    }

                    results.push({
                        date: dateStr,
                        awayTeam,
                        homeTeam,
                        time: finalTime,
                        startTime,
                        gameLink,
                        tvChannels
                    });
                });
            });
            return results;
        });

        return games;
    } catch (err) {
        console.error(`Error scraping ${league} schedule:`, err);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrapeESPNMatchups };

if (require.main === module) {
    const fs = require("fs");
    (async () => {
        const games = await scrapeESPNMatchups();
        console.log(`Found ${games.length} games.`);
        fs.writeFileSync("espnMatchups.json", JSON.stringify(games, null, 2));
        console.log("Results written to espnMatchups.json");
    })();
}
