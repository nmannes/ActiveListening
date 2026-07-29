const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const { HEADLESS } = require("../args");
const { execSync } = require("child_process");
puppeteer.use(StealthPlugin());

const TEAM_MAP = {
    // NBA + WNBA
    "Atlanta": ["Hawks", "Dream"],
    "Boston": "Celtics",
    "Brooklyn": "Nets",
    "Charlotte": "Hornets",
    "Chicago": ["Bulls", "Sky"],
    "Connecticut": "Sun",
    "Dallas": ["Mavericks", "Wings"],
    "Denver": "Nuggets",
    "Detroit": "Pistons",
    "Golden State": ["Warriors", "Valkyries"],
    "Houston": "Rockets",
    "Indiana": ["Pacers", "Fever"],
    "LA": ["Clippers", "Lakers", "Sparks"],
    "Las Vegas": "Aces",
    "Los Angeles": ["Lakers", "Clippers", "Sparks"],
    "Memphis": "Grizzlies",
    "Miami": "Heat",
    "Milwaukee": "Bucks",
    "Minnesota": ["Timberwolves", "Lynx"],
    "New Orleans": "Pelicans",
    "New York": ["Knicks", "Liberty"],
    "Oklahoma City": "Thunder",
    "Orlando": "Magic",
    "Philadelphia": "76ers",
    "Phoenix": ["Suns", "Mercury"],
    "Portland": "Trail Blazers",
    "Sacramento": "Kings",
    "San Antonio": "Spurs",
    "Seattle": "Storm",
    "Toronto": ["Raptors", "Tempo"],
    "Utah": "Jazz",
    "Washington": ["Wizards", "Mystics"]
};

function getAmazonLinkForMatchup(awayTeam, homeTeam, amazonData) {
    if (!amazonData || !Array.isArray(amazonData)) return null;

    // Helper to get all identifiers for a team (City + Mascots)
    const getIdentifiers = (t) => {
        let idents = [t.toLowerCase()];
        const mapping = TEAM_MAP[t];
        if (mapping) {
            if (Array.isArray(mapping)) {
                idents.push(...mapping.map(m => m.toLowerCase()));
            } else {
                idents.push(mapping.toLowerCase());
            }
        }
        return idents;
    };

    const awayIdents = getIdentifiers(awayTeam);
    const homeIdents = getIdentifiers(homeTeam);

    const match = amazonData.find(item => {
        const title = (item.title || "").toLowerCase();
        // A match occurs if at least one identifier from BOTH teams is present in the title
        const matchAway = awayIdents.some(id => title.includes(id));
        const matchHome = homeIdents.some(id => title.includes(id));
        return matchAway && matchHome;
    });

    const url = match ? (match.linkURL || match.href) : null;
    return url ? `${url}?autoplay=1` : null;
}


async function scrapeESPNMatchups(browser) {
    const leagues = [
        'mlb',
        'nba',
        'wnba',
        'nhl',
        'tennis',
        { name: 'fifa.world', path: 'soccer/schedule/_/league/fifa.world' },
    ];
    let games = [];

    try {
        const page = await browser.newPage();
        for (const league of leagues) {
            const leagueGames = await scrapeESPNForLeague(league, page);
            games.push(...leagueGames);
        }
        await page.close();
    } catch (err) {
        console.error("Error in parallel ESPN scraping:", err);
    }

    return games;
}

/**
 * Scrapes schedule metadata from ESPN for a specific league.
 * @param {string} league - 'mlb', 'nba', 'nhl', etc.
 * @param {object} page - puppeteer page instance.
 * @returns {Array} - Array of game objects.
 */
async function scrapeESPNForLeague(league, page) {
    const leagueName = typeof league === 'string' ? league : league.name;
    const url = typeof league === 'string'
        ? `https://www.espn.com/${league}/schedule`
        : `https://www.espn.com/${league.path}`;
    console.log(`Navigating to ${url}...`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    try {
        await page.waitForSelector(".ScheduleTables, .ResponsiveTable, .NoMatchups", { timeout: 15000 });
    } catch (e) {
        console.log(`Timeout waiting for schedule tables for ${leagueName}`);
    }

    const games = await page.evaluate((leagueName) => {
        const results = [];
        let containers = document.querySelectorAll(".ScheduleTables");
        if (containers.length === 0) {
            containers = document.querySelectorAll(".ResponsiveTable");
        }

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
                    .replace(/^v\s+/, "")
                    .replace(/ /g, " ")
                    .trim();

                if (!awayTeam || !homeTeam) return;

                const dateCell = row.querySelector("td.date__col");
                const resultCell = row.querySelector("td.teams__col");
                const timeCell = dateCell || resultCell;

                let timeStr = "";
                if (timeCell) {
                    const link = timeCell.querySelector("a");
                    timeStr = link ? link.textContent.trim() : timeCell.textContent.trim();
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
                    league: leagueName,
                    date: dateStr,
                    awayTeam,
                    homeTeam,
                    time: finalTime,
                    startTime,
                    tvChannels
                });
            });
        });
        return results;
    }, leagueName);

    return games;
}


module.exports = { scrapeESPNMatchups, getAmazonLinkForMatchup };

if (require.main === module) {
    (async () => {
        let browser;
        try {
            browser = await puppeteer.launch({
                executablePath: "/usr/bin/google-chrome",
                headless: HEADLESS,
                args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
                defaultViewport: null,
            });
            const games = await scrapeESPNMatchups(browser);
            console.log(`Found ${games.length} games.`);
            const cacheDir = process.env.KALSHI_CACHE_DIR || path.join(__dirname, "..", "cache");
            const outputPath = path.join(cacheDir, "espn_matchups.json");
            fs.writeFileSync(outputPath, JSON.stringify(games, null, 2));
            console.log(`Results written to ${outputPath}`);
        } catch (err) {
            console.error("Failed to run standalone ESPN scraping:", err);
        } finally {
            if (browser) await browser.close();
        }
    })();
}
