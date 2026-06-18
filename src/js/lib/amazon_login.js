/**
 * Automates logging into Amazon using provided credentials from process.env.
 * Make sure you load your secrets, e.g., using `require("dotenv").config()`
 * before calling this function, and that AMAZON_USERNAME and AMAZON_PASSWORD are set.
 * 
 * @param {import('puppeteer').Page} page - Puppeteer page instance.
 */
async function loginToAmazon(page) {
    const username = process.env.AMAZON_USERNAME
    const password = process.env.AMAZON_PASSWORD

    if (!username || !password) {
        throw new Error('AMAZON_USERNAME or AMAZON_PASSWORD is not defined in the environment.');
    }

    console.log('Navigating to Amazon...');
    await page.goto('https://www.amazon.com', { waitUntil: 'networkidle2' });

    // Check if we are already on a login page or need to click "Sign in"
    const signInButton = await page.$('#nav-link-accountList');
    const emailInput = await page.$('input[name="email"]');

    if (emailInput) {
        console.log('Already on login page or redirected.');
    } else if (signInButton) {
        console.log('Clicking Sign In...');
        await signInButton.click();
    } else {
        // Fallback: search for any "Sign in" link
        const links = await page.$$('a');
        let clicked = false;
        for (const link of links) {
            const text = await page.evaluate(el => el.innerText, link);
            if (text && text.toLowerCase().includes('sign in')) {
                await link.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) {
            throw new Error('Could not find a Sign In button or link.');
        }
    }

    // Wait for email input (it might already be there)
    console.log('Waiting for email input...');
    await page.waitForSelector('input[name="email"]', { visible: true, timeout: 10000 });
    console.log('Entering email...');
    await page.type('input[name="email"]', username, { delay: 50 });
    
    // Click Continue
    const continueButton = '#continue, .a-button-continue, input#continue';
    await page.waitForSelector(continueButton, { visible: true });
    await page.click(continueButton);

    // Wait for password input or a captcha
    console.log('Waiting for password input...');
    try {
        await page.waitForSelector('input[name="password"]', { visible: true, timeout: 15000 });
        console.log('Entering password...');
        await page.type('input[name="password"]', password, { delay: 50 });
        await page.click('#signInSubmit');
    } catch (e) {
        console.log('Password field not found. Checking for CAPTCHA or other challenge...');
        const captcha = await page.$('input#auth-captcha-guess');
        if (captcha) {
            console.error('CAPTCHA detected. Manual intervention required.');
            return; // Or throw error
        }
        throw e;
    }

    // Wait for navigation and verify login
    console.log('Waiting for login to complete...');
    try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.log('Navigation timed out. Checking current state...');
    }

    // Heuristic check: see if "Hello, [Name]" appears instead of "Hello, sign in"
    try {
        await page.waitForSelector('#nav-link-accountList-nav-line-1', { timeout: 5000 });
        const accountText = await page.$eval('#nav-link-accountList-nav-line-1', el => el.innerText);
        if (accountText.toLowerCase().includes('sign in')) {
            console.warn('Login might have failed or reached a 2FA requirement.');
        } else {
            console.log(`Successfully logged in as: ${accountText}`);
        }
    } catch (e) {
        console.log('Could not verify account name. Check the browser window.');
    }
}

module.exports = {
    loginToAmazon
};

// Standalone execution for testing
if (require.main === module) {
    (async () => {
        const path = require('path');
        // Load environment variables from .env.prod in the root directory
        const envPath = path.join(__dirname, '..', '..', '..', '.env.prod');
        console.log(`Loading environment from: ${envPath}`);
        require('dotenv').config({ path: envPath });

        let puppeteer;
        try {
            puppeteer = require('puppeteer-extra');
            const StealthPlugin = require('puppeteer-extra-plugin-stealth');
            puppeteer.use(StealthPlugin());
        } catch (e) {
            puppeteer = require('puppeteer');
        }

        const browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome",
            headless: false,
            defaultViewport: null,
        });

        const page = await browser.newPage();

        try {
            await loginToAmazon(page);
        } catch (error) {
            console.error('Login failed:', error);
            // Don't close browser so user can see what happened
        }
    })();
}
