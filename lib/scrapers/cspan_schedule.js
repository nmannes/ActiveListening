const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

async function scrapeCspanSchedule(date) {
    const url = `https://www.c-span.org/schedule/print/?timezone-toggle=ET&date=${date}`;
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        const schedule = await page.evaluate(() => {
            const table = document.querySelector("table");
            if (!table) return [];
            
            const rows = Array.from(table.querySelectorAll("tr"));
            if (rows.length < 2) return [];

            const headers = Array.from(rows[0].querySelectorAll("th")).map(th => th.innerText.trim());
            const items = [];
            
            rows.slice(1).forEach(row => {
                const cells = Array.from(row.querySelectorAll("td"));
                cells.forEach((cell, index) => {
                    const timeEl = cell.querySelector("span.time");
                    if (timeEl) {
                        const titleEl = cell.querySelector("span.title");
                        const linkEl = titleEl ? titleEl.querySelector("a") : null;
                        const sponsorEl = cell.querySelector("span.sponsor");
                        
                        items.push({
                            startTime: timeEl.innerText.trim(),
                            title: titleEl ? titleEl.innerText.trim() : "",
                            url: linkEl ? linkEl.href : "",
                            sponsor: sponsorEl ? sponsorEl.innerText.trim() : "",
                            channel: headers[index] || `C-SPAN ${index + 1}`
                        });
                    }
                });
            });
            return items;
        });

        return schedule;
    } catch (error) {
        console.error("Error scraping C-SPAN schedule:", error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrapeCspanSchedule };

if (require.main === module) {
    (async () => {
        const schedule = await scrapeCspanSchedule("2026-04-07");
        console.log(JSON.stringify(schedule, null, 2));
    })();
}