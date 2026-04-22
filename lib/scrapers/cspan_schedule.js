
async function scrapeCspanSchedule(browser, startDateArg = null, numDays = 3) {
    let result = [];
    const dates = [];

    if (startDateArg) {
        dates.push(startDateArg);
    } else {
        const today = new Date();
        for (let i = 0; i < numDays; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];
            dates.push(dateStr);
        }
    }

    for (const date of dates) {
        console.log(`Scraping C-SPAN schedule for ${date}...`);
        const daySchedule = await scrapeCspanScheduleHelper(browser, date);
        const dayScheduleWithDate = daySchedule.map(item => ({ ...item, date }));
        result.push(...dayScheduleWithDate);
    }
    return result;
}

async function scrapeCspanScheduleHelper(browser, date) {
    const url = `https://www.c-span.org/schedule/print/?timezone-toggle=ET&date=${date}`;
    let page;
    try {
        page = await browser.newPage();
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
    } finally {
        if (page) await page.close();
    }
}

module.exports = { scrapeCspanSchedule };

if (require.main === module) {
    const puppeteer = require("puppeteer-extra");
    const StealthPlugin = require("puppeteer-extra-plugin-stealth");
    const { HEADLESS } = require("../args");
    puppeteer.use(StealthPlugin());

    (async () => {
        const browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome",
            headless: HEADLESS,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
            defaultViewport: null,
        });
        try {
            const schedule = await scrapeCspanSchedule(browser, "2026-04-07");
            console.log(JSON.stringify(schedule, null, 2));
        } finally {
            await browser.close();
        }
    })();
}