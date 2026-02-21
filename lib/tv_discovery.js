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

        // 5. Extract Schedule Data across time windows
        const scheduleData = [];
        const seenProgramKeys = new Set();
        let currentLatestTime = beginTS;

        const maxLoops = 20; // Hard cap on pagination to prevent infinite loop
        let loopCount = 0;

        while (currentLatestTime < endTS && loopCount < maxLoops) {
            loopCount++;
            console.log(`[AntennaWeb] Parsing time block (Loop ${loopCount})...`);

            const blockData = await scheduleFrame.evaluate(() => {
                const results = [];
                const rows = document.querySelectorAll('div[id="primaryViewDiv"] > div > div[style*="display: flex"]');

                // Extract base date from the UI directly
                let baseYear = new Date().getFullYear();
                let baseMonth = new Date().getMonth();
                let baseDay = new Date().getDate();

                const divs = Array.from(document.querySelectorAll('div'));
                const dateHeader = divs.find(d => {
                    const t = d.innerText;
                    // Matches format like 2/21
                    return t && t.match(/^\d{1,2}\/\d{1,2}$/) && d.childElementCount === 0;
                });

                if (dateHeader) {
                    const parts = dateHeader.innerText.split('/');
                    baseMonth = parseInt(parts[0], 10) - 1;
                    baseDay = parseInt(parts[1], 10);
                    // Simple year wrap assumption
                    if (baseMonth === 0 && new Date().getMonth() === 11) {
                        baseYear++;
                    }
                }

                // Advanced tracking: if we see times jump backwards (e.g. 11 PM to 12 AM), increment the day
                let lastTimeValue = -1;

                function parseTime(timeStr) {
                    const match = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
                    if (!match) return null;
                    let hours = parseInt(match[1], 10);
                    const minutes = parseInt(match[2], 10);
                    const ampm = match[3].toUpperCase();

                    if (ampm === 'PM' && hours < 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;

                    // Simple day boundary detection based on raw hour values
                    let val = hours * 60 + minutes;
                    if (lastTimeValue !== -1 && val < lastTimeValue && (lastTimeValue - val) > 12 * 60) {
                        baseDay++; // Crossed midnight
                    }
                    lastTimeValue = val;

                    return new Date(baseYear, baseMonth, baseDay, hours, minutes).getTime();
                }

                rows.forEach(row => {
                    const img = row.querySelector('img[title]');
                    const callSign = img ? img.getAttribute('title') : 'Unknown';

                    let channel = 'Unknown';
                    const bolds = row.querySelectorAll('div[style*="font-weight: bold"]');
                    for (const b of bolds) {
                        const txt = b.innerText.trim();
                        if (/^\d+\.\d+$/.test(txt)) {
                            channel = txt;
                            break;
                        }
                    }

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

                        const spans = owner.querySelectorAll('span');
                        const timeSpans = Array.from(spans).filter(s => s.innerText.includes('AM') || s.innerText.includes('PM'));
                        if (timeSpans.length >= 2) {
                            startTime = parseTime(timeSpans[0].innerText);
                            endTime = parseTime(timeSpans[1].innerText);
                        } else if (timeSpans.length === 1) {
                            startTime = parseTime(timeSpans[0].innerText);
                        } else {
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
                            programs.push({
                                title,
                                subTitle,
                                startTS: startTime,
                                endTS: endTime
                            });
                        }
                    });

                    results.push({ callSign, channel, programs });
                });

                return results;
            }, currentLatestTime); // passing currentLatestTime to act as a rolling base date

            // Merge block data and deduplicate
            let maxEndTimeSeenInBlock = currentLatestTime;

            blockData.forEach(station => {
                let existingStation = scheduleData.find(s => s.callSign === station.callSign && s.channel === station.channel);
                if (!existingStation) {
                    existingStation = { callSign: station.callSign, channel: station.channel, programs: [] };
                    scheduleData.push(existingStation);
                }

                station.programs.forEach(prog => {
                    if (!prog.startTS || !prog.endTS) return;
                    // Update loop boundary criteria
                    if (prog.endTS > maxEndTimeSeenInBlock) {
                        maxEndTimeSeenInBlock = prog.endTS;
                    }

                    const formatLocalISO = (ts) => {
                        if (!ts) return null;
                        const d = new Date(ts);
                        const pad = (n) => n.toString().padStart(2, '0');
                        const offset = -d.getTimezoneOffset();
                        const sign = offset >= 0 ? '+' : '-';
                        const absOffset = Math.abs(offset);
                        const offsetHours = pad(Math.floor(absOffset / 60));
                        const offsetMins = pad(absOffset % 60);
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000${sign}${offsetHours}:${offsetMins}`;
                    };

                    // Deduplicate based on station text and start time
                    const uKey = `${existingStation.callSign}-${prog.title}-${prog.startTS}`;
                    if (!seenProgramKeys.has(uKey)) {
                        seenProgramKeys.add(uKey);
                        existingStation.programs.push({
                            title: prog.title,
                            subTitle: prog.subTitle,
                            startDateTime: formatLocalISO(prog.startTS),
                            endDateTime: formatLocalISO(prog.endTS)
                        });
                    }
                });
            });

            // Check if we advanced in time, or if we've reached our goal
            if (maxEndTimeSeenInBlock > currentLatestTime) {
                currentLatestTime = maxEndTimeSeenInBlock;
            } else if (loopCount > 1) { // Failsafe if we aren't moving forward
                console.log(`[AntennaWeb] Time boundary stalled at ${new Date(currentLatestTime).toLocaleString()}`);
                break;
            }

            if (currentLatestTime >= endTS) {
                console.log(`[AntennaWeb] Reached end time horizon: ${new Date(currentLatestTime).toLocaleString()}`);
                break;
            }

            // Click the Next icon
            console.log(`[AntennaWeb] Clicking Next Page...`);
            const clicked = await scheduleFrame.evaluate(() => {
                const svgs = Array.from(document.querySelectorAll('svg'));
                for (const svg of svgs) {
                    if (svg.innerHTML && svg.innerHTML.includes('200.732')) { // specific path coordinate of forward arrow
                        const clickable = svg.parentElement;
                        if (clickable) {
                            clickable.click();
                            return true;
                        }
                    }
                }
                return false;
            });

            if (!clicked) {
                console.log(`[AntennaWeb] Failed to find Next arrow. Breaking.`);
                break;
            }

            // Wait for new data to render
            await delay(4000);
        }

        console.log(`[AntennaWeb] Extracted schedule for ${scheduleData.length} stations across ${loopCount} time blocks.`);
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
