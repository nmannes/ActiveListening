const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { HEADLESS } = require("../args");

puppeteer.use(StealthPlugin());

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

/**
 * Parses MSNBC time/day strings like:
 *   "mondays 9pm et"         -> every Monday at 9pm ET
 *   "weekdays 6am et"        -> Mon-Fri at 6am ET
 *   "weeknights 10pm et"     -> Mon-Fri at 10pm ET
 *   "tuesday-friday 8pm et"  -> Tue-Fri at 8pm ET
 *
 * Returns an array of Date objects for the next occurrences within numDays.
 */
function parseDayTime(dayTimeStr, refDate, numDays) {
  if (!dayTimeStr) return [];

  // Normalize: strip timezone suffixes and extra whitespace
  let clean = dayTimeStr.toLowerCase().trim();
  clean = clean.replace(/\b(et|edt|est)\b/i, "").replace(/\s+/g, " ").trim();

  // Parse the time portion: e.g. "9pm", "6am", "10pm"
  const timeMatch = clean.match(/(\d{1,2})\s*(am|pm)/i);
  if (!timeMatch) return [];
  let hours = parseInt(timeMatch[1], 10);
  const ampm = timeMatch[2].toLowerCase();
  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  // Parse the day portion
  const dayPart = clean.replace(timeMatch[0], "").trim();

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayAbbrs = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  let targetDays = [];

  if (dayPart.includes("weekday") || dayPart.includes("weeknight")) {
    // Monday through Friday
    targetDays = [1, 2, 3, 4, 5]; // Mon=1 ... Fri=5
  } else if (dayPart.includes("-")) {
    // Range like "tuesday-friday"
    const parts = dayPart.split(/[-–]/);
    for (const part of parts) {
      const p = part.trim().replace(/s$/, ""); // "tuesdays" -> "tuesday"
      for (let i = 0; i < dayNames.length; i++) {
        if (p === dayNames[i] || p === dayAbbrs[i]) {
          targetDays.push(i);
          break;
        }
      }
    }
    if (targetDays.length === 2) {
      // Expand range
      const [start, end] = targetDays;
      targetDays = [];
      for (let d = start; d <= end; d++) {
        targetDays.push(d);
      }
    }
  } else {
    // Single day like "mondays" or "monday"
    const single = dayPart.replace(/s$/, "").trim();
    for (let i = 0; i < dayNames.length; i++) {
      if (single === dayNames[i] || single === dayAbbrs[i]) {
        targetDays = [i];
        break;
      }
    }
  }

  if (targetDays.length === 0) return [];

  // Generate dates for each target day within numDays
  const results = [];
  const endDate = new Date(refDate);
  endDate.setDate(endDate.getDate() + numDays);

  for (let weekOffset = 0; weekOffset <= Math.ceil(numDays / 7); weekOffset++) {
    for (const targetDay of targetDays) {
      const d = nextDayOfWeek(refDate, targetDay, weekOffset);
      d.setHours(hours, 0, 0, 0);

      // Check if within the window
      if (d >= refDate && d < endDate) {
        results.push(new Date(d));
      }
    }
  }

  return results;
}

function isEasternDaylight(d) {
  const y = d.getFullYear();
  const mar2ndSun = 8 + ((7 - new Date(y, 2, 1).getDay()) % 7);
  const nov1stSun = 1 + ((7 - new Date(y, 10, 1).getDay()) % 7);
  return d >= new Date(y, 2, mar2ndSun) && d < new Date(y, 10, nov1stSun);
}

function etToUTC(date) {
  const offset = isEasternDaylight(date) ? 4 : 5;
  return new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(),
    date.getHours() + offset, 0, 0, 0
  )).toISOString();
}

/**
 * Parse show duration from MSNBC time/day string. Handles:
 *   "weekdays 6am et"          -> 60 min (single time)
 *   "weekdays 6am-10am et"     -> 240 min (range)
 *   "tuesday-friday 9pm et"   -> 60 min (single time)
 *   "weekends 8am-11am et"    -> 180 min (range)
 *
 * Returns duration in minutes. Defaults to 60 if parsing fails.
 */
function parseDuration(dayTimeStr) {
  if (!dayTimeStr) return 60;

  const clean = dayTimeStr.toLowerCase().trim()
    .replace(/\b(et|edt|est)\b/i, "").replace(/\s+/g, " ").trim();

  // Try to match a time range like "6am-10am" or "6am - 10am"
  const rangeMatch = clean.match(/(\d{1,2})\s*(am|pm)\s*[-–]\s*(\d{1,2})\s*(am|pm)/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startAmpm = rangeMatch[2].toLowerCase();
    let endH = parseInt(rangeMatch[3], 10);
    const endAmpm = rangeMatch[4].toLowerCase();

    if (startAmpm === "pm" && startH < 12) startH += 12;
    if (startAmpm === "am" && startH === 12) startH = 0;
    if (endAmpm === "pm" && endH < 12) endH += 12;
    if (endAmpm === "am" && endH === 12) endH = 0;

    // Handle overnight spanning (e.g. "11pm-2am")
    let diff = endH - startH;
    if (diff <= 0) diff += 24;

    return diff * 60;
  }

  return 60; // single time = 1-hour show
}

/**
 * Scrapes the MSNBC TV schedule from ms.now/schedule.
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

    // Wait for featured shows to render
    await page.waitForSelector(".featured-shows figcaption", { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 1000));

    const refDate = new Date();
    refDate.setHours(0, 0, 0, 0);

    const shows = await page.evaluate((refDateISO, numDays, etToUTCStr) => {
      const refDate = new Date(refDateISO);

      // DST helper (replicated in evaluate context)
      function isEasternDaylight(d) {
        const y = d.getFullYear();
        const mar2ndSun = 8 + ((7 - new Date(y, 2, 1).getDay()) % 7);
        const nov1stSun = 1 + ((7 - new Date(y, 10, 1).getDay()) % 7);
        return d >= new Date(y, 2, mar2ndSun) && d < new Date(y, 10, nov1stSun);
      }
      function etToUTC(date) {
        const offset = isEasternDaylight(date) ? 4 : 5;
        return new Date(Date.UTC(
          date.getFullYear(), date.getMonth(), date.getDate(),
          date.getHours() + offset, 0, 0, 0
        )).toISOString();
      }

      function nextDayOfWeek(ref, targetDay, weekOffset) {
        const d = new Date(ref);
        d.setDate(d.getDate() + weekOffset * 7);
        const currentDay = d.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil < 0) daysUntil += 7;
        d.setDate(d.getDate() + daysUntil);
        return d;
      }

      function parseDayTime(dayTimeStr, refDate, numDays) {
        if (!dayTimeStr) return [];

        let clean = dayTimeStr.toLowerCase().trim();
        clean = clean.replace(/\b(et|edt|est)\b/i, "").replace(/\s+/g, " ").trim();
        const timeMatch = clean.match(/(\d{1,2})\s*(am|pm)/i);
        if (!timeMatch) return [];
        let hours = parseInt(timeMatch[1], 10);
        const ampm = timeMatch[2].toLowerCase();
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;

        const dayPart = clean.replace(timeMatch[0], "").trim();
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayAbbrs = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

        let targetDays = [];

        if (dayPart.includes("weekday") || dayPart.includes("weeknight")) {
          targetDays = [1, 2, 3, 4, 5];
        } else if (dayPart.includes("-")) {
          const parts = dayPart.split(/[-–]/);
          const rangeDays = [];
          for (const part of parts) {
            const p = part.trim().replace(/s$/, "");
            for (let i = 0; i < dayNames.length; i++) {
              if (p === dayNames[i] || p === dayAbbrs[i]) {
                rangeDays.push(i);
                break;
              }
            }
          }
          if (rangeDays.length === 2) {
            const [start, end] = rangeDays;
            for (let d = start; d <= end; d++) targetDays.push(d);
          } else {
            targetDays = rangeDays;
          }
        } else {
          const single = dayPart.replace(/s$/, "").trim();
          for (let i = 0; i < dayNames.length; i++) {
            if (single === dayNames[i] || single === dayAbbrs[i]) {
              targetDays = [i];
              break;
            }
          }
        }

        if (targetDays.length === 0) return [];

        const results = [];
        const endDate = new Date(refDate);
        endDate.setDate(endDate.getDate() + numDays);

        for (let weekOffset = 0; weekOffset <= Math.ceil(numDays / 7); weekOffset++) {
          for (const targetDay of targetDays) {
            const d = nextDayOfWeek(refDate, targetDay, weekOffset);
            d.setHours(hours, 0, 0, 0);

            if (d >= refDate && d < endDate) {
              results.push(new Date(d));
            }
          }
        }

        return results;
      }

      function parseDuration(dayTimeStr) {
        if (!dayTimeStr) return 60;
        const clean = dayTimeStr.toLowerCase().trim()
          .replace(/\b(et|edt|est)\b/i, "").replace(/\s+/g, " ").trim();
        const rangeMatch = clean.match(/(\d{1,2})\s*(am|pm)\s*[-–]\s*(\d{1,2})\s*(am|pm)/i);
        if (rangeMatch) {
          let startH = parseInt(rangeMatch[1], 10);
          const startAmpm = rangeMatch[2].toLowerCase();
          let endH = parseInt(rangeMatch[3], 10);
          const endAmpm = rangeMatch[4].toLowerCase();
          if (startAmpm === "pm" && startH < 12) startH += 12;
          if (startAmpm === "am" && startH === 12) startH = 0;
          if (endAmpm === "pm" && endH < 12) endH += 12;
          if (endAmpm === "am" && endH === 12) endH = 0;
          let diff = endH - startH;
          if (diff <= 0) diff += 24;
          return diff * 60;
        }
        return 60;
      }

      const results = [];
      const captions = document.querySelectorAll(".featured-shows figcaption");

      captions.forEach((caption) => {
        // innerText is empty in this page's rendering, parse innerHTML directly
        const html = caption.innerHTML;
        const match = html.match(/<strong>([^<]*)<\/strong>(.*)/i);
        if (!match) return;

        const showName = match[1].trim();
        const dayTimeText = match[2].trim();

        if (!showName || !dayTimeText) return;

        const duration = parseDuration(dayTimeText);
        const dates = parseDayTime(dayTimeText, refDate, numDays);

        dates.forEach((d) => {
          results.push({
            title: showName,
            time: dayTimeText,
            startTime: etToUTC(d),
            dayLabel: d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase(),
            channel: "MS NOW",
            duration: duration,
          });
        });
      });

      return results;
    }, refDate.toISOString(), numDays);

    console.log(`[MSNBC] Found ${shows.length} show slot(s) from featured shows.`);

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
