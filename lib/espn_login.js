/**
 * Automates logging into ESPN using provided credentials from process.env.
 * Make sure you load your secrets, e.g., using `require("dotenv").config()`
 * before calling this function, and that ESPN_USERNAME and ESPN_PASSWORD are set.
 * 
 * @param {import('puppeteer').Page} page - Puppeteer page instance.
 */
async function loginToESPN(page) {
    const username = process.env.ESPN_USERNAME
    const password = process.env.ESPN_PASSWORD

    if (!username || !password) {
        throw new Error('ESPN_USERNAME or ESPN_PASSWORD is not defined in the environment.');
    }

    await page.goto('https://www.espn.com/login', { waitUntil: 'networkidle2' });

    // ESPN often has a user trigger icon. Find and click it.
    const userTrigger = await page.$('#global-user-trigger');
    if (userTrigger) {
        await userTrigger.click();
        await new Promise(r => setTimeout(r, 1000)); // wait for dropdown animation

        // Click the actual login link inside the user menu
        const loginLink = await page.$('a[data-affiliatename="espn"], .display-user a');
        if (loginLink) {
            await loginLink.click();
        } else {
            // Fallback: search for a generic log in text in the active dropdown or page
            const links = await page.$$('a');
            for (const link of links) {
                const text = await page.evaluate(el => el.innerText, link);
                if (text && text.toLowerCase() === 'log in') {
                    await link.click();
                    break;
                }
            }
        }
    } else {
        const possibleLogins = await page.$$('a');
        for (const link of possibleLogins) {
            const text = await page.evaluate(el => el.innerText, link);
            if (text && text.toLowerCase().includes('log in')) {
                await link.click();
                break;
            }
        }
    }

    const iframeSelector = '#OneidZendeskFrame, #disneyid-iframe, iframe[src*="cdn.registerdisney.go.com"]';

    // Wait for the iframe to actually pop up
    const iframeElement = await page.waitForSelector(iframeSelector, { visible: true, timeout: 30000 });
    const frame = await iframeElement.contentFrame();

    if (!frame) {
        throw new Error('Could not get content frame of the login iframe.');
    }

    const emailSelector = 'input[type="email"]';
    await frame.waitForSelector(emailSelector, { visible: true });
    await frame.type(emailSelector, username, { delay: 50 });

    const continueBtnSelector = 'button[type="submit"], button#BtnSubmit';
    // Sometimes the Disney frame uses the same button selector for both steps
    await frame.click(continueBtnSelector);

    const passwordSelector = 'input[type="password"]';
    await frame.waitForSelector(passwordSelector, { visible: true, timeout: 15000 });

    await frame.type(passwordSelector, password, { delay: 50 });

    await frame.click(continueBtnSelector);

    try {
        await page.waitForFunction(
            (selector) => !document.querySelector(selector),
            { timeout: 30000 },
            iframeSelector
        );
    } catch (e) {
    }
}

module.exports = {
    loginToESPN
};

// Standalone execution for testing
if (require.main === module) {
    (async () => {
        // Load environment variables from .env
        require('dotenv').config();

        let puppeteer;
        try {
            // Try puppeteer-extra with stealth if available
            puppeteer = require('puppeteer-extra');
            const StealthPlugin = require('puppeteer-extra-plugin-stealth');
            puppeteer.use(StealthPlugin());
        } catch (e) {
            // Fallback to standard puppeteer
            puppeteer = require('puppeteer');
        }

        const browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome",
            headless: false, // Default to headful as requested
            defaultViewport: null,
        });

        const page = await browser.newPage();

        try {
            await loginToESPN(page);
        } catch (error) {
            // Optionally close the browser on failure if preferred:
            // await browser.close();
        }
    })();
}
