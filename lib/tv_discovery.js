const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('./logger');
const { execSync } = require('child_process');

puppeteer.use(StealthPlugin());

const getStationScheduleByZip = async (zip, beginTS, endTS) => {
    // use puppeteer to navigate https://www.antennaweb.org/
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    const delay = ms => new Promise(res => setTimeout(res, ms));

    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();

        console.log(`[AntennaWeb] Navigating to antennaweb.org for zip ${zip}...`);
        await page.goto('https://www.antennaweb.org/', { waitUntil: 'networkidle2', timeout: 30000 });

        await delay(3000);

        // 1. Enter Zip
        await page.waitForSelector('input#frmZipS', { visible: true, timeout: 10000 });
        const zipInputs = await page.$$('input#frmZipS');
        for (const input of zipInputs) {
            const isVisible = await input.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (isVisible) {
                await input.type(zip.toString());
                break;
            }
        }

        // 2. Click Go
        const goBtns = await page.$$('button[class*="GoButton"]');
        for (const btn of goBtns) {
            const isVisible = await btn.evaluate(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            if (isVisible) {
                await btn.evaluate(el => setTimeout(() => el.click(), 50));
                break;
            }
        }

        console.log(`[AntennaWeb] Waiting for Results...`);
        await delay(8000);

        // 3. Click My Schedule
        const links = await page.$$('div[class*="Link-"]');
        for (const link of links) {
            const text = await link.evaluate(el => el.innerText);
            if (text && text.includes('MY SCHEDULE')) {
                await link.evaluate(el => setTimeout(() => el.click(), 50));
                break;
            }
        }

        console.log(`[AntennaWeb] Waiting for TitanTV IFrame...`);
        await delay(12000);

        // 4. Find IFrame
        let scheduleFrame = null;
        for (const frame of page.frames()) {
            if (frame.url().includes('titantvguide.com')) {
                scheduleFrame = frame;
                break;
            }
        }

        if (!scheduleFrame) {
            throw new Error('TitanTV iframe not found');
        }

        // Let tables render
        await delay(5000);

        // 5. Extract Schedule Data
        const scheduleData = await scheduleFrame.evaluate((baseTs) => {
            const results = [];
            const rows = document.querySelectorAll('div[id="primaryViewDiv"] > div > div[style*="display: flex"]');

            const baseDate = new Date(baseTs || Date.now());
            const baseYear = baseDate.getFullYear();
            const baseMonth = baseDate.getMonth();
            const baseDay = baseDate.getDate();

            function parseTime(timeStr) {
                const match = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (!match) return null;
                let hours = parseInt(match[1], 10);
                const minutes = parseInt(match[2], 10);
                const ampm = match[3].toUpperCase();

                if (ampm === 'PM' && hours < 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;

                return new Date(baseYear, baseMonth, baseDay, hours, minutes).getTime();
            }

            rows.forEach(row => {
                const img = row.querySelector('img[title]');
                const callSign = img ? img.getAttribute('title') : 'Unknown';

                // Parse channel number
                let channel = 'Unknown';
                const bolds = row.querySelectorAll('div[style*="font-weight: bold"]');
                for (const b of bolds) {
                    const txt = b.innerText.trim();
                    if (/^\d+\.\d+$/.test(txt)) {
                        channel = txt;
                        break;
                    }
                }

                // Parse programs
                const programs = [];
                const owners = row.querySelectorAll('[id="owner"]');
                owners.forEach(owner => {
                    const div800 = owner.querySelectorAll('div[style*="font-weight: 800"]');
                    let title = '';
                    let subTitle = '';

                    if (div800.length > 0) title = div800[0].innerText.trim();
                    if (div800.length > 1) subTitle = div800[1].innerText.trim();

                    let startTime = null;
                    let endTime = null;

                    // Times are usually in spans with font-size: 12em or just mixed in 
                    const spans = owner.querySelectorAll('span');
                    const timeSpans = Array.from(spans).filter(s => s.innerText.includes('AM') || s.innerText.includes('PM'));
                    if (timeSpans.length >= 2) {
                        startTime = parseTime(timeSpans[0].innerText);
                        endTime = parseTime(timeSpans[1].innerText);
                    } else if (timeSpans.length === 1) {
                        startTime = parseTime(timeSpans[0].innerText);
                    } else {
                        // fallback to regex over whole text
                        const match = owner.innerText.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/);
                        if (match) {
                            startTime = parseTime(match[1]);
                            endTime = parseTime(match[2]);
                        }
                    }

                    if (startTime && endTime && endTime < startTime) {
                        endTime += 24 * 60 * 60 * 1000;
                    }

                    if (title) {
                        const formatLocalISO = (ts) => {
                            if (!ts) return null;
                            const d = new Date(ts);
                            // Get local components to build a local time string with offset
                            const pad = (n) => n.toString().padStart(2, '0');
                            const offset = -d.getTimezoneOffset();
                            const sign = offset >= 0 ? '+' : '-';
                            const absOffset = Math.abs(offset);
                            const offsetHours = pad(Math.floor(absOffset / 60));
                            const offsetMins = pad(absOffset % 60);
                            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000${sign}${offsetHours}:${offsetMins}`;
                        };

                        programs.push({
                            title,
                            subTitle,
                            startDateTime: formatLocalISO(startTime),
                            endDateTime: formatLocalISO(endTime)
                        });
                    }
                });

                results.push({
                    callSign,
                    channel,
                    programs
                });
            });

            return results;
        }, beginTS);

        console.log(`[AntennaWeb] Extracted schedule for ${scheduleData.length} stations.`);
        return scheduleData;

    } catch (e) {
        console.error(`[AntennaWeb] Error scraping schedule:`, e);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};


module.exports = {
    getStationScheduleByZip
};
