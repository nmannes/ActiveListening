const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { HEADLESS } = require("../args");

puppeteer.use(StealthPlugin());

/**
 * Scrapes upcoming live streams from a given YouTube channel handle.
 * @param {import('puppeteer').Browser} browser
 * @param {string} channelHandle - YouTube channel handle (e.g. "@AssociatedPress")
 * @returns {Promise<Object[]>} Array of upcoming stream objects.
 */
async function scrapeYoutubeUpcoming(browser, channelHandle) {
  const cleanHandle = channelHandle.startsWith("@")
    ? channelHandle
    : `@${channelHandle}`;
  const url = `https://www.youtube.com/${cleanHandle}/streams`;

  console.log(`[YouTube] Navigating to ${url}...`);
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Scroll to trigger lazy-loading
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await delay(1000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    const streams = await page.evaluate(() => {
      function parseScheduledText(text) {
        if (!text) return null;
        const match = text.match(
          /(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i,
        );
        if (!match) return null;
        const month = parseInt(match[1], 10) - 1;
        const day = parseInt(match[2], 10);
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        let hours = parseInt(match[4], 10);
        const minutes = parseInt(match[5], 10);
        const ampm = match[6].toUpperCase();
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
        return new Date(year, month, day, hours, minutes).toISOString();
      }

      const items = document.querySelectorAll("ytd-rich-item-renderer");
      const results = [];

      for (const item of items) {
        // The badge overlay text on the thumbnail tells us the state:
        // "Upcoming" = upcoming stream, "LIVE" = currently live, otherwise it's a duration like "32:17"
        const badgeLink = item.querySelector("a.ytLockupViewModelContentImage");
        const badgeText = badgeLink?.textContent?.trim() || "";
        if (badgeText.toLowerCase() !== "upcoming") continue;

        // Title + video URL
        const titleLink = item.querySelector("a.ytLockupMetadataViewModelTitle");
        const title = titleLink?.textContent?.trim() || "";
        const videoUrl = titleLink?.href || "";

        // Metadata spans contain waiting count and scheduled time
        const metadataSpans = item.querySelectorAll(
          "span.ytContentMetadataViewModelMetadataText",
        );
        const metadataTexts = Array.from(metadataSpans)
          .map((s) => s.textContent.trim())
          .filter(Boolean);

        const waitingText =
          metadataTexts.find((t) => t.toLowerCase().includes("waiting")) || "";
        const scheduledText =
          metadataTexts.find((t) =>
            t.toLowerCase().includes("scheduled"),
          ) || metadataTexts.join(" ");

        results.push({
          title,
          url: videoUrl,
          thumbnail: "",
          scheduledText,
          scheduledISO: parseScheduledText(scheduledText),
          waitingCount: waitingText.replace(/\s*waiting/i, "").trim(),
        });
      }

      return results;
    });

    console.log(
      `[YouTube] Found ${streams.length} upcoming stream(s) on ${cleanHandle}.`,
    );
    return streams;
  } finally {
    await page.close();
  }
}

module.exports = { scrapeYoutubeUpcoming };

if (require.main === module) {
  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  (async () => {
    const handle = process.argv[2] || "@AssociatedPress";
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
      const streams = await scrapeYoutubeUpcoming(browser, handle);
      console.log(JSON.stringify(streams, null, 2));
    } catch (e) {
      console.error("[YouTube] Error:", e);
    } finally {
      if (browser) await browser.close();
    }
  })();
}
