/**
 * site_handlers.js
 *
 * Contains site-specific browser interaction logic (logins, registration, specialized clicks).
 * When no domain-specific handler matches, falls back to an AI-driven handler that uses Claude
 * to inspect the page and decide what to click/fill.
 */

const Anthropic = require("@anthropic-ai/sdk");
const { getIdentity } = require("./identity");

// Load env before creating the Anthropic client
const KALSHI_ENV = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : process.env.KALSHI_ENV || "prod";
require("dotenv").config({ path: `.env.${KALSHI_ENV}`, quiet: true });

const anthropic = new Anthropic(); // picks up ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL from env
const MAX_AI_ROUNDS = 3;

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
            if (el.type === 'tel' || combined.includes('phone') || combined.includes('mobile')) return 'phone';
            if (combined.includes('zip') || combined.includes('postal')) return 'zip';
            if (combined.includes('city') || combined.includes('town')) return 'city';
            if (combined.includes('state') || combined.includes('province') || combined.includes('region')) return 'state';
            if (combined.includes('job title') || combined.includes('job role') || combined.includes('job function') || combined.includes('position')) return 'jobTitle';
            if (combined.includes('industry') || combined.includes('sector')) return 'industry';
            if (combined.includes('title') || combined.includes('role')) return 'jobTitle';

            // Fallback for types
            if (el.type === 'email') return 'email';
            return null;
          };

          const isRequired = (el) => {
            if (el.required) return true;
            if (el.getAttribute('aria-required') === 'true') return true;
            const labelText = getLabel(el);
            if (/\*/.test(labelText)) return true;
            let p = el.parentElement;
            while (p && p.tagName !== 'BODY' && p.tagName !== 'FORM') {
              if (p.querySelector('.required, .mandatory, .asterisk, [class*="required"], [class*="mandatory"]')) return true;
              p = p.parentElement;
            }
            return false;
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

          // Second pass: fill required fields missed by the main loop
          const DEFAULTS = {
            phone: "555-0100", zip: "10001", city: "New York", state: "NY",
            jobTitle: "Analyst", industry: "Finance", country: "United States",
          };
          const visibleInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(el => {
            if (!el.offsetParent) return false;
            const s = getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden';
          });
          for (const el of visibleInputs) {
            if (el.disabled || el.readOnly) continue;
            if (!isRequired(el)) continue;
            if (el.tagName !== 'SELECT' && el.value && el.value.trim()) continue;
            const ft = getFieldType(el) || 'generic';
            const val = DEFAULTS[ft] || identity[ft];
            if (!val) {
              // Truly unknown required field — fill with type-appropriate catch-all
              if (el.tagName === 'SELECT') {
                const opt = Array.from(el.options).find(o => !/select|choose/i.test(o.text));
                if (opt) { el.value = opt.value; el.dispatchEvent(new Event('change', { bubbles: true })); filledCount++; }
              } else if (el.type === 'checkbox') {
                if (!el.checked) { el.click(); filledCount++; }
              } else if (el.type === 'number' || el.type === 'tel') {
                el.value = '0';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
              } else {
                el.value = 'n/a';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
                filledCount++;
              }
              continue;
            }
            if (el.tagName === 'SELECT') {
              const match = Array.from(el.options).find(o =>
                o.text.toLowerCase().includes(val.toLowerCase()) ||
                o.value.toLowerCase().includes(val.toLowerCase())
              );
              if (match) {
                if (match.index === 0 && /select|choose/i.test(match.text)) continue;
                el.value = match.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                filledCount++;
              } else if (el.options.length > 1) {
                const opt = Array.from(el.options).find(o => !/select|choose/i.test(o.text));
                if (opt) {
                  el.value = opt.value;
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  filledCount++;
                }
              }
            } else if (el.type === 'checkbox') {
              if (!el.checked) { el.click(); filledCount++; }
            } else {
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

// ── Frame-aware helpers ─────────────────────────────────────────────────
// Most pages are single-frame, but earnings webcasts often embed the player
// in an iframe. These helpers transparently search all frames so both the
// auto-fill and Claude-driven actions work without iframe-specific logic.

async function autoFillInFrame(frame, fields, logger) {
  return frame.evaluate((fields) => {
    const clicked = [];
    const filled = [];

    function isVisible(el) {
      if (!el || !el.offsetParent) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden";
    }
    function detectFieldType(el) {
      const label = (() => {
        if (el.id) {
          const lbl = document.querySelector(`label[for="${el.id}"]`);
          if (lbl) return lbl.textContent.toLowerCase();
        }
        let p = el.parentElement;
        while (p && p.tagName !== "BODY") {
          const lbl = p.querySelector("label");
          if (lbl) return lbl.textContent.toLowerCase();
          p = p.parentElement;
        }
        return "";
      })();
      const combined = `${label} ${(el.placeholder || "").toLowerCase()} ${(el.name || "").toLowerCase()} ${(el.id || "").toLowerCase()} ${(el.getAttribute("aria-label") || "").toLowerCase()}`;
      if (el.type === "email" || combined.includes("email") || combined.includes("e-mail")) return "email";
      if (combined.includes("first")) return "firstName";
      if (combined.includes("last") || combined.includes("surname")) return "lastName";
      if (combined.includes("company") || combined.includes("organization") || combined.includes("organisation")) return "company";
      if (el.type === "tel" || combined.includes("phone") || combined.includes("mobile")) return "phone";
      if (combined.includes("zip") || combined.includes("postal")) return "zip";
      if (combined.includes("city") || combined.includes("town")) return "city";
      if (combined.includes("state") || combined.includes("province") || combined.includes("region")) return "state";
      if (combined.includes("country") || combined.includes("nation")) return "country";
      if (combined.includes("job title") || combined.includes("job role") || combined.includes("job function") || combined.includes("position")) return "jobTitle";
      if (combined.includes("industry") || combined.includes("sector")) return "industry";
      if (combined.includes("title") || combined.includes("role")) return "jobTitle";
      return null;
    }
    function isRequired(el) {
      if (el.required) return true;
      if (el.getAttribute("aria-required") === "true") return true;
      // Check parent label for red-asterisk marker (*)
      const labelText = (() => {
        if (el.id) {
          const lbl = document.querySelector(`label[for="${el.id}"]`);
          if (lbl) return lbl.textContent || "";
        }
        let p = el.parentElement;
        while (p && p.tagName !== "BODY") {
          if (p.tagName === "LABEL") return p.textContent || "";
          const lbl = p.querySelector("label");
          if (lbl) return lbl.textContent || "";
          p = p.parentElement;
        }
        return "";
      })();
      if (/\*/.test(labelText)) return true;
      // Walk up to check for .required / .mandatory indicator elements
      let p = el.parentElement;
      while (p && p.tagName !== "BODY" && p.tagName !== "FORM") {
        if (p.querySelector(".required, .mandatory, .asterisk, [class*='required'], [class*='mandatory']")) return true;
        p = p.parentElement;
      }
      return false;
    }

    for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      if (!isVisible(el) || el.disabled || el.readOnly) continue;
      const ft = detectFieldType(el);
      if (!ft) continue;
      if (el.tagName === "SELECT") {
        const val = fields[ft];
        if (!val) continue;
        const match = Array.from(el.options).find(o => o.text.toLowerCase().includes(val.toLowerCase()) || o.value.toLowerCase().includes(val.toLowerCase()));
        if (match) { el.value = match.value; el.dispatchEvent(new Event("change", { bubbles: true })); filled.push(`select.${ft}`); }
      } else if (el.type === "checkbox") {
        if (!el.checked) { el.click(); filled.push(`checkbox.${ft}`); }
      } else {
        el.value = fields[ft] || "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filled.push(`input.${ft}`);
      }
    }

    for (const btn of document.querySelectorAll("button, a")) {
      if (!isVisible(btn)) continue;
      const text = (btn.textContent || "").toLowerCase().trim();
      if (/^(accept all|accept|ok|i agree|agree|allow all|allow|got it|yes|continue|close)$/i.test(text)) {
        btn.click(); clicked.push("cookie:" + text.slice(0, 30)); break;
      }
    }

    if (filled.length > 0) {
      for (const form of document.querySelectorAll("form")) {
        const btn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
        if (btn && isVisible(btn)) { btn.click(); clicked.push("submit:" + (btn.textContent || "").trim().slice(0, 30)); break; }
      }
    }

    for (const btn of document.querySelectorAll("button, a, [role='button']")) {
      if (!isVisible(btn)) continue;
      const text = (btn.textContent || "").toLowerCase().trim();
      if (/^(play|listen|watch live|watch now|start|launch webcast|begin|join live|join webcast|audio|listen live|stream)$/i.test(text)) {
        btn.click(); clicked.push("play:" + text.slice(0, 30)); break;
      }
    }

    // Second pass: fill required fields that were missed (red asterisk, etc.)
    const DEFAULTS = {
      phone: "555-0100", zip: "10001", city: "New York", state: "NY",
      jobTitle: "Analyst", industry: "Finance", country: "United States",
    };
    for (const el of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
      if (!isVisible(el) || el.disabled || el.readOnly) continue;
      if (!isRequired(el)) continue;
      if (el.tagName !== "SELECT" && el.value && el.value.trim()) continue;
      const ft = detectFieldType(el) || "generic";
      const val = DEFAULTS[ft] || fields[ft];
      if (!val) {
        // Truly unknown required field — fill with type-appropriate catch-all
        if (el.tagName === "SELECT") {
          const opt = Array.from(el.options).find(o => !/select|choose/i.test(o.text));
          if (opt) {
            el.value = opt.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            filled.push("required.unknown-select");
          }
        } else if (el.type === "checkbox") {
          if (!el.checked) { el.click(); filled.push("required.unknown-checkbox"); }
        } else if (el.type === "number" || el.type === "tel") {
          el.value = "0";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          filled.push("required.unknown-number");
        } else {
          el.value = "n/a";
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
          filled.push("required.unknown-text");
        }
        continue;
      }
      if (el.tagName === "SELECT") {
        const match = Array.from(el.options).find(o =>
          o.text.toLowerCase().includes(val.toLowerCase()) ||
          o.value.toLowerCase().includes(val.toLowerCase())
        );
        if (match) {
          // Skip placeholder first option (e.g. "Select...")
          if (match.index === 0 && /select|choose/i.test(match.text)) continue;
          el.value = match.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          filled.push("required.select." + ft);
        } else if (el.options.length > 1) {
          // Pick first non-placeholder option as last resort
          const opt = Array.from(el.options).find(o => !/select|choose/i.test(o.text));
          if (opt) {
            el.value = opt.value;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            filled.push("required.select-fallback." + ft);
          }
        }
      } else if (el.type === "checkbox") {
        if (!el.checked) { el.click(); filled.push("required.checkbox." + ft); }
      } else {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
        filled.push("required.input." + ft);
      }
    }

    return { filled, clicked };
  }, fields);
}

async function autoFillForms(page, logger) {
  const identity = getIdentity();
  const fields = {
    email: identity.email || "",
    firstName: identity.firstName || "",
    lastName: identity.lastName || "",
    company: identity.company || "",
    phone: identity.phone || "",
    zip: identity.zip || "",
    jobTitle: identity.jobTitle || "",
    city: identity.city || "",
    state: identity.state || "",
    country: identity.country || "",
  };

  let filled = [], clicked = [];

  // Main page
  const r = await autoFillInFrame(page.mainFrame(), fields, logger);
  filled.push(...r.filled); clicked.push(...r.clicked);

  // Each iframe
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const fr = await autoFillInFrame(frame, fields, logger);
      filled.push(...fr.filled); clicked.push(...fr.clicked);
    } catch {}
  }

  if (filled.length) logger.info(`[ai-handler] Auto-filled: ${filled.join(", ")}`);
  if (clicked.length) logger.info(`[ai-handler] Auto-clicked: ${clicked.join(", ")}`);
  if (!filled.length && !clicked.length) logger.info(`[ai-handler] Nothing to auto-fill, deferring to AI`);
}

// Execute a page/frame method (click, type, etc.), trying the main page
// first then each iframe until the selector is found.
async function withFrame(page, selector, fn) {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 2000 });
    return await fn(page);
  } catch {}
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      await frame.waitForSelector(selector, { visible: true, timeout: 2000 });
      return await fn(frame);
    } catch {}
  }
}

// ── AI-powered fallback handler ────────────────────────────────────────
// When no domain-specific handler matches, Claude inspects the page and
// returns a sequence of actions to start the audio stream.

async function extractPageState(page) {
  return page.evaluate(() => {
    function isVisible(el) {
      if (!el || (!el.offsetParent && el.tagName !== "BODY")) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
    }
    function getLabel(input) {
      if (input.id) {
        const lbl = document.querySelector(`label[for="${input.id}"]`);
        if (lbl) return lbl.textContent.trim().slice(0, 100);
      }
      let p = input.parentElement;
      while (p && p.tagName !== "BODY" && p.tagName !== "FORM") {
        const lbl = p.querySelector("label");
        if (lbl) return lbl.textContent.trim().slice(0, 100);
        p = p.parentElement;
      }
      return "";
    }
    function sel(el) {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let c = el;
      while (c && c !== document.body && parts.length < 3) {
        let p = c.tagName.toLowerCase();
        if (c.id) { parts.unshift(`#${CSS.escape(c.id)}`); break; }
        if (c.className && typeof c.className === "string") {
          const cls = c.className.trim().split(/\s+/).filter(x => x && x.length > 2).slice(0, 2);
          if (cls.length) p += "." + cls.join(".");
        }
        parts.unshift(p);
        c = c.parentElement;
      }
      return parts.join(" > ");
    }

    const state = {
      title: document.title || "",
      bodyText: (document.body?.innerText || "").slice(0, 2000),
      media: [],
      forms: [],
      buttons: [],
      iframes: [],
      overlays: [],
    };

    for (const el of document.querySelectorAll("video, audio")) {
      state.media.push({
        tag: el.tagName.toLowerCase(),
        src: (el.src || el.currentSrc || "").slice(0, 200),
        paused: el.paused,
        muted: el.muted,
        id: el.id,
        selector: sel(el),
        visible: isVisible(el),
      });
    }

    const seen = new Set();
    for (const form of document.querySelectorAll("form")) {
      if (!isVisible(form)) continue;
      const inputs = [];
      for (const el of form.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
        if (!isVisible(el)) continue;
        const label = getLabel(el);
        const isReq = el.required || el.getAttribute("aria-required") === "true" || /\*/.test(label);
        inputs.push({ type: el.type || "", name: el.name, id: el.id, placeholder: el.placeholder, label, selector: sel(el), required: isReq });
      }
      if (inputs.length === 0) continue;
      const btn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      state.forms.push({ inputs, submitSelector: btn && isVisible(btn) ? sel(btn) : null, submitText: btn ? btn.textContent.trim().slice(0, 80) : "" });
    }

    for (const el of document.querySelectorAll('button, [role="button"], [aria-label]')) {
      if (!isVisible(el)) continue;
      const text = (el.textContent || "").trim().slice(0, 100);
      const aria = (el.getAttribute("aria-label") || "").slice(0, 100);
      if (!/play|listen|start|watch|join|register|submit|continue|accept|agree|close|dismiss|ok|next|launch|begin|unmute|audio|webcast|stream/i.test(text + " " + aria)) continue;
      const s = sel(el);
      if (seen.has(s)) continue;
      seen.add(s);
      state.buttons.push({ text, ariaLabel: aria, selector: s, id: el.id });
    }

    for (const el of document.querySelectorAll("iframe")) {
      state.iframes.push({ src: (el.src || "").slice(0, 200), id: el.id, selector: sel(el) });
    }

    for (const el of document.querySelectorAll('.modal, .overlay, .dialog, [role="dialog"], .cookie-banner, .cookie-consent, .gdpr')) {
      if (!isVisible(el)) continue;
      const text = (el.textContent || "").trim().slice(0, 200);
      if (text.length < 5) continue;
      state.overlays.push({ text, selector: sel(el) });
    }

    return state;
  });
}

async function isAudioPlaying(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll("video, audio")) {
      if (!el.paused && el.readyState >= 2) return true;
    }
    return false;
  });
}

async function askClaude(pageState, round, identity, logger) {
  const fields = [
    `firstName: "${identity.firstName || ""}"`,
    `lastName: "${identity.lastName || ""}"`,
    `email: "${identity.email || ""}"`,
    `company: "${identity.company || ""}"`,
    `phone: "${identity.phone || ""}"`,
    `zip: "${identity.zip || ""}"`,
    `jobTitle: "${identity.jobTitle || ""}"`,
    `city: "${identity.city || ""}"`,
    `state: "${identity.state || ""}"`,
    `country: "${identity.country || ""}"`,
  ].join("\n");

  const prompt = `Drive a headless browser to start audio on this page. Round ${round}.

## Identity (for forms)
${fields}

## Page
Title: ${pageState.title}
Text: ${pageState.bodyText.slice(0, 1500)}

Media: ${JSON.stringify(pageState.media)}
Forms: ${JSON.stringify(pageState.forms)}
Buttons: ${JSON.stringify(pageState.buttons)}
Iframes: ${JSON.stringify(pageState.iframes)}
Overlays: ${JSON.stringify(pageState.overlays)}

## Required fields
Form inputs marked "required":true MUST be filled before submitting — they are usually marked with a red asterisk (*) on the page. Fill them even if you have to use plausible defaults.

## Actions: click, type, select, wait, click_iframe
For type actions use {{email}}, {{firstName}}, {{lastName}}, {{company}}, {{phone}}, {{zip}}, {{jobTitle}}, {{city}}, {{state}}, {{country}} as values.

Return ONLY JSON:
{"analysis":"...","done":false,"actions":[{"type":"click","selector":"...","description":"..."}]}
If audio is already playing or no action needed, set done:true with empty actions.`;

  try {
    if (!anthropic.authToken) {
      logger.warn("[ai-handler] No Anthropic API key — skipping AI phase");
      return { analysis: "no api key", done: true, actions: [] };
    }

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10000,
      system: "Drive a headless browser to start audio on webcast pages. Return ONLY valid JSON. Be precise with CSS selectors.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content.find((b) => b.type === "text")?.text || "";
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    if (!parsed) {
      const start = text.indexOf("{");
      if (start !== -1) {
        let depth = 0, end = -1;
        for (let i = start; i < text.length; i++) {
          if (text[i] === "{") depth++;
          else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end !== -1) try { parsed = JSON.parse(text.slice(start, end + 1)); } catch {}
      }
    }

    if (parsed?.actions) {
      logger.info(`[ai-handler] ${parsed.analysis || "?"} (${parsed.actions.length} actions)`);
      return parsed;
    }
    logger.warn(`[ai-handler] Claude response (${text.length} chars): ${text.slice(0, 300)}`);
    return { analysis: "parse failed", done: true, actions: [] };
  } catch (err) {
    logger.warn(`[ai-handler] Claude error: ${err.message}`);
    return { analysis: "error", done: true, actions: [] };
  }
}

async function executeAIActions(page, actions, identity, logger) {
  for (const a of actions) {
    try {
      switch (a.type) {
        case "click":
          logger.info(`[ai-handler] Click: ${a.description || a.selector}`);
          await withFrame(page, a.selector, async (f) => { await f.click(a.selector); });
          break;
        case "type": {
          let val = (a.value || "")
            .replace("{{email}}", identity.email || "")
            .replace("{{firstName}}", identity.firstName || "")
            .replace("{{lastName}}", identity.lastName || "")
            .replace("{{company}}", identity.company || "")
            .replace("{{phone}}", identity.phone || "")
            .replace("{{zip}}", identity.zip || "")
            .replace("{{jobTitle}}", identity.jobTitle || "")
            .replace("{{city}}", identity.city || "")
            .replace("{{state}}", identity.state || "")
            .replace("{{country}}", identity.country || "");
          logger.info(`[ai-handler] Type: ${a.description || a.selector}`);
          await withFrame(page, a.selector, async (f) => {
            await f.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.value = ""; }, a.selector);
            await f.type(a.selector, val, { delay: 30 });
          });
          break;
        }
        case "select":
          await page.waitForSelector(a.selector, { visible: true, timeout: 4000 }).catch(() => {});
          await page.select(a.selector, a.value).catch(() => {});
          break;
        case "wait":
          await new Promise((r) => setTimeout(r, Math.min(a.ms || 3000, 15000)));
          break;
        case "click_iframe": {
          const iframeEl = await page.$(a.iframeSelector).catch(() => null);
          if (iframeEl) {
            const frame = await iframeEl.contentFrame().catch(() => null);
            if (frame) {
              await frame.waitForSelector(a.selector, { visible: true, timeout: 4000 }).catch(() => {});
              await frame.click(a.selector).catch(() => {});
            }
          }
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      logger.warn(`[ai-handler] Action failed (${a.type} ${a.selector || ""}): ${err.message}`);
    }
  }
}

async function runAIFallback(page, logger) {
  if (process.env.ENABLE_EARNINGS_FINDER === "false") {
    logger.info(`[ai-handler] AI fallback disabled (ENABLE_EARNINGS_FINDER=false)`);
    return;
  }

  // ── Phase 1: Heuristic auto-fill (fast, free) ──────────────────────
  await autoFillForms(page, logger);
  await new Promise((r) => setTimeout(r, 3000));

  if (await isAudioPlaying(page)) {
    logger.info(`[ai-handler] Audio started after auto-fill, no AI needed.`);
    return;
  }

  // ── Phase 2: AI-driven interaction (for the weird stuff) ────────────
  const identity = getIdentity();
  for (let round = 1; round <= MAX_AI_ROUNDS; round++) {
    if (await isAudioPlaying(page)) {
      logger.info(`[ai-handler] Audio playing, done.`);
      return;
    }

    // Re-run auto-fill each round — page state may have changed
    await autoFillForms(page, logger);
    await new Promise((r) => setTimeout(r, 3000));

    if (await isAudioPlaying(page)) {
      logger.info(`[ai-handler] Audio started after auto-fill, no AI needed.`);
      return;
    }

    const state = await extractPageState(page);
    logger.info(`[ai-handler] Round ${round}: ${state.media.length} media, ${state.forms.length} forms, ${state.buttons.length} btns, ${state.iframes.length} iframes, ${state.overlays.length} overlays`);

    const plan = await askClaude(state, round, identity, logger);
    if (plan.done || plan.actions.length === 0) {
      logger.info(`[ai-handler] Done: ${plan.analysis || "no actions"}`);
      return;
    }

    await executeAIActions(page, plan.actions, identity, logger);
    await new Promise((r) => setTimeout(r, 3000));
  }
  logger.warn(`[ai-handler] Exhausted ${MAX_AI_ROUNDS} rounds`);
}

/**
 * Executes the appropriate handler for the given URL.
 * Falls back to AI-driven interaction when no domain-specific handler matches.
 */
async function runSiteHandlers(url, page, logger) {
  for (const handler of handlers) {
    if (handler.match(url)) {
      logger.info(`[browser] Running specialized handler: ${handler.name}`);
      await handler.handle(page, logger);
      return;
    }
  }
  logger.info(`[browser] No domain handler matched, running AI fallback...`);
  await runAIFallback(page, logger);
}

module.exports = { runSiteHandlers };
