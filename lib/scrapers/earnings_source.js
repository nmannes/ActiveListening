const Anthropic = require("@anthropic-ai/sdk");
const logger = require("../logger");

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
      logger.info(`EarningsSourceFinder: Found specific stream: ${bestLink}`);
      return bestLink;
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

    // 3. If we have candidates but none passed the specific check, ask Claude
    if (candidates.length > 0) {
      const aiHit = await this._askClaude(pageData, candidates, company, date);
      if (aiHit) {
        logger.info(`EarningsSourceFinder: Found via Claude: ${aiHit}`);
        return aiHit;
      }
    }

    // 4. If page has any links at all, ask Claude one more time with full context
    if (pageData.links.length > 4 && candidates.length === 0) {
      const aiHit = await this._askClaude(pageData, pageData.links.slice(0, 40), company, date);
      if (aiHit) {
        logger.info(`EarningsSourceFinder: Found via Claude (deep scan): ${aiHit}`);
        return aiHit;
      }
    }

    return null;
  }

  // ── Web search ──────────────────────────────────────────────────────────

  async _webSearch(company, date) {
    // Try multiple query formulations
    const queries = [
      `${company} earnings call webcast${date ? ` ${date}` : ""}`,
      `${company} quarterly earnings webcast${date ? ` ${date}` : ""}`,
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
        const bodyText = (document.body?.innerText || "").slice(0, 5000);
        const links = [];
        const seen = new Set();
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
