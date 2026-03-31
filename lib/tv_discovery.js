const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const _ = require("lodash");

puppeteer.use(StealthPlugin());

const { getChannelURLByBand } = require("./xml");

/**
 * Parses TitanTV date and time strings into an ISO timestamp.
 * @param {string} dateStr - Date string like "Friday - 3/13"
 * @param {string} timeStr - Time string like "1:30 PM - 2:00 PM"
 * @returns {string|null} - ISO timestamp or null if unparseable.
 */
function parseTitanTime(dateStr, timeStr, isEnd = false) {
  if (!dateStr || !timeStr) return null;

  const dateMatch = dateStr.match(/(\d+)\/(\d+)/);
  const timeParts = timeStr.split("-");
  const targetTimeStr = (isEnd && timeParts.length > 1 ? timeParts[1] : timeParts[0]).trim();
  const timeMatch = targetTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);

  if (!dateMatch || !timeMatch) return null;

  const month = parseInt(dateMatch[1], 10) - 1;
  const day = parseInt(dateMatch[2], 10);

  let hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const modifier = timeMatch[3].toUpperCase();

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  const d = new Date();
  d.setMonth(month, day);
  d.setHours(hours, minutes, 0, 0);

  // If it's an end time and it crossed midnight (start is PM, end is AM)
  if (isEnd && timeParts.length > 1) {
    const startStr = timeParts[0].trim();
    const startMatch = startStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (startMatch && startMatch[3].toUpperCase() === "PM" && modifier === "AM") {
      d.setDate(d.getDate() + 1);
    }
  }

  return d.toISOString();
}

const findProgramsByZipAndKeyword = async (zip, keyword) => {
  // use puppeteer to navigate https://www.antennaweb.org/
  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    console.log(`[AntennaWeb] Navigating to antennaweb.org for zip ${zip}...`);
    await page.goto("https://www.antennaweb.org/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await delay(3000);

    // 1. Enter Zip
    await page.waitForSelector("input#frmZipS", {
      visible: true,
      timeout: 30000,
    });
    const zipInputs = await page.$$("input#frmZipS");
    for (const input of zipInputs) {
      const isVisible = await input.evaluate(
        (el) => el.offsetWidth > 0 && el.offsetHeight > 0,
      );
      if (isVisible) {
        await input.type(zip.toString());
        break;
      }
    }

    // 2. Click Go
    const goBtns = await page.$$('button[class*="GoButton"]');
    for (const btn of goBtns) {
      const isVisible = await btn.evaluate(
        (el) => el.offsetWidth > 0 && el.offsetHeight > 0,
      );
      if (isVisible) {
        await btn.evaluate((el) => setTimeout(() => el.click(), 50));
        break;
      }
    }

    console.log(`[AntennaWeb] Waiting for Results...`);
    await delay(8000);

    // 3. Click My Schedule
    const links = await page.$$('div[class*="Link-"]');
    for (const link of links) {
      const text = await link.evaluate((el) => el.innerText);
      if (text && text.includes("MY SCHEDULE")) {
        await link.evaluate((el) => setTimeout(() => el.click(), 50));
        break;
      }
    }

    console.log(`[AntennaWeb] Waiting for TitanTV IFrame...`);
    await delay(12000);

    // 4. Find IFrame
    let scheduleFrame = null;
    for (const frame of page.frames()) {
      if (frame.url().includes("titantvguide.com")) {
        scheduleFrame = frame;
        break;
      }
    }

    if (!scheduleFrame) {
      throw new Error("TitanTV iframe not found");
    }

    // 5. Find Search Box inside IFrame
    let searchInput = null;
    try {
      searchInput = await scheduleFrame.waitForSelector('input[type="text"]', {
        visible: true,
        timeout: 10000,
      });
    } catch (e) {
      console.log(`[AntennaWeb] Search box not found`);
      return [];
    }

    // 6. Type Keyword
    await searchInput.type(keyword);
    await searchInput.press("Enter");

    console.log(`[AntennaWeb] Searching for "${keyword}"...`);

    // Wait for results
    await delay(10000);

    const rawElements = await scheduleFrame.evaluate(() => {
      return Array.from(document.querySelectorAll("div"))
        .filter((el) => window.getComputedStyle(el).display === "inline-flex")
        .map((el) => el.innerText);
    });

    const programs = rawElements
      .map((raw) => {
        if (!raw || !raw.trim()) return null;
        const lines = raw
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        if (lines.length < 3) return null;

        const title = lines[0];
        const date = lines[1];
        const time = lines[2];

        let station = "";
        let metadata = "";
        let description = "";

        let currentIndex = 3;

        // Heuristic for metadata: short strings or known labels
        while (
          currentIndex < lines.length &&
          !lines[currentIndex].includes("•") &&
          (lines[currentIndex].length < 10 ||
            /^(CC|TV-|PG-)/.test(lines[currentIndex]))
        ) {
          metadata += (metadata ? " " : "") + lines[currentIndex];
          currentIndex++;
        }

        if (currentIndex < lines.length && lines[currentIndex].includes("•")) {
          station = lines[currentIndex];
          currentIndex++;
        }

        if (currentIndex < lines.length) {
          description = lines.slice(currentIndex).join("\n");
        }

        const band = station.match(/\d+\.\d+/)
          ? station.match(/\d+\.\d+/)[0]
          : "";

        return {
          title,
          date,
          time,
          startTimestamp: parseTitanTime(date, time),
          endTimestamp: parseTitanTime(date, time, true),
          station,
          band,
          metadata,
          description,
          zip,
        };
      })
      .filter((p) => p !== null);

    for (const program of programs) {
      const channelURL = await getChannelURLByBand(program.band);
      program.channelURL = channelURL;
    }

    return programs;
  } catch (e) {
    console.error(`[AntennaWeb] Error scraping schedule:`, e);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};



/**
 * Parallelizes findProgramsByZipAndKeyword calls across multiple zip codes.
 * @param {number[]} zips - Array of zip codes to check.
 * @param {string} keyword - Keyword to search for.
 * @param {number} concurrency - Max simultaneous browser instances (default 3).
 * @returns {Promise<Object[]>} - Combined and deduplicated array of found programs.
 */
const findProgramsAcrossZipsAndKeywords = async (zips, keyword, concurrency = 3) => {
  const results = [];
  const batches = _.chunk(zips, concurrency);

  for (const batch of batches) {
    console.log(`[AntennaWeb] Processing batch of zips: ${batch.join(", ")}`);
    const batchResults = await Promise.all(
      batch.map((zip) => findProgramsByZipAndKeyword(zip, keyword))
    );
    results.push(..._.flatten(batchResults));
  }

  // Deduplicate results by title, station, and time
  return _.uniqBy(results, (p) => `${p.title}-${p.station}-${p.startTimestamp}`);
};

module.exports = {
  findProgramsByZipAndKeyword,
  findProgramsAcrossZipsAndKeywords,
};

if (require.main === module) {
  (async () => {
    const result = await findProgramsByZipAndKeyword(20001, "basketball");
    console.log(JSON.stringify(result, null, 2));
  })();
}
