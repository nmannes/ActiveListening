/**
 * site_handlers.js
 *
 * Contains site-specific browser interaction logic (logins, registration, specialized clicks).
 */

const { getIdentity } = require("./identity");

const handlers = [
  {
    name: "Q4 Analytics",
    match: (url) => url.includes("q4inc.com"),
    handle: async (page, logger) => {
      try {
        const identity = getIdentity();
        const emailInput = await page.$(
          '[data-id="AlreadyRegisteredFormEmail"] input, [data-id="GuestRegistrationFormEmail"] input',
        );
        if (emailInput) {
          logger.info(
            `[handler] Q4/ChorusCall registration form detected, auto-filling...`,
          );
          await emailInput.type(identity.email, { delay: 50 });
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
        const identity = getIdentity();
        // Wait for the form or player to appear
        await page.waitForSelector(
          'input, select, .vjs-big-play-button, .theoplayer-container',
          { timeout: 10000 },
        );

        // Advanced registration form handling
        const registrationHandled = await page.evaluate(async (identity) => {
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select'));
          if (inputs.length === 0) return false;

          const getLabel = (el) => {
            if (el.id) {
              const label = document.querySelector(`label[for="${el.id}"]`);
              if (label) return label.innerText.toLowerCase();
            }
            let parent = el.parentElement;
            while (parent && parent.tagName !== 'FORM' && parent.tagName !== 'BODY') {
              if (parent.tagName === 'LABEL') return parent.innerText.toLowerCase();
              const labelChild = parent.querySelector('label');
              if (labelChild) return labelChild.innerText.toLowerCase();
              parent = parent.parentElement;
            }
            return '';
          };

          const getFieldType = (el) => {
            const label = getLabel(el);
            const placeholder = (el.placeholder || '').toLowerCase();
            const name = (el.name || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const combined = `${label} ${placeholder} ${name} ${id} ${aria}`;

            if (combined.includes('first')) return 'firstName';
            if (combined.includes('last')) return 'lastName';
            if (combined.includes('email')) return 'email';
            if (combined.includes('company') || combined.includes('organization')) return 'company';
            if (combined.includes('country')) return 'country';
            if (el.type === 'checkbox' && (combined.includes('privacy') || combined.includes('terms') || combined.includes('accept'))) return 'privacy';
            
            // Fallback for types
            if (el.type === 'email') return 'email';
            return null;
          };

          let filledCount = 0;
          for (const el of inputs) {
            const fieldType = getFieldType(el);
            if (!fieldType) continue;

            if (el.tagName === 'SELECT') {
              const options = Array.from(el.options);
              // Try configured country, or Uganda (from user prompt), or US
              let targetOption = options.find(o => o.text.includes(identity.country) || o.value.includes(identity.country));
              if (!targetOption) targetOption = options.find(o => o.text.includes('Uganda') || o.value.includes('UG'));
              if (!targetOption) targetOption = options.find(o => o.text.includes('United States') || o.value.includes('US'));
              if (!targetOption && options.length > 1) targetOption = options[1]; // Skip first if it's "Select..."
              
              if (targetOption) {
                el.value = targetOption.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
              }
            } else if (el.type === 'checkbox' || el.type === 'radio') {
              if (!el.checked) {
                el.click();
                filledCount++;
              }
            } else {
              let val = identity[fieldType] || 'n/a';

              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
              filledCount++;
            }
          }

          if (filledCount > 0) {
            const submitBtn = document.querySelector('button[type="submit"], .btn-primary, #submit, .submit-button, button.primary, .registration-submit');
            if (submitBtn) {
              submitBtn.click();
              return true;
            }
          }
          return false;
        }, identity);

        if (registrationHandled) {
          logger.info(`[handler] Registration form identified and submitted.`);
          await new Promise((r) => setTimeout(r, 5000));
        }

        // Handle Playback (THEOplayer / VideoJS)
        logger.info(`[handler] Ensuring Media-Server audio is playing...`);
        await page.evaluate(() => {
          const playInterval = setInterval(() => {
            const bigPlay = document.querySelector(".vjs-big-play-button, .theoplayer-big-play-button");
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
              '.vjs-mute-control, .theo-mute-control, [aria-label="Unmute"], [title="Unmute"]',
            );
            if (
              muteBtn &&
              (muteBtn.classList.contains("vjs-vol-muted") ||
                muteBtn.classList.contains("theo-vol-muted") ||
                muteBtn.title === "Unmute" ||
                muteBtn.getAttribute("aria-label") === "Unmute")
            ) {
              muteBtn.click();
              console.log("[handler] Clicked unmute button");
            }

            // Try to set volume slider to max if it exists
            const volLevel = document.querySelector(".vjs-volume-level, .theo-volume-level");
            if (volLevel) {
              volLevel.style.width = "100%";
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
          const identity = getIdentity();
          logger.info(`[handler] Filling Chorus Call registration form...`);
          await page.type("#firstName", identity.firstName, { delay: 50 });
          await page.type("#lastName", identity.lastName, { delay: 50 });
          await page.type("#email", identity.email, { delay: 50 });
          await page.type("#company", identity.company, { delay: 50 });

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
          const identity = getIdentity();
          logger.info(`[handler] Filling Webcasts.com registration form...`);
          await emailInput.type(identity.email, { delay: 50 });

          // Optional: If there are other text inputs (first name/last name), fill them
          const textInputs = await page.$$('input[type="text"]');
          let idx = 0;
          for (const input of textInputs) {
            if (idx === 0) await input.type(identity.firstName, { delay: 50 });
            else if (idx === 1) await input.type(identity.lastName, { delay: 50 });
            else await input.type(identity.company, { delay: 50 });
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
                    if (el.paused) el.play().catch(() => { });
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
                } catch (e) { }
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
  {
    name: "YouTube TV",
    match: (url) => url.includes("tv.youtube.com"),
    handle: async (page, logger) => {
      logger.info(`[handler] YouTube TV detected, ensuring playback...`);
      try {
        // Wait for the video or any play button
        await page.waitForSelector("video, .play-button, [aria-label='Play']", {
          timeout: 15000,
        });

        await page.evaluate(() => {
          const clicker = setInterval(() => {
            const video = document.querySelector("video");
            if (video && video.paused) {
              video.muted = false;
              video.play().catch(() => { });
            }

            // Look for play buttons
            const playButtons = [
              ...document.querySelectorAll("button"),
              ...document.querySelectorAll("[role='button']"),
            ].filter(
              (b) =>
                b.textContent.toLowerCase().includes("play") ||
                b.getAttribute("aria-label")?.toLowerCase().includes("play"),
            );

            playButtons.forEach((btn) => {
              const style = getComputedStyle(btn);
              if (style.display !== "none" && style.visibility !== "hidden") {
                btn.click();
              }
            });
          }, 2000);
          window._yttvClicker = clicker;
        });
      } catch (e) {
        logger.debug(`[handler] YouTube TV interaction error: ${e.message}`);
      }
    },
  },
  {
    name: "Amazon Prime Video",
    match: (url) => url.includes("amazon.com"),
    handle: async (page, logger) => {
      logger.info(`[handler] Amazon Prime Video detected, ensuring playback...`);
      try {
        // Warm-up click to satisfy user interaction requirements for autoplay
        await page.click("body").catch(() => { });

        // Wait for the video or any play button
        await page.waitForSelector("video, .atv-player-container, .play-button, [aria-label='Play']", {
          timeout: 15000,
        });

        await page.evaluate(() => {
          const clicker = setInterval(() => {
            const video = document.querySelector("video");
            const initialClicked = window._amazonInitialClicked || false;
            
            if (video && video.paused) {
              video.muted = false;
              video.play().catch(() => {});
            }

            // Look for play buttons
            const playButtons = [
              ...document.querySelectorAll("button"),
              ...document.querySelectorAll("[role='button']"),
              ...document.querySelectorAll(".atv-player-container div"),
            ].filter(
              (b) => {
                const text = b.textContent.toLowerCase();
                const aria = b.getAttribute("aria-label")?.toLowerCase() || "";

                // Exclude close buttons or anything that might stop/close
                if (text.includes("close") || aria.includes("close")) return false;

                const match = text.includes("play") ||
                  text.includes("resume") ||
                  text.includes("watch live") ||
                  text.includes("watch now") ||
                  aria.includes("play") ||
                  aria.includes("watch live") ||
                  aria.includes("watch now") ||
                  aria.includes("watch");
                return match;
              }
            );

            // Click if paused OR if we haven't clicked once yet
            if (!video || video.paused || !initialClicked) {
              playButtons.forEach((btn) => {
                const style = getComputedStyle(btn);
                if (style.display !== "none" && style.visibility !== "hidden") {
                  console.log("[handler] Clicking Amazon play/watch button:", btn.textContent || btn.getAttribute("aria-label"));
                  btn.click();
                  window._amazonInitialClicked = true;
                }
              });
            }

            // Handle unmuting
            const unmuteSelectors = [
              '.atp-unmute-button',
              '[aria-label="Unmute"]',
              '.volume-icon.muted',
              '.fu6776',
              '.atv-player-container .volume-button'
            ];

            for (const selector of unmuteSelectors) {
              const btn = document.querySelector(selector);
              if (btn) {
                const style = getComputedStyle(btn);
                if (style.display !== "none" && style.visibility !== "hidden") {
                  const isMuted = btn.classList.contains('muted') || 
                                btn.getAttribute('aria-label')?.toLowerCase().includes('unmute') || 
                                btn.querySelector('.muted');
                  
                  if (isMuted) {
                    console.log("[handler] Clicking Amazon unmute button:", selector);
                    btn.click();
                  }
                }
              }
            }

            // Ensure video is unmuted
            if (video && video.muted) {
              video.muted = false;
            }
            if (video && video.paused) {
              video.play().catch(() => { });
            }
          }, 3000);
          window._amazonClicker = clicker;
        });
      } catch (e) {
        logger.debug(`[handler] Amazon Prime Video interaction error: ${e.message}`);
      }
    },
  },
  {
    name: "ON24",
    match: (url) => url.includes("on24.com"),
    handle: async (page, logger) => {
      logger.info(`[handler] ON24 detected, handling registration and playback...`);
      try {
        // 1. Wait for registration or player
        await page.waitForSelector('input[name="email"], .vjs-play-control, #event_console', {
          timeout: 10000,
        });

        // 2. Handle Registration
        const emailInput = await page.$('input[name="email"]');
        if (emailInput) {
          const identity = getIdentity();
          logger.info(`[handler] Filling ON24 registration form...`);
          await emailInput.type(identity.email, { delay: 50 });
          
          const firstName = await page.$('input[name="firstname"], input[name="first_name"]');
          if (firstName) await firstName.type(identity.firstName, { delay: 50 });
          
          const lastName = await page.$('input[name="lastname"], input[name="last_name"]');
          if (lastName) await lastName.type(identity.lastName, { delay: 50 });

          const submitBtn = await page.$('button[type="submit"], #registration_submit, .reg-submit');
          if (submitBtn) {
            await submitBtn.click();
            logger.info(`[handler] ON24 registration submitted.`);
            await new Promise((r) => setTimeout(r, 5000));
          }
        }

        // 3. Handle Playback
        await page.evaluate(() => {
          const playInterval = setInterval(() => {
            // ON24 often has a "Listen" or "Play" button in an overlay
            const playButtons = [
              ...document.querySelectorAll("button"),
              ...document.querySelectorAll(".vjs-play-control"),
              ...document.querySelectorAll(".play-button"),
              ...document.querySelectorAll('[aria-label="Play"]'),
              ...document.querySelectorAll('[aria-label="Start Webcast"]'),
            ].filter(b => {
              const text = b.textContent.toLowerCase();
              return text.includes("play") || text.includes("listen") || text.includes("start");
            });

            playButtons.forEach(btn => {
              const style = getComputedStyle(btn);
              if (style.display !== "none" && style.visibility !== "hidden") {
                btn.click();
              }
            });

            const video = document.querySelector("video") || document.querySelector("audio");
            if (video && video.paused) {
              video.muted = false;
              video.play().catch(() => {});
            }
          }, 3000);
          window._on24Interval = playInterval;
        });
      } catch (e) {
        logger.debug(`[handler] ON24 interaction error: ${e.message}`);
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
