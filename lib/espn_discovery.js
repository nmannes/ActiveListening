const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const logger = require("./logger");
const fs = require("fs");
const path = require("path");
const cookies = require("../cookies/espn_cookies.json");

puppeteer.use(StealthPlugin());

const scheduleURL =
  "https://www.espn.com/watch/schedule/_/type/upcoming/startDate";

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Parses an ESPN time string (e.g., "8:00 PM") into an ISO timestamp.
 * Assumes Eastern Time (ET) as it's the standard for ESPN.
 * @param {Date} date - The date of the event.
 * @param {string} timeString - The time string from ESPN.
 * @returns {string|null} - ISO timestamp or null if unparseable.
 */
function parseEspnTime(date, timeString) {
  if (!timeString || timeString.toUpperCase() === "LIVE") {
    return new Date().toISOString();
  }

  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;

  let [_, hours, minutes, modifier] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);

  if (modifier.toUpperCase() === "PM" && hours < 12) {
    hours += 12;
  } else if (modifier.toUpperCase() === "AM" && hours === 12) {
    hours = 0;
  }

  const eventDate = new Date(date);
  eventDate.setHours(hours, minutes, 0, 0);

  // ESPN times are typically ET. If the local system is not in ET, this might need adjustment.
  // For now, we'll return the ISO string which reflects the system's interpretation of those hours.
  return eventDate.toISOString();
}

/**
 * Scrapes the ESPN watch schedule page for a range of days.
 * @param {Date} startDate - The date to start scraping from.
 * @param {number} numDays - Number of days to scrape (defaults to 1).
 * @returns {Promise<Array>} - Flat array of discovered games with timestamps.
 */
async function scrapeEspnSchedule(startDate, numDays = 1) {
  let browser;
  const allResults = [];

  try {
    const daysToScrape = Math.abs(numDays);
    logger.info(
      `Launching browser for ESPN scraping (${daysToScrape} days starting from ${formatDate(startDate)})...`,
    );
    browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const scrapeTasks = [];
    for (let i = 0; i < daysToScrape; i++) {
      const currentDate = new Date(startDate);
      const offset = numDays < 0 ? -i : i;
      currentDate.setDate(startDate.getDate() + offset);

      scrapeTasks.push(
        (async (date, idx) => {
          const page = await browser.newPage();
          const dateStr = formatDate(date);
          try {
            await page.setCookie(...cookies);

            let url = path.join(scheduleURL, dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentDay = new Date(date);
            currentDay.setHours(0, 0, 0, 0);

            if (currentDay < today) {
              url = url.replace("upcoming", "replay");
            }

            logger.info(
              `[Day ${idx + 1}/${daysToScrape}] Navigating to ${url}...`,
            );
            await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

            // Wait for the container that indicates the schedule has loaded or no results
            try {
              await page.waitForSelector(
                ".Schedule__Table--category, .Schedule__NoResults",
                { timeout: 15000 },
              );
            } catch (e) {
              logger.warn(
                `Timeout waiting for content on ${dateStr}, skipping...`,
              );
              return [];
            }

            const dayData = await page.evaluate(() => {
              const results = [];
              const sportSections = document.querySelectorAll(
                ".Schedule__Table--category",
              );

              if (sportSections.length === 0) {
                console.log("No sport sections found.");
                return results;
              }

              sportSections.forEach((section) => {
                const sportHeader = section.querySelector(
                  ".Table__Title.Table__Title--dark",
                );
                const sportName = sportHeader
                  ? sportHeader.innerText.trim()
                  : "Unknown Sport";

                const tables = section.querySelectorAll(".ResponsiveTable");
                tables.forEach((table) => {
                  const leagueHeader = table.querySelector(
                    "thead.Table__THEAD th.Table__TH",
                  );
                  const leagueName = leagueHeader
                    ? leagueHeader.innerText.trim()
                    : "General";

                  const rows = table.querySelectorAll(
                    "tbody.Table__TBODY tr.Table__TR",
                  );
                  rows.forEach((row) => {
                    const cells = row.querySelectorAll("td");
                    if (cells.length >= 2) {
                      const time = cells[0].innerText.trim();
                      const linkElement =
                        cells[1].querySelector("a.AnchorLink");
                      const title = linkElement
                        ? linkElement.innerText.trim()
                        : "No Title";
                      const link = linkElement ? linkElement.href : null;

                      // Network is often in the third cell
                      const networkCell = cells[2];
                      let network = "Unknown";
                      if (networkCell) {
                        const networkImg = networkCell.querySelector("img");
                        if (networkImg && networkImg.alt) {
                          network = networkImg.alt;
                        } else {
                          network = networkCell.innerText.trim() || "Unknown";
                        }
                      }

                      results.push({
                        league: leagueName,
                        time,
                        title,
                        link,
                        network,
                      });
                    }
                  });
                });
              });

              return results;
            });

            // Add timestamps for this day and return
            const dailyResultsWithTimestamps = dayData.map((game) => ({
              ...game,
              startTimestamp: parseEspnTime(date, game.time),
            }));

            logger.info(
              `Discovered ${dailyResultsWithTimestamps.length} games for ${dateStr}.`,
            );
            return dailyResultsWithTimestamps;
          } catch (err) {
            logger.error(`Error scraping ${dateStr}: ${err.message}`);
            return [];
          } finally {
            await page.close();
          }
        })(currentDate, i),
      );
    }

    const resultsArray = await Promise.all(scrapeTasks);
    resultsArray.forEach((dayResults) => allResults.push(...dayResults));

    return allResults;
  } catch (error) {
    logger.error(`Scraping failed: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      logger.info("Browser closed.");
    }
  }
}

if (require.main === module) {
  (async () => {
    try {
      const cacheDir = path.join(__dirname, "..", "cache");
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      let numDays = 3;
      const numDaysIndex = process.argv.indexOf("--numdays");
      if (numDaysIndex !== -1 && process.argv.length > numDaysIndex + 1) {
        const parsed = parseInt(process.argv[numDaysIndex + 1], 10);
        if (!isNaN(parsed)) {
          numDays = parsed;
        }
      }

      // Scrape numDays days starting from tomorrow
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);

      const data = await scrapeEspnSchedule(startDate, numDays);
      const outputPath = path.join(cacheDir, "espn_schedule.json");
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 4));

      logger.info(`Successfully scraped ${data.length} games to ${outputPath}`);

      if (data.length > 0) {
        const firstGame = data[0];
        logger.info(
          `Example game: ${firstGame.sport} -> ${firstGame.league}: ${firstGame.title} at ${firstGame.startTimestamp}`,
        );
      } else {
        logger.warn("No games discovered in the schedule.");
      }
    } catch (err) {
      logger.error(`Execution error: ${err.message}`);
      process.exit(1);
    }
  })();
}

module.exports = { scrapeEspnSchedule };
