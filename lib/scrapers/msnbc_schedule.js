const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { HEADLESS } = require("../args");

puppeteer.use(StealthPlugin());

const DAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Given a reference date, returns the next date matching the target day of week.
 */
function nextDayOfWeek(ref, targetDay, weekOffset = 0) {
  const d = new Date(ref);
  d.setDate(d.getDate() + weekOffset * 7);
  const currentDay = d.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0 && weekOffset === 0) daysUntil = 0; // today
  d.setDate(d.getDate() + daysUntil);
  return d;
}

function isEasternDaylight(d) {
  const y = d.getFullYear();
  const mar2ndSun = 8 + ((7 - new Date(y, 2, 1).getDay()) % 7);
  const nov1stSun = 1 + ((7 - new Date(y, 10, 1).getDay()) % 7);
  return d >= new Date(y, 2, mar2ndSun) && d < new Date(y, 10, nov1stSun);
}

function etToUTC(date, offsetOverride = null) {
  const offset = offsetOverride ?? (isEasternDaylight(date) ? 4 : 5);
  return new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours() + offset, date.getMinutes(), 0, 0
  )).toISOString();
}

/**
 * Parses a grid time cell such as "4:00 AM EDT" or "11:30 PM EST".
 * Returns { hours, minutes, offsetHours } — offsetHours being how many hours
 * behind UTC Eastern is — or null if the cell cannot be parsed.
 */
function parseScheduleTime(str) {
  if (!str) return null;

  const match = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*(E[SD]T)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  // The grid labels each slot EDT/EST, so trust it and only fall back to the
  // DST calculation when the label is missing.
  const tz = match[4] ? match[4].toUpperCase() : null;
  const offsetHours = tz === "EST" ? 5 : tz === "EDT" ? 4 : null;

  return { hours, minutes, offsetHours };
}

/**
 * Scrapes the MSNBC weekly schedule from ms.now/schedule.
 *
 * The page renders all seven day panels into the DOM at once — the day tabs
 * only toggle visibility — so the whole grid is readable without clicking
 * through tabs.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {number} [numDays=2] - Number of days to generate shows for
 * @returns {Promise<Object[]>} Array of show objects with title, startTime, etc.
 */
async function scrapeMsnbcSchedule(browser, numDays = 2) {
  const url = "https://www.ms.now/schedule";
  console.log(`[MSNBC] Navigating to ${url}...`);
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the weekly grid to render
    await page.waitForSelector(".wp-block-rkv-schedule .schedule-time", {
      timeout: 30000,
    });

    const slots = await page.evaluate(() => {
      const rows = [];
      document
        .querySelectorAll(".schedule-tabpanel[data-day]")
        .forEach((panel) => {
          const day = (panel.getAttribute("data-day") || "").toLowerCase();
          panel.querySelectorAll(".schedule-time").forEach((timeEl) => {
            const row = timeEl.closest(".wp-block-group");
            const titleEl = row && row.querySelector("h2");
            const title = titleEl
              ? titleEl.textContent.replace(/\s+/g, " ").trim()
              : "";
            if (!title) return;

            const descEl = row.querySelector(".schedule-description");
            rows.push({
              day,
              time: timeEl.textContent.replace(/\s+/g, " ").trim(),
              title,
              description: descEl
                ? descEl.textContent.replace(/\s+/g, " ").trim()
                : "",
            });
          });
        });
      return rows;
    });

    console.log(`[MSNBC] Found ${slots.length} schedule row(s) in the weekly grid.`);

    const refDate = new Date();
    refDate.setHours(0, 0, 0, 0);
    const endDate = new Date(refDate);
    endDate.setDate(endDate.getDate() + numDays);

    const shows = [];
    for (const slot of slots) {
      const targetDay = DAY_INDEX[slot.day];
      const parsed = parseScheduleTime(slot.time);
      if (targetDay === undefined || !parsed) {
        console.log(
          `[MSNBC] Skipping unparseable row: ${slot.day} ${slot.time} ${slot.title}`,
        );
        continue;
      }

      const start = nextDayOfWeek(refDate, targetDay);
      start.setHours(parsed.hours, parsed.minutes, 0, 0);

      // The grid repeats weekly; only the next `numDays` are in scope.
      if (start < refDate || start >= endDate) continue;

      shows.push({
        title: slot.title,
        time: slot.time,
        startTime: etToUTC(start, parsed.offsetHours),
        dayLabel: slot.day,
        channel: "MS NOW",
        duration: 60,
        description: slot.description,
      });
    }

    // The grid lists start times only, so a show runs until the next one on the
    // same day begins. Whatever shows last keeps the 60-minute default.
    const byDay = new Map();
    for (const show of shows) {
      if (!byDay.has(show.dayLabel)) byDay.set(show.dayLabel, []);
      byDay.get(show.dayLabel).push(show);
    }
    for (const dayShows of byDay.values()) {
      for (let i = 0; i < dayShows.length - 1; i++) {
        const gapMinutes =
          (new Date(dayShows[i + 1].startTime) - new Date(dayShows[i].startTime)) / 60000;
        if (gapMinutes > 0 && gapMinutes <= 6 * 60) dayShows[i].duration = gapMinutes;
      }
    }

    // Deduplicate by title + startTime
    const seen = new Set();
    const deduped = shows.filter((s) => {
      const key = `${s.title}|${s.startTime}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by startTime
    deduped.sort((a, b) => a.startTime.localeCompare(b.startTime));

    console.log(`[MSNBC] ${deduped.length} unique show slot(s) after dedup.`);
    return deduped;
  } finally {
    await page.close();
  }
}

module.exports = { scrapeMsnbcSchedule };

if (require.main === module) {
  (async () => {
    const numDays = parseInt(process.argv[2]) || 2;
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: HEADLESS,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--start-minimized",
        ],
        defaultViewport: null,
      });
      const shows = await scrapeMsnbcSchedule(browser, numDays);
      console.log(JSON.stringify(shows, null, 2));
    } catch (e) {
      console.error("[MSNBC] Error:", e);
    } finally {
      if (browser) await browser.close();
    }
  })();
}
