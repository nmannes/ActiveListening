const puppeteer = require("puppeteer");
const { getStream, launch } = require("puppeteer-stream");
const fs = require("fs");

(async () => {
    const browser = await launch({
        // IMPORTANT: Enable audio
        ignoreDefaultArgs: ["--mute-audio"],
    });
    const page = await browser.newPage();
    await page.goto("https://www.youtube.com");

    const stream = await getStream(page, { audio: true, video: true });
    const file = fs.createWriteStream("test.webm");
    stream.pipe(file);

    // Stop recording after 10 seconds
    setTimeout(async () => {
        await stream.destroy();
        file.close();
        await browser.close();
    }, 10000);
})();
