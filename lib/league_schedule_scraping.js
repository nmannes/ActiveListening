const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const { HEADLESS } = require("./args");
const { execSync } = require("child_process");
puppeteer.use(StealthPlugin());

const TEAM_MAP = {
    "Atlanta": "Hawks",
    "Boston": "Celtics",
    "Brooklyn": "Nets",
    "Charlotte": "Hornets",
    "Chicago": "Bulls",
    "Cleveland": "Cavaliers",
    "Dallas": "Mavericks",
    "Denver": "Nuggets",
    "Detroit": "Pistons",
    "Golden State": "Warriors",
    "Houston": "Rockets",
    "Indiana": "Pacers",
    "LA": ["Clippers", "Lakers"],
    "Los Angeles": ["Lakers", "Clippers"],
    "Memphis": "Grizzlies",
    "Miami": "Heat",
    "Milwaukee": "Bucks",
    "Minnesota": "Timberwolves",
    "New Orleans": "Pelicans",
    "New York": "Knicks",
    "Oklahoma City": "Thunder",
    "Orlando": "Magic",
    "Philadelphia": "76ers",
    "Phoenix": "Suns",
    "Portland": "Trail Blazers",
    "Sacramento": "Kings",
    "San Antonio": "Spurs",
    "Toronto": "Raptors",
    "Utah": "Jazz",
    "Washington": "Wizards"
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
        const title = item.title.toLowerCase();
        // A match occurs if at least one identifier from BOTH teams is present in the title
        const matchAway = awayIdents.some(id => title.includes(id));
        const matchHome = homeIdents.some(id => title.includes(id));
        return matchAway && matchHome;
    });

    return match ? match.href : null;
}

async function scrapeESPNMatchups() {
    const leagues = ['mlb', 'nba', 'nhl'];
    let games = [];

    const browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: HEADLESS,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
        defaultViewport: null,
    });

    try {

        const page = await browser.newPage();
        for (const league of leagues) {
            const leagueGames = await scrapeESPNForLeague(league, page);
            games.push(...leagueGames);
        }
    } catch (err) {
        console.error("Error in parallel ESPN scraping:", err);
    } finally {
        if (browser) await browser.close();
    }

    // Link Substitution Logic for Prime Video
    try {
        const amazonPath = path.join(__dirname, "..", "cache", "nba_search_results.json");
        if (!fs.existsSync(amazonPath)) {
            console.log("Amazon search results cache missing. Running scraper...");
            const scraperPath = path.join(__dirname, "scrape_amazon_video.js");
            execSync(`node "${scraperPath}"`, { stdio: 'inherit' });
        }

        const amazonData = JSON.parse(fs.readFileSync(amazonPath, "utf8"));
        games = games.map(game => {
            const hasPrime = game.tvChannels.some(ch => ch.name.toLowerCase().includes("prime video"));
            if (hasPrime) {
                const amazonLink = getAmazonLinkForMatchup(game.awayTeam, game.homeTeam, amazonData);
                if (amazonLink) {
                    console.log(`Substituting ESPN link for ${game.awayTeam} vs ${game.homeTeam} with Prime Video link.`);
                    return { ...game, gameLink: amazonLink };
                }
            }
            return game;
        });

    } catch (e) {
        console.error("Error substituting Prime Video links:", e);
    }

    return games;
}

/**
 * Scrapes schedule metadata from ESPN for a specific league.
 * @param {string} league - 'mlb', 'nba', 'nhl', etc.
 * @param {object} existingBrowser - Optional puppeteer browser instance.
 * @returns {Array} - Array of game objects.
 */
async function scrapeESPNForLeague(league, page) {

    const url = `https://www.espn.com/${league}/schedule`;
    console.log(`Navigating to ${url}...`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const games = await page.evaluate((leagueName) => {
        const results = [];
        // ... (rest of the scrape logic remains the same)
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
                    league: leagueName,
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
    }, league);

    return games;
}


module.exports = { scrapeESPNMatchups, getAmazonLinkForMatchup };

if (require.main === module) {
    (async () => {
        const games = await scrapeESPNMatchups();
        console.log(`Found ${games.length} games.`);
        const outputPath = path.join(__dirname, "..", "cache", "espn_matchups.json");
        fs.writeFileSync(outputPath, JSON.stringify(games, null, 2));
        console.log(`Results written to ${outputPath}`);
    })();
}
