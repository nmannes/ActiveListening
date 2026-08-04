const Anthropic = require("@anthropic-ai/sdk");
const logger = require("../logger");
const { getIdentity } = require("../identity");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Domains that indicate a specific webcast/stream event (not just a channel)
const STREAM_PROVIDERS = [
  "edge.media-server.com",
  "event.webcasts.com",
  "event.on24.com",
  "event.choruscall.com",
  "events.q4inc.com",
  "viavid.com",
  "virtualshareholdermeeting.com",
  "metroconnections-events.com",
];

// Broader set — matches both specific events and channel pages
const ALL_PROVIDERS = [
  ...STREAM_PROVIDERS,
  "on24.com",
  "choruscall.com",
  "q4inc.com",
  "webcasts.com",
  "veracast.com",
  "zoom.us",
  "youtube.com",
  "youtu.be",
  "irpages.com",
];

class EarningsSourceFinder {
  static extractCompanyFromTitle(title) {
    if (!title) return null;
    const m = title.match(/^What will (.+?) say during their (?:next )?earnings call\?$/i);
    if (m) return m[1];
    const m2 = title.match(/^(.+?) (?:Q[1-4] )?earnings call/i);
    if (m2) return m2[1];
    const m3 = title.match(/^(.+?) earnings/i);
    if (m3) return m3[1];
    return null;
  }

  constructor(browser) {
    this.browser = browser;
  }

  async findSource(market) {
    const company = market.company || "unknown";
    const date = market.date || null;

    // Collect candidate URLs: external links first, then search results
    const externalUrls = (market.externalLinks || []).filter(
      (url) => !url.includes("kalshi.com") && !url.includes("demo.kalshi.co") && !url.includes("reddit.com") && !url.includes("rokt.com"),
    );

    let candidateUrls = [...externalUrls];

    // Search for more URLs if external links are sparse
    if (candidateUrls.length < 3) {
      logger.info(`EarningsSourceFinder: Searching for "${company}" earnings call webcast...`);
      const searchResults = await this._webSearch(company, date);
      // Deduplicate
      for (const url of searchResults) {
        if (!candidateUrls.some((u) => u.toLowerCase() === url.toLowerCase())) {
          candidateUrls.push(url);
        }
      }
    }

    if (candidateUrls.length === 0) {
      logger.info(`EarningsSourceFinder: No candidate URLs.`);
      return null;
    }

    // Probe each candidate URL
    for (let i = 0; i < Math.min(candidateUrls.length, 6); i++) {
      const url = candidateUrls[i];
      const source = i < externalUrls.length ? "external" : "search";
      logger.info(`EarningsSourceFinder: [${i + 1}/${Math.min(candidateUrls.length, 6)}] (${source}) ${url}`);

      const result = await this._probePage(url, company, date);
      if (result) return result;
    }

    return null;
  }

  // ── Probe a single page for the webcast URL ──────────────────────────────

  async _probePage(url, company, date) {
    const pageData = await this._scrapePage(url);
    if (!pageData) return null;

    // 1. Check for an unambiguous specific stream URL
    const bestLink = this._pickBestLink(pageData.links);
    if (bestLink && this._isSpecificStream(bestLink)) {
      if (date) {
        const verification = await this.verifyUrl(bestLink, company, date);
        if (verification.verdict === "yes") {
          logger.info(`EarningsSourceFinder: Found verified specific stream: ${bestLink}`);
          return bestLink;
        }
        logger.info(
          `EarningsSourceFinder: Rejecting specific stream (${verification.reason}): ${bestLink} — page says "${verification.companyOnPage}" / "${verification.dateOnPage}"`,
        );
        // Don't return — fall through to try Claude with other candidates on this page
      } else {
        logger.info(`EarningsSourceFinder: Found specific stream (no date to verify): ${bestLink}`);
        return bestLink;
      }
    }

    // 2. Gather all candidate links that could be webcasts
    const candidates = pageData.links.filter(
      (l) =>
        ALL_PROVIDERS.some((p) => l.href.toLowerCase().includes(p)) ||
        /webcast|listen|audio stream|earnings call|conference call|virtual.*meeting/i.test(l.text),
    );

    // Add iframes as candidates
    for (const src of pageData.iframes || []) {
      candidates.push({ text: "(iframe)", href: src });
    }

    // 3. If we have candidates, ask Claude and verify the pick
    if (candidates.length > 0) {
      const aiHit = await this._askClaude(pageData, candidates, company, date);
      if (aiHit) {
        if (date) {
          const verification = await this.verifyUrl(aiHit, company, date);
          if (verification.verdict !== "no") {
            logger.info(`EarningsSourceFinder: Found via Claude (verified): ${aiHit}`);
            return aiHit;
          }
          logger.info(
            `EarningsSourceFinder: Rejecting Claude pick (${verification.reason}): ${aiHit} — page says "${verification.companyOnPage}" / "${verification.dateOnPage}"`,
          );
        } else {
          logger.info(`EarningsSourceFinder: Found via Claude: ${aiHit}`);
          return aiHit;
        }
      }
    }

    // 4. If page has any links at all, ask Claude one more time with full context
    if (pageData.links.length > 4 && candidates.length === 0) {
      const aiHit = await this._askClaude(pageData, pageData.links.slice(0, 40), company, date);
      if (aiHit) {
        if (date) {
          const verification = await this.verifyUrl(aiHit, company, date);
          if (verification.verdict !== "no") {
            logger.info(`EarningsSourceFinder: Found via Claude deep scan (verified): ${aiHit}`);
            return aiHit;
          }
          logger.info(
            `EarningsSourceFinder: Rejecting Claude deep pick (${verification.reason}): ${aiHit} — page says "${verification.companyOnPage}" / "${verification.dateOnPage}"`,
          );
        } else {
          logger.info(`EarningsSourceFinder: Found via Claude (deep scan): ${aiHit}`);
          return aiHit;
        }
      }
    }

    return null;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _formatDateForSearch(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr; // fall back to raw value
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  // Returns true if the URL looks like an investor relations / events landing page
  _looksLikeIRPage(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return /\/investor|ir\-?page|\/corporate\/|events\-and\-presentations|\/events\/default/i.test(lower);
  }

  // ── Web search ──────────────────────────────────────────────────────────

  async _webSearch(company, date) {
    const readableDate = this._formatDateForSearch(date);
    // Try multiple query formulations
    const queries = [
      `${company} earnings call webcast${readableDate ? ` ${readableDate}` : ""}`,
      `${company} quarterly earnings webcast${readableDate ? ` ${readableDate}` : ""}`,
    ];

    const allLinks = [];
    for (const query of queries) {
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const links = await this._searchDDG(ddgUrl);
      for (const link of links) {
        if (!allLinks.some((l) => l.toLowerCase() === link.toLowerCase())) {
          allLinks.push(link);
        }
      }
      if (allLinks.length >= 6) break;
    }

    if (allLinks.length > 0) return allLinks.slice(0, 8);

    // Fall back to Google
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(queries[0])}`;
    return this._searchGoogle(googleUrl);
  }

  async _searchDDG(url) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
      const links = await page.evaluate(() => {
        const results = [];
        for (const a of document.querySelectorAll("a.result__a")) {
          try {
            const u = new URL(a.href);
            const uddg = u.searchParams.get("uddg");
            if (uddg && uddg.startsWith("http")) results.push(uddg);
            else if (a.href.startsWith("http") && !a.href.includes("duckduckgo.com"))
              results.push(a.href);
          } catch {
            if (a.href.startsWith("http")) results.push(a.href);
          }
        }
        return [...new Set(results)].slice(0, 6);
      });
      logger.info(`EarningsSourceFinder: DDG returned ${links.length} results`);
      return links;
    } catch (err) {
      logger.debug(`EarningsSourceFinder: DDG failed: ${err.message}`);
      return [];
    } finally {
      if (page) await page.close();
    }
  }

  async _searchGoogle(url) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
      const links = await page.evaluate(() => {
        const results = [];
        for (const a of document.querySelectorAll("a[href]")) {
          if (
            a.href.startsWith("http") &&
            !a.href.includes("google.com") &&
            !a.href.includes("youtube.com") &&
            !a.href.includes("reddit.com")
          )
            results.push(a.href);
        }
        return [...new Set(results)].slice(0, 6);
      });
      logger.info(`EarningsSourceFinder: Google returned ${links.length} results`);
      return links;
    } catch (err) {
      logger.warn(`EarningsSourceFinder: Google failed: ${err.message}`);
      return [];
    } finally {
      if (page) await page.close();
    }
  }

  // ── Page scraping ───────────────────────────────────────────────────────

  async _scrapePage(url) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

      return await page.evaluate(() => {
        const title = document.title || "";
        const bodyText = (document.body?.innerText || "").slice(0, 8000);
        const links = [];
        const seen = new Set();

        // Standard <a href> links
        for (const a of document.querySelectorAll("a[href]")) {
          const href = a.href;
          if (!href.startsWith("http")) continue;
          const key = href.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          links.push({
            text: (a.textContent || "").trim().slice(0, 150),
            href,
          });
        }

        // Buttons / elements with onclick navigation
        for (const el of document.querySelectorAll("[onclick]")) {
          const onclick = el.getAttribute("onclick") || "";
          const urlMatch = onclick.match(/(?:location\.href|window\.open|location)\s*[=\(]\s*['"]([^'"]+)['"]/);
          if (urlMatch) {
            let href = urlMatch[1];
            if (href.startsWith("/")) href = window.location.origin + href;
            if (!href.startsWith("http")) continue;
            const key = href.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            links.push({
              text: ((el.textContent || "").trim() || onclick.trim()).slice(0, 150),
              href,
            });
          }
        }

        // Elements with data-url / data-href attributes
        for (const attr of ["data-url", "data-href", "data-link"]) {
          for (const el of document.querySelectorAll(`[${attr}]`)) {
            let href = el.getAttribute(attr);
            if (!href) continue;
            if (href.startsWith("/")) href = window.location.origin + href;
            if (!href.startsWith("http")) continue;
            const key = href.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            links.push({
              text: ((el.textContent || "").trim() || attr).slice(0, 150),
              href,
            });
          }
        }

        // Also check iframes
        const iframes = [];
        for (const f of document.querySelectorAll("iframe")) {
          if (f.src.startsWith("http")) iframes.push(f.src);
        }
        return { title, bodyText, links, iframes };
      });
    } catch {
      return null;
    } finally {
      if (page) await page.close();
    }
  }

  // ── Link quality heuristics ─────────────────────────────────────────────

  // Returns true if the URL looks like a specific event/stream, not a channel homepage
  _isSpecificStream(url) {
    if (!url) return false;
    const lower = url.toLowerCase();

    // Auth / login pages are not streams
    if (lower.includes("/authorize") || lower.includes("/login")) return false;

    // Podcasts, insights, thought-leadership are not earnings webcasts
    if (/\/podcast|\/insights|\/thoughts-on/i.test(lower)) return false;

    // YouTube: only accept /watch, /embed, /live — reject channels (/user/, /@, /c/, bare channel)
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      return lower.includes("/watch") || lower.includes("/embed") || lower.includes("/live");
    }

    // Specific event platforms — always accept
    if (STREAM_PROVIDERS.some((p) => lower.includes(p))) return true;

    // q4inc: only accept /attendee, reject /authorize /login
    if (lower.includes("q4inc.com")) {
      return lower.includes("/attendee") || lower.includes("/event");
    }

    // webcasts.com: accept event URLs
    if (lower.includes("webcasts.com")) {
      return lower.includes("/starthere") || lower.includes("/event") || lower.includes("/view");
    }

    // Self-referencing anchors
    if (url.endsWith("#") || url.endsWith("#events")) return false;

    // URL is from a known provider but doesn't match specific patterns above —
    // treat as specific only if it has meaningful path segments
    if (ALL_PROVIDERS.some((p) => lower.includes(p))) {
      try {
        const u = new URL(url);
        return u.pathname.length > 2;
      } catch {
        return false;
      }
    }

    // Not a known provider at all — don't treat as a specific stream
    return false;
  }

  // Pick the best candidate from a list of links — only returns specific streams
  _pickBestLink(links) {
    const candidates = links.filter(
      (l) =>
        ALL_PROVIDERS.some((p) => l.href.toLowerCase().includes(p)) ||
        /webcast|listen|audio stream|earnings call|conference call|virtual.*meeting/i.test(l.text),
    );

    // Only return unambiguous specific links
    const specific = candidates.filter((l) => this._isSpecificStream(l.href));
    return specific.length > 0 ? specific[0].href : null;
  }

  // ── Claude analysis ─────────────────────────────────────────────────────

  async _askClaude(pageData, candidates, company, date) {
    try {
      // Limit to 50 candidates to keep prompt reasonable
      const links = candidates.slice(0, 50);

      const iframeStr = (pageData.iframes || []).length
        ? `\n\nIframes:\n${pageData.iframes.map((s) => `- ${s}`).join("\n")}`
        : "";

      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system:
          "You find earnings call webcast URLs on investor relations pages. Return ONLY valid JSON. Be precise — a YouTube channel homepage is NOT a webcast. A specific video embed, webcast event page, or audio stream link IS. Ignore podcast links, navigation links, and social media footer links.",
        messages: [
          {
            role: "user",
            content: `Find the exact earnings call webcast/stream URL for ${company}${
              date ? ` on ${date}` : ""
            } from this page.\n\nPage: ${pageData.title}\n\nPage text excerpt:\n${pageData.bodyText.slice(0, 2500)}\n\nLinks${links.length > 40 ? " (showing " + links.length + " most relevant)" : ""}:\n${links
              .map((l) => `- [${l.text}] ${l.href}`)
              .join("\n")}${iframeStr}\n\nReturn JSON: {"url":"<best webcast url>"} or {"url":null}. Pick the URL that most directly links to the actual earnings call webcast/audio stream. Skip navigation, footer links, channel homepages, and podcast pages.`
            },
          ],
        });

      const textBlock = msg.content.find((b) => b.type === "text");
      const content = textBlock?.text || "";
      let parsed = null;
      try { parsed = JSON.parse(content); } catch {}
      if (!parsed) {
        const start = content.indexOf("{");
        if (start !== -1) {
          let depth = 0, end = -1;
          for (let i = start; i < content.length; i++) {
            if (content[i] === "{") depth++;
            else if (content[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
          }
          if (end !== -1) try { parsed = JSON.parse(content.slice(start, end + 1)); } catch {}
        }
      }
      if (parsed) {
        if (parsed.url && this._isSpecificStream(parsed.url)) return parsed.url;
        // Accept Claude's pick even if it doesn't pass our specific check,
        // as long as it's not obviously junk
        if (parsed.url && parsed.url.startsWith("http")) {
          const lower = parsed.url.toLowerCase();
          if (!lower.includes("/authorize") && !lower.includes("/login") && !lower.includes("/podcast")) {
            return parsed.url;
          }
        }
      }
      return null;
    } catch (err) {
      logger.debug(`EarningsSourceFinder: Claude error: ${err.message}`);
      return null;
    }
  }

  // ── Interactive page scraping ──────────────────────────────────────────

  // Like _scrapePage but also clicks on elements that might reveal hidden
  // content (tabs, accordions, expandable sections).
  async _scrapePageInteractive(url, company) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

      // Find clickable elements that might reveal the webcast
      const clickTargets = await page.evaluate(() => {
        const targets = [];
        for (const el of document.querySelectorAll("button, [role=tab], [role=button], [data-toggle], .accordion-header, .accordion-button, [aria-expanded], a.collapsed, .collapsed, .expandable, summary")) {
          const text = (el.textContent || "").trim().toLowerCase();
          if (/webcast|earnings|results|quarter|conference|presentation|events|financial|documents|reports|investor/i.test(text)) {
            targets.push({ text: text.slice(0, 100), tag: el.tagName, visible: !!(el.offsetParent) });
          }
        }
        for (const el of document.querySelectorAll("a, span, div, li")) {
          const text = (el.textContent || "").trim().toLowerCase();
          if (/^(webcast|earnings call|conference call|listen|audio|register|join|attendee)/i.test(text) && el.offsetParent) {
            targets.push({ text: text.slice(0, 100), tag: el.tagName, visible: true });
          }
        }
        return targets.slice(0, 10);
      });

      // Click each target, wait, and check if a stream link appeared
      for (const target of clickTargets) {
        if (!target.visible) continue;
        try {
          await page.evaluate((text) => {
            const els = [...document.querySelectorAll("button, [role=tab], [role=button], a, span, div, li, summary")];
            const match = els.find((el) =>
              (el.textContent || "").trim().toLowerCase().includes(text.toLowerCase())
              && !!(el.offsetParent)
            );
            if (match) match.click();
          }, target.text.slice(0, 30));
          await new Promise((r) => setTimeout(r, 1000));

          // Check if a provider link appeared
          const found = await page.evaluate((providers) => {
            for (const a of document.querySelectorAll("a[href]")) {
              if (!a.href.startsWith("http")) continue;
              for (const p of providers) {
                if (a.href.toLowerCase().includes(p)) return { text: (a.textContent || "").trim(), href: a.href };
              }
            }
            return null;
          }, ALL_PROVIDERS);

          if (found) {
            logger.info(`EarningsSourceFinder: Interaction revealed ${found.href}`);
          }
        } catch {
          // Element disappeared — continue
        }
      }

      // Return the full scrape from the (possibly modified) page
      const result = await page.evaluate(() => {
        const title = document.title || "";
        const bodyText = (document.body?.innerText || "").slice(0, 8000);
        const links = [];
        const seen = new Set();
        for (const a of document.querySelectorAll("a[href]")) {
          const href = a.href;
          if (!href.startsWith("http")) continue;
          const key = href.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          links.push({ text: (a.textContent || "").trim().slice(0, 150), href });
        }
        const iframes = [];
        for (const f of document.querySelectorAll("iframe")) {
          if (f.src.startsWith("http")) iframes.push(f.src);
        }
        return { title, bodyText, links, iframes };
      });
      await page.close();
      return result;
    } catch {
      if (page) await page.close();
      return null;
    }
  }

  // ── AI-guided crawler ──────────────────────────────────────────────────

  // Follow links through IR sites guided by Claude to find the webcast.
  // BFS with up to `budget` page visits. Interacts with pages (clicks tabs,
  // accordions, etc.) to reveal JS-hidden content.
  async _crawlForWebcast(startUrl, company, date) {
    const visited = new Set();
    const queue = [startUrl];
    const budget = 8;

    for (let steps = 0; steps < budget && queue.length > 0; steps++) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      logger.info(`EarningsSourceFinder: Crawl [${steps + 1}/${budget}] ${url}`);

      // Scrape the page with interaction to reveal hidden content
      const pageData = await this._scrapePageInteractive(url, company);
      if (!pageData) continue;

      // Check if this page itself is a webcast
      if (this._isSpecificStream(url)) {
        if (date) {
          const v = await this.verifyUrl(url, company, date);
          if (v.verdict === "yes") {
            logger.info(`EarningsSourceFinder: Crawler found verified stream: ${url}`);
            return url;
          }
        } else {
          return url;
        }
      }

      // Check for obvious stream links on this page first (fast path)
      const bestLink = this._pickBestLink(pageData.links);
      if (bestLink && this._isSpecificStream(bestLink)) {
        if (date) {
          const v = await this.verifyUrl(bestLink, company, date);
          if (v.verdict === "yes") {
            logger.info(`EarningsSourceFinder: Crawler found stream link: ${bestLink}`);
            return bestLink;
          }
        } else {
          return bestLink;
        }
      }

      // Ask Claude which links to follow next
      try {
        // Prioritize links with promising text, then include the rest up to a budget
        const promising = pageData.links.filter((l) =>
          /webcast|earnings|conference|call|events|investor|financial|results|presentation|quarter|q[1-4]|attendee|stream|listen|audio/i.test(l.text)
        );
        const rest = pageData.links.filter((l) => !promising.includes(l));
        const links = [...promising, ...rest].slice(0, 100);

        const iframeStr = (pageData.iframes || []).length
          ? `\nIframes on page:\n${pageData.iframes.map((s) => `- ${s}`).join("\n")}`
          : "";

        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system:
            "You are an AI web crawler navigating investor relations sites to find earnings call webcast URLs. You receive the full page text and links. Your job: identify up to 3 links most likely to lead to the actual webcast/stream page. Look for links to: q4inc.com attendee pages, edge.media-server.com, event.webcasts.com, event.on24.com, Zoom webinars, YouTube live embeds, or Investor Relations events/presentations pages. Return ONLY valid JSON.",
          messages: [
            {
              role: "user",
              content: `Find the path to the ${company} earnings call webcast${date ? ` on ${date}` : ""}.\n\nPage title: ${pageData.title}\n\nPage text:\n${pageData.bodyText.slice(0, 4000)}\n\nLinks (${links.length} total, ${promising.length} promising):\n${links
                .map((l) => `- [${l.text}] ${l.href}`)
                .join("\n")}${iframeStr}\n\nReturn JSON: {"links": ["url1", "url2", "url3"]} with up to 3 best URLs to visit next, or {"links": []} if no link could lead to the webcast. Prefer specific event/webcast URLs over generic section homepages.`
            },
          ],
        });

        const textBlock = msg.content.find((b) => b.type === "text");
        const content = textBlock?.text || "";
        let parsed = null;
        try { parsed = JSON.parse(content); } catch {
          const start = content.indexOf("{");
          if (start !== -1) {
            let depth = 0, end = -1;
            for (let i = start; i < content.length; i++) {
              if (content[i] === "{") depth++;
              else if (content[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
            }
            if (end !== -1) try { parsed = JSON.parse(content.slice(start, end + 1)); } catch {}
          }
        }

        if (parsed?.links?.length > 0) {
          for (const link of parsed.links) {
            if (link.startsWith("http") && !visited.has(link)) {
              queue.push(link);
            }
          }
        }
      } catch (err) {
        logger.debug(`EarningsSourceFinder: Crawler Claude error: ${err.message}`);
      }
    }

    return null;
  }

  // ── Q4 pre-registration ─────────────────────────────────────────────────

  // Q4 attendee pages require registration before the webcast can be accessed.
  // Registering in advance (guest form with our identity) upgrades the URL to
  // ?hasPreRegistered=true, which at listen time only needs email + "Enter
  // Event". Returns the upgraded URL, or the original on any failure.
  async preregisterQ4Event(url) {
    if (!url || !url.includes("q4inc.com/attendee")) return url;
    if (url.includes("hasPreRegistered")) return url;

    const identity = getIdentity();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await sleep(4000);

      // Registration box -> continue as guest
      try {
        await page.click("#registration-box_login-button", { timeout: 5000 });
        await sleep(4000);
      } catch {}

      const hasGuestForm = await page.$("#GuestRegistrationFirstNameInput");
      if (!hasGuestForm) {
        logger.info(`EarningsSourceFinder: Q4 pre-register skipped (no guest form at ${url})`);
        return url;
      }

      const fill = async (sel, val) => {
        try {
          await page.click(sel, { clickCount: 3 });
          await page.type(sel, val, { delay: 40 });
        } catch {}
      };
      await fill("#GuestRegistrationFirstNameInput", identity.firstName);
      await fill("#GuestRegistrationLastNameInput", identity.lastName);
      await fill("#GuestRegistrationEmailInput", identity.email);
      try { await page.click("#GuestRegistrationInvestorCheckboxInput"); } catch {}
      await fill("#GuestRegistrationInstitutionLookupInput", identity.company);
      await fill("#GuestRegistrationRoleFieldInput", identity.jobTitle);
      await sleep(1500);
      await page.click("#GuestRegistrationSubmitButton", { timeout: 5000 });
      await sleep(6000);

      const result = await page.evaluate(() => ({
        text: (document.body?.innerText || "").slice(0, 400),
        hasVideo: !!document.querySelector("video"),
      }));
      if (/Thank you for registering|Welcome Back/i.test(result.text) || result.hasVideo) {
        const base = url.split("?")[0];
        logger.info(`EarningsSourceFinder: Pre-registered for Q4 event: ${base}?hasPreRegistered=true`);
        return `${base}?hasPreRegistered=true`;
      }
      logger.info(`EarningsSourceFinder: Q4 pre-register submitted but outcome unclear: ${result.text.slice(0, 120)}`);
      return url;
    } catch (e) {
      logger.warn(`EarningsSourceFinder: Q4 pre-register failed (${e.message}), keeping ${url}`);
      return url;
    } finally {
      if (page) await page.close();
    }
  }

  // ── Verification ──────────────────────────────────────────────────────────

  async verifyUrl(url, company, date) {
    const pageData = await this._scrapePage(url);
    if (!pageData) {
      return { verdict: "error", reason: "Could not load page", url };
    }

    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system:
          "You verify whether a URL is actually an earnings call webcast for a specific company. Return ONLY valid JSON.",
        messages: [
          {
            role: "user",
            content: `Verify if this page is the earnings call webcast/stream for ${company}${
              date ? ` on ${date}` : ""
            }.\n\nPage title: ${pageData.title}\nURL: ${url}\n\nPage text excerpt:\n${pageData.bodyText.slice(0, 2500)}\n\nReturn JSON: {"verdict":"yes"|"no"|"maybe", "reason":"brief explanation", "company_on_page":"the company name visible on the page", "date_on_page":"any date mentioned"}. Answer "maybe" if it looks like an earnings webcast but you cannot confirm the specific company/date.`
            },
          ],
        });

      const textBlock = msg.content.find((b) => b.type === "text");
      const content = textBlock?.text || "";
      let parsed = null;

      // Try direct parse
      try { parsed = JSON.parse(content); } catch {}

      // Try to find a balanced JSON object
      if (!parsed) {
        const start = content.indexOf("{");
        if (start !== -1) {
          let depth = 0, end = -1;
          for (let i = start; i < content.length; i++) {
            if (content[i] === "{") depth++;
            else if (content[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
          }
          if (end !== -1) {
            try { parsed = JSON.parse(content.slice(start, end + 1)); } catch {}
          }
        }
      }

      if (parsed) {
        return {
          verdict: parsed.verdict || "unknown",
          reason: parsed.reason || "",
          companyOnPage: parsed.company_on_page || "",
          dateOnPage: parsed.date_on_page || "",
          pageTitle: pageData.title,
          url,
        };
      }
      return { verdict: "error", reason: `Parse failed: ${content.slice(0, 200)}`, url, pageTitle: pageData.title };
    } catch (err) {
      return { verdict: "error", reason: err.message, url };
    }
  }
}

module.exports = EarningsSourceFinder;
