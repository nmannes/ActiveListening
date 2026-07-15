/**
 * Quick test of the AI fallback handler against a real earnings call URL.
 * Usage: node scripts/test_ai_handler.js [url]
 */
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const { runSiteHandlers } = require("../lib/site_handlers");

const URL = process.argv[2] || "https://metroconnections-events.com/wf2Qearnings26";
const HEADLESS = !process.argv.includes("--browser");

async function main() {
  console.log(`Testing AI handler on: ${URL}\n`);

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: HEADLESS,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized",
           "--autoplay-policy=no-user-gesture-required", "--disable-web-security"],
    defaultViewport: null,
  });

  const logger = {
    info: (msg) => console.log(`  INFO  ${msg}`),
    warn: (msg) => console.log(`  WARN  ${msg}`),
    error: (msg) => console.log(`  ERROR ${msg}`),
    debug: (msg) => console.log(`  DEBUG ${msg}`),
    trace: () => {},
  };

  try {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.text().includes("[handler]") || msg.text().includes("[ai-handler]")) {
        console.log(`  PAGE  ${msg.text()}`);
      }
    });

    console.log("Navigating...");
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
    console.log("Page loaded.\n");

    console.log("Running site handlers (will fall back to AI)...");
    await runSiteHandlers(URL, page, logger);
    console.log("\nDone. Browser stays open 10s for inspection.");
    await new Promise((r) => setTimeout(r, 10000));
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
}

main();
