/**
 * site_handlers.js
 *
 * Contains site-specific browser interaction logic (logins, registration, specialized clicks).
 */

const handlers = [
  {
    name: "Q4 Analytics",
    match: (url) => url.includes("q4inc.com"),
    handle: async (page, logger) => {
      try {
        const emailInput = await page.$(
          '[data-id="AlreadyRegisteredFormEmail"] input, [data-id="GuestRegistrationFormEmail"] input',
        );
        if (emailInput) {
          logger.info(
            `[handler] Q4/ChorusCall registration form detected, auto-filling...`,
          );
          await emailInput.type("nmannes@gmail.com", { delay: 50 });
          const joinButton = await page.$(
            '[data-id="AlreadyRegisteredFormJoinButton"], [data-id="GuestRegistrationFormRegisterButton"]',
          );
          if (joinButton) {
            await joinButton.click();
            await new Promise((r) => setTimeout(r, 5000));
          }
        }
      } catch (e) {
        logger.debug(`[handler] Q4 logic failed: ${e.message}`);
      }
    },
  },
  {
    name: "Media-Server",
    match: (url) => url.includes("media-server.com"),
    handle: async (page, logger) => {
      logger.info(`[handler] Media-Server detected, handling registration...`);
      try {
        // Wait for the form or player to appear
        await page.waitForSelector(
          'input[id^="input_"], .vjs-big-play-button',
          { timeout: 10000 },
        );

        // Check if registration form is present
        // Media-Server forms often have dynamic IDs.
        // We'll look for input fields generally, or use labels if possible.
        const inputs = await page.$$('input[type="text"], input[type="email"]');
        if (inputs.length >= 3) {
          logger.info(
            `[handler] Filling Media-Server registration form (found ${inputs.length} inputs)...`,
          );

          // Best effort mapping based on typical order: First Name, Last Name, Email, Company
          try {
            let textInputIdx = 0;
            for (const input of inputs) {
              const type = await page.evaluate((el) => el.type, input);
              if (type === "email") {
                await input.type("nmannes@gmail.com", { delay: 50 });
              } else if (type === "text") {
                if (textInputIdx === 0)
                  await input.type("nathan", { delay: 50 });
                else if (textInputIdx === 1)
                  await input.type("mannes", { delay: 50 });
                else await input.type("n/a", { delay: 50 });
                textInputIdx++;
              }
            }
          } catch (e) {
            logger.debug(`[handler] Failed to fill some inputs: ${e.message}`);
          }

          const submitBtn = await page.$('button[type="submit"], .btn-primary');
          if (submitBtn) {
            await submitBtn.click();
            logger.info(`[handler] Registration submitted.`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        } else {
          logger.info(
            `[handler] Registration form not found or already registered.`,
          );
        }

        // Handle Playback (THEOplayer)
        logger.info(`[handler] Ensuring Media-Server audio is playing...`);
        await page.evaluate(() => {
          const playInterval = setInterval(() => {
            const bigPlay = document.querySelector(".vjs-big-play-button");
            if (bigPlay && getComputedStyle(bigPlay).display !== "none") {
              bigPlay.click();
              console.log("[handler] Clicked big play button");
            }

            const video = document.querySelector("video");
            if (video && video.paused) {
              video.muted = false;
              video
                .play()
                .catch((e) => console.log("playback error:", e.message));
            }

            // Try to click any mute/unmute buttons to ensure audio flows
            const muteBtn = document.querySelector(
              '.vjs-mute-control, [aria-label="Unmute"], [title="Unmute"]',
            );
            if (
              muteBtn &&
              (muteBtn.classList.contains("vjs-vol-muted") ||
                muteBtn.title === "Unmute" ||
                muteBtn.getAttribute("aria-label") === "Unmute")
            ) {
              muteBtn.click();
              console.log("[handler] Clicked unmute button");
            }

            // Try to set volume slider to max if it exists
            const volLevel = document.querySelector(".vjs-volume-level");
            if (volLevel) {
              volLevel.style.width = "100%";
            }

            // If it's playing and the big play button is gone, we're likely good
            if (video && !video.paused) {
              // Stay alive to ensure it keeps playing if there's an interrupt
            }
          }, 2000);
          window._mediaServerInterval = playInterval;
        });
      } catch (e) {
        logger.debug(
          `[handler] Media-server custom interaction error: ${e.message}`,
        );
      }
    },
  },
  {
    name: "Chorus Call Mediaframe",
    match: (url) => url.includes("event.choruscall.com/mediaframe"),
    handle: async (page, logger) => {
      logger.info(
        `[handler] Chorus Call Mediaframe detected, handling registration...`,
      );
      try {
        // Wait for either the registration form or the player
        await page.waitForSelector("#firstName, .vjs-play-control", {
          timeout: 10000,
        });

        const firstNameInput = await page.$("#firstName");
        if (firstNameInput) {
          logger.info(`[handler] Filling Chorus Call registration form...`);
          await page.type("#firstName", "nathan", { delay: 50 });
          await page.type("#lastName", "mannes", { delay: 50 });
          await page.type("#email", "nmannes@gmail.com", { delay: 50 });
          await page.type("#company", "n/a", { delay: 50 });

          // Specific to Chorus Call dropdown requirements
          try {
            await page.select("#udef1", "Other");
          } catch (e) {
            logger.debug(
              `[handler] Affiliation dropdown not found or failed: ${e.message}`,
            );
          }

          const submitBtn = await page.$("#registrationSubmit");
          if (submitBtn) {
            await submitBtn.click();
            logger.info(`[handler] Chorus Call registration submitted.`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }

        // Webcast Playback (VideoJS)
        logger.info(`[handler] Ensuring Chorus Call audio is playing...`);
        await page.evaluate(() => {
          const playInterval = setInterval(() => {
            const video = document.querySelector("video");
            const playBtn = document.querySelector(".vjs-play-control");

            if (video && video.paused) {
              video.muted = false;
              if (playBtn) playBtn.click();
              video
                .play()
                .catch((e) => console.log("playback error:", e.message));
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
    },
  },
  {
    name: "OpenExchange",
    match: (url) => url.includes("open-exchange.net"),
    handle: async (page, logger) => {
      logger.info(`[handler] OpenExchange detected, handling playback...`);
      try {
        // Ensure audio/video plays
        await page.evaluate(() => {
          const playInterval = setInterval(() => {
            const bigPlay = document.querySelector(".vjs-big-play-button");
            if (bigPlay && getComputedStyle(bigPlay).display !== "none") {
              bigPlay.click();
              console.log("[handler] Clicked big play button");
            }

            const video = document.querySelector("video");
            if (video && video.paused) {
              video.muted = false;
              video
                .play()
                .catch((e) => console.log("playback error:", e.message));
            }
          }, 2000);
          window._openExchangeInterval = playInterval;
        });
      } catch (e) {
        logger.debug(`[handler] OpenExchange interaction error: ${e.message}`);
      }
    },
  },
  {
    name: "Webcasts.com",
    match: (url) => url.includes("event.webcasts.com"),
    handle: async (page, logger) => {
      logger.info(`[handler] Webcasts.com detected, handling registration...`);
      try {
        // Wait for either the form or the player
        await page.waitForSelector('input[type="email"], video', {
          timeout: 10000,
        });

        const emailInput = await page.$('input[type="email"]');
        if (emailInput) {
          logger.info(`[handler] Filling Webcasts.com registration form...`);
          await emailInput.type("nmannes@gmail.com", { delay: 50 });

          // Optional: If there are other text inputs (first name/last name), fill them
          const textInputs = await page.$$('input[type="text"]');
          let idx = 0;
          for (const input of textInputs) {
            if (idx === 0) await input.type("nathan", { delay: 50 });
            else if (idx === 1) await input.type("mannes", { delay: 50 });
            else await input.type("n/a", { delay: 50 });
            idx++;
          }

          const submitBtn = await page.$(
            '.buttonSubmit, button[type="submit"]',
          );
          if (submitBtn) {
            await submitBtn.click();
            logger.info(`[handler] Webcasts.com registration submitted.`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }

        // Ensure Audio plays
        logger.info(`[handler] Ensuring Webcasts.com audio is playing...`);
        await page.evaluate(() => {
          const playInterval = setInterval(() => {
            const video = document.querySelector("video");
            if (video && video.paused) {
              video.muted = false;
              video
                .play()
                .catch((e) => console.log("playback error:", e.message));
            }

            const muteBtn = document.querySelector(
              '.vjs-mute-control, [aria-label="Unmute"], [title="Unmute"]',
            );
            if (
              muteBtn &&
              (muteBtn.classList.contains("vjs-vol-muted") ||
                muteBtn.title === "Unmute" ||
                muteBtn.getAttribute("aria-label") === "Unmute")
            ) {
              muteBtn.click();
              console.log("[handler] Clicked unmute button");
            }
          }, 3000);
          window._webcastsInterval = playInterval;
        });
      } catch (e) {
        logger.debug(`[handler] Webcasts.com interaction error: ${e.message}`);
      }
    },
  },
  {
    name: "ESPN",
    match: (url) => url.includes("espn.com"),
    handle: async (page, logger) => {
      logger.info(`[handler] ESPN detected, handling playback...`);
      try {
        // Wait for the video or a play button
        await page.waitForSelector("video, .play-button, .video-player", {
          timeout: 15000,
        });

        // Aggressive clicker loop
        await page.evaluate(() => {
          const clicker = setInterval(() => {
            const searchAndClick = (root) => {
              // 1. Handle common overlays/blockers
              const overlays = [
                ".video-overlay",
                ".ad-badge-overlay--badge",
                ".click-to-listen",
                '[aria-label="Close"]',
                ".dismiss",
                'button:contains("READY. SET. STREAM.")', // pseudo
              ];

              // Direct text matching for "READY. SET. STREAM." or similar
              const allButtons = root.querySelectorAll(
                'button, div[role="button"]',
              );
              allButtons.forEach((btn) => {
                if (
                  btn.textContent.includes("READY. SET. STREAM.") ||
                  btn.textContent.includes("Close")
                ) {
                  btn.click();
                }
              });

              const selectors = [
                "video",
                ".play-button",
                ".video-player",
                '[aria-label="Play"]',
                '[aria-label="Unmute"]',
                ".click-to-listen",
              ];

              for (const selector of selectors) {
                const els = root.querySelectorAll(selector);
                els.forEach((el) => {
                  if (el.tagName === "VIDEO") {
                    if (el.paused) el.play().catch(() => {});
                    if (el.muted) el.muted = false;
                    // Proactively resume AudioContext on video play
                    if (
                      window.AudioContext &&
                      window._audioCtx &&
                      window._audioCtx.state !== "running"
                    ) {
                      window._audioCtx.resume();
                    }
                  } else {
                    const style = getComputedStyle(el);
                    if (
                      style.display !== "none" &&
                      style.visibility !== "hidden"
                    ) {
                      el.click();
                    }
                  }
                });
              }

              // 2. Recurse into iframes
              const iframes = root.querySelectorAll("iframe");
              for (const iframe of iframes) {
                try {
                  if (iframe.contentDocument) {
                    searchAndClick(iframe.contentDocument);
                  }
                } catch (e) {}
              }
            };

            searchAndClick(document);
          }, 2000);

          window._espnClicker = clicker;
        });
      } catch (e) {
        logger.debug(`[handler] ESPN interaction error: ${e.message}`);
      }
    },
  },
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
