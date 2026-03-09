/**
 * site_handlers.js
 *
 * Contains site-specific browser interaction logic (logins, registration, specialized clicks).
 */

const handlers = [
    {
        name: 'Q4 Analytics',
        match: (url) => url.includes('q4inc.com') || url.includes('earnings.com') || url.includes('choruscall.com'),
        handle: async (page, logger) => {
            try {
                const emailInput = await page.$('[data-id="AlreadyRegisteredFormEmail"] input, [data-id="GuestRegistrationFormEmail"] input');
                if (emailInput) {
                    logger.info(`[handler] Q4/ChorusCall registration form detected, auto-filling...`);
                    await emailInput.type('nmannes@gmail.com', { delay: 50 });
                    const joinButton = await page.$('[data-id="AlreadyRegisteredFormJoinButton"], [data-id="GuestRegistrationFormRegisterButton"]');
                    if (joinButton) {
                        await joinButton.click();
                        await new Promise(r => setTimeout(r, 5000));
                    }
                }
            } catch (e) {
                logger.debug(`[handler] Q4 logic failed: ${e.message}`);
            }
        }
    },
    {
        name: 'Media-Server',
        match: (url) => url.includes('media-server.com'),
        handle: async (page, logger) => {
            logger.info(`[handler] Media-Server detected, handling registration...`);
            try {
                // Wait for the form or player to appear
                await page.waitForSelector('input[id^="input_"], .vjs-big-play-button', { timeout: 10000 });

                // Check if registration form is present
                const firstName = await page.$('input[id^="input_1190151"]');
                if (firstName) {
                    logger.info(`[handler] Filling Media-Server registration form...`);
                    await page.type('input[id*="1190151"]', 'nathan', { delay: 50 });
                    await page.type('input[id*="1190152"]', 'mannes', { delay: 50 });
                    await page.type('input[id*="1190153"]', 'nmannes@gmail.com', { delay: 50 });
                    await page.type('input[id*="1190154"]', 'n/a', { delay: 50 });

                    const submitBtn = await page.$('button[type="submit"], .btn-primary');
                    if (submitBtn) {
                        await submitBtn.click();
                        logger.info(`[handler] Registration submitted.`);
                        await new Promise(r => setTimeout(r, 5000));
                    }
                }

                // Handle Playback (THEOplayer)
                logger.info(`[handler] Ensuring Media-Server audio is playing...`);
                await page.evaluate(() => {
                    const playInterval = setInterval(() => {
                        const bigPlay = document.querySelector('.vjs-big-play-button');
                        if (bigPlay && getComputedStyle(bigPlay).display !== 'none') {
                            bigPlay.click();
                            console.log('[handler] Clicked big play button');
                        }

                        const video = document.querySelector('video');
                        if (video && video.paused) {
                            video.muted = false;
                            video.play().catch(e => console.log('playback error:', e.message));
                        }

                        // If it's playing and the big play button is gone, we're likely good
                        if (video && !video.paused) {
                            // Stay alive to ensure it keeps playing if there's an interrupt
                        }
                    }, 2000);
                    window._mediaServerInterval = playInterval;
                });

            } catch (e) {
                logger.debug(`[handler] Media-server custom interaction error: ${e.message}`);
            }
        }
    },
    {
        name: 'Chorus Call Mediaframe',
        match: (url) => url.includes('event.choruscall.com/mediaframe'),
        handle: async (page, logger) => {
            logger.info(`[handler] Chorus Call Mediaframe detected, handling registration...`);
            try {
                // Wait for either the registration form or the player
                await page.waitForSelector('#firstName, .vjs-play-control', { timeout: 10000 });

                const firstNameInput = await page.$('#firstName');
                if (firstNameInput) {
                    logger.info(`[handler] Filling Chorus Call registration form...`);
                    await page.type('#firstName', 'nathan', { delay: 50 });
                    await page.type('#lastName', 'mannes', { delay: 50 });
                    await page.type('#email', 'nmannes@gmail.com', { delay: 50 });
                    await page.type('#company', 'n/a', { delay: 50 });

                    // Specific to Chorus Call dropdown requirements
                    try {
                        await page.select('#udef1', 'Other');
                    } catch (e) {
                        logger.debug(`[handler] Affiliation dropdown not found or failed: ${e.message}`);
                    }

                    const submitBtn = await page.$('#registrationSubmit');
                    if (submitBtn) {
                        await submitBtn.click();
                        logger.info(`[handler] Chorus Call registration submitted.`);
                        await new Promise(r => setTimeout(r, 5000));
                    }
                }

                // Webcast Playback (VideoJS)
                logger.info(`[handler] Ensuring Chorus Call audio is playing...`);
                await page.evaluate(() => {
                    const playInterval = setInterval(() => {
                        const video = document.querySelector('video');
                        const playBtn = document.querySelector('.vjs-play-control');

                        if (video && video.paused) {
                            video.muted = false;
                            if (playBtn) playBtn.click();
                            video.play().catch(e => console.log('playback error:', e.message));
                        }

                        if (video && !video.paused) {
                            // Audio is running
                        }
                    }, 5000);
                    window._chorusCallInterval = playInterval;
                });

            } catch (e) {
                logger.debug(`[handler] Chorus Call interaction error: ${e.message}`);
            }
        }
    }
];

/**
 * Executes the appropriate handler for the given URL.
 */
async function runSiteHandlers(url, page, logger) {
    for (const handler of handlers) {
        if (handler.match(url)) {
            logger.info(`[browser] Running specialized handler: ${handler.name}`);
            await handler.handle(page, logger);
            return;
        }
    }
    logger.debug(`[browser] No specialized handler found for ${url}`);
}

module.exports = { runSiteHandlers };
