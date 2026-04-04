const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
  });
  const page = await browser.newPage();
  await page.goto(
    "https://www.ncaa.com/scoreboard/basketball-men/d1/2026/03/21/all-conf",
    { waitUntil: "networkidle2" },
  );
  const html = await page.evaluate(() => {
    // Find a pod that is NOT live
    const pods = Array.from(document.querySelectorAll(".gamePod"));
    const upcomingPod = pods.find(
      (pod) =>
        !pod.innerText.includes("HALFTIME") && !pod.innerText.includes("FINAL"),
    );
    return upcomingPod ? upcomingPod.innerHTML : "No upcoming pod";
  });
  console.log(html);
  await browser.close();
}
run();
