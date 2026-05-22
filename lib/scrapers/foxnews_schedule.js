const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { HEADLESS } = require("../args");

puppeteer.use(StealthPlugin());

/**
 * Scrapes the Fox News TV schedule from foxnews.com/fnctv.
 * @param {import('puppeteer').Browser} browser
 * @param {number} [numDays=2] - Number of days to scrape (1 = today only, 2 = today + tomorrow)
 * @returns {Promise<Object[]>} Array of show objects with title, startTime, hosts, etc.
 */
async function scrapeFoxNewsSchedule(browser, numDays = 2) {
  const url = "https://www.foxnews.com/fnctv";
  console.log(`[FoxNews] Navigating to ${url}...`);
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for schedule content to render
    await page.waitForSelector(".schedule.active .item", { timeout: 10000 });
    // Extra buffer for any late rendering
    await new Promise((r) => setTimeout(r, 1000));

    // Click "Tomorrow" tab to load it (it's initially hidden)
    if (numDays >= 2) {
      const tomorrowTab = await page.$(".item-schedule a[href='#']:last-child, .item-schedule .tomorrow, [data-day='Tomorrow']");
      if (tomorrowTab) {
        await tomorrowTab.click();
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const shows = await page.evaluate(() => {
      function isEasternDaylight(d) {
        // US DST: 2nd Sunday March to 1st Sunday November
        const y = d.getFullYear();
        const mar2ndSun = 8 + (7 - new Date(y, 2, 1).getDay()) % 7;
        const nov1stSun = 1 + (7 - new Date(y, 10, 1).getDay()) % 7;
        return d >= new Date(y, 2, mar2ndSun) && d < new Date(y, 10, nov1stSun);
      }

      function parseTimeToISO(timeStr, dayOffset) {
        if (!timeStr) return null;
        // "10AM", "12PM", "1PM", etc.
        const match = timeStr.match(/(\d{1,2})\s*(AM|PM)/i);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const ampm = match[2].toUpperCase();
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;

        // Fox News schedule times are always Eastern Time.
        // Build the date explicitly in ET, not local timezone.
        const now = new Date();
        const etDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (dayOffset || 0));
        const etOffset = isEasternDaylight(etDate) ? 4 : 5; // EDT=-4, EST=-5
        return new Date(Date.UTC(
          etDate.getFullYear(), etDate.getMonth(), etDate.getDate(),
          hours + etOffset, 0, 0, 0
        )).toISOString();
      }

      const results = [];
      const schedules = document.querySelectorAll(".schedule");

      schedules.forEach((schedule) => {
        const dayLabel = (schedule.getAttribute("data-day") || "").toLowerCase();
        let dayOffset = 0;
        if (dayLabel === "tomorrow") dayOffset = 1;
        // Also check via class "hide" which is used for the inactive tab
        if (schedule.classList.contains("hide") && dayLabel !== "today") {
          dayOffset = 1;
        }

        const items = schedule.querySelectorAll(".item");
        items.forEach((item) => {
          const timeEl = item.querySelector(".time");
          const timeText = timeEl?.innerText?.trim() || "";
          if (!timeText) return;

          const titleEl = item.querySelector(".title");
          if (!titleEl) return;

          // Get full title text and strip pill text from it
          const pillEl = titleEl.querySelector(".pill");
          const pillText = pillEl?.innerText?.trim() || "";
          let title = titleEl.innerText.trim();
          if (pillText) {
            title = title.replace(pillText, "").trim();
          }
          // Also strip any leading newline from title
          title = title.replace(/^\n+/, "").trim();

          // Show URL from the last <a> in .title
          const allLinks = titleEl.querySelectorAll("a");
          let showLink = "";
          if (allLinks.length > 0) {
            showLink = allLinks[allLinks.length - 1].href || "";
          }

          const hosts = item.querySelector(".hosts")?.innerText?.trim() || "";
          const description = item.querySelector(".description")?.innerText?.trim() || "";
          const pill = item.querySelector(".pill")?.innerText?.trim() || "";

          results.push({
            title,
            showUrl: showLink || "",
            time: timeText,
            startTime: parseTimeToISO(timeText, dayOffset),
            dayLabel,
            hosts,
            pill,
            description,
            channel: "Fox News",
          });
        });
      });

      return results;
    });

    console.log(`[FoxNews] Found ${shows.length} show(s).`);
    return shows;
  } finally {
    await page.close();
  }
}

module.exports = { scrapeFoxNewsSchedule };

if (require.main === module) {
  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

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
      const shows = await scrapeFoxNewsSchedule(browser, numDays);
      console.log(JSON.stringify(shows, null, 2));
    } catch (e) {
      console.error("[FoxNews] Error:", e);
    } finally {
      if (browser) await browser.close();
    }
  })();
}
