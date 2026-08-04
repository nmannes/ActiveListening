// Test the Q4 site handler against a live Q4 attendee page.
// Usage: bun run scripts/test_q4_handler.js <url>
const puppeteer = require("puppeteer");
const pino = require("pino");
const { runSiteHandlers } = require("../lib/site_handlers");

const url = process.argv[2];
if (!url) {
  console.error("Usage: bun run scripts/test_q4_handler.js <url>");
  process.exit(1);
}

const logger = pino({ level: "info", transport: { target: "pino/file", options: { destination: 1 } } });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--disable-web-security",
    ],
  });
  const page = await browser.newPage();
  page.on("console", (m) => console.log("[console]", m.text()));

  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  await runSiteHandlers(url, page, logger);

  // Let the handler's playback kicker run a bit, then check state
  await new Promise((r) => setTimeout(r, 10000));
  const state = await page.evaluate(() => {
    const vids = Array.from(document.querySelectorAll("video"));
    return {
      url: location.href,
      text: (document.body?.innerText || "").slice(0, 300),
      videos: vids.map((v) => ({
        paused: v.paused,
        muted: v.muted,
        readyState: v.readyState,
        src: (v.currentSrc || v.src || "").slice(0, 120),
      })),
    };
  });
  console.log("FINAL STATE:", JSON.stringify(state, null, 2));

  const playing = state.videos.some((v) => !v.paused && v.readyState >= 2);
  console.log(playing ? "PASS: video playing" : "FAIL: no playing video");
  await browser.close();
})();
