const Anthropic = require("@anthropic-ai/sdk");
const logger = require("../logger");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

class WitnessFinder {
  /**
   * Extracts the hearing topic from a Kalshi market title.
   * "What will the witnesses say during the hearing on Supply Chain Dependency?"
   *   → "Supply Chain Dependency"
   * "What will the witnesses say during Senate TRICARE Pharmacy hearing?"
   *   → "Senate TRICARE Pharmacy"
   */
  static extractHearingTopic(title) {
    if (!title) return null;

    // Helper: strip leading articles/possessives from the result
    const clean = (s) => s.replace(/^(the|his|her|their|a|an|upcoming)\s+/i, "").trim();

    // Pattern: "the hearing on X" → X
    const hearingOnMatch = title.match(/hearing on\s+(.+?)\??$/i);
    if (hearingOnMatch) return clean(hearingOnMatch[1]);

    // Pattern: "during X hearing" → X
    const duringHearingMatch = title.match(/during\s+(.+?)\s+hearing\??$/i);
    if (duringHearingMatch) return clean(duringHearingMatch[1]);

    // Pattern: "in the X hearing" → X  (e.g. "say in the upcoming House Judiciary hearing")
    const inHearingMatch = title.match(/in\s+(?:the\s+|upcoming\s+)?(.+?)\s+hearing\??$/i);
    if (inHearingMatch) return clean(inHearingMatch[1]);

    // Pattern: "X confirmation hearing" or "X hearing"
    const confirmationMatch = title.match(/during\s+(?:the\s+)?(.+?)\s+(?:confirmation\s+)?hearing\??$/i);
    if (confirmationMatch) return clean(confirmationMatch[1]);

    // Fallback: everything after "say during", "say in", or "say at"
    const sayMatch = title.match(/say\s+(?:during|in|at)\s+(.+?)\??$/i);
    if (sayMatch) return clean(sayMatch[1]);

    return null;
  }

  constructor(browser) {
    this.browser = browser;
  }

  /**
   * Main entry point. Searches for witness names for a hearing market.
   * @param {object} market - { title, date }
   * @returns {Promise<string[]>} - Array of witness full names
   */
  async findWitnesses(market) {
    const title = market.title || "";
    const topic = WitnessFinder.extractHearingTopic(title);
    const date = market.date || null;

    // Extract date string for search queries (e.g. "2026-07-15" → "July 15 2026")
    let dateStr = "";
    if (date) {
      try {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          const months = ["January","February","March","April","May","June",
            "July","August","September","October","November","December"];
          dateStr = `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
        }
      } catch {}
    }

    if (!topic) {
      logger.info(`WitnessFinder: Could not extract hearing topic from: ${title}`);
      return [];
    }

    logger.info(`WitnessFinder: "${topic}"${dateStr ? ` (${dateStr})` : ""}...`);

    // ── Strategy 1: Search .gov hearing schedule pages ──────────────────
    // Committee sites (.senate.gov, .house.gov) publish hearing calendars
    // that list upcoming hearings with witness names. This is the most
    // authoritative source.
    const scheduleResults = await this._govScheduleSearch(topic, dateStr);
    for (let i = 0; i < Math.min(scheduleResults.length, 3); i++) {
      const url = scheduleResults[i];
      logger.debug(`WitnessFinder: [schedule ${i + 1}/${Math.min(scheduleResults.length, 3)}] ${url}`);

      const pageData = await this._scrapePage(url);
      if (!pageData) continue;

      const witnesses = await this._askClaudeSchedule(pageData, topic, dateStr);
      if (witnesses.length > 0) {
        logger.info(`WitnessFinder: "${topic}" → ${witnesses.length} witnesses: ${witnesses.join(", ")}`);
        return witnesses;
      }
    }

    // ── Strategy 2: General web search for individual hearing pages ─────
    const searchResults = await this._webSearch(topic, dateStr);
    const sorted = this._prioritizeGov(searchResults);

    for (let i = 0; i < Math.min(sorted.length, 5); i++) {
      const url = sorted[i];
      logger.debug(`WitnessFinder: [${i + 1}/${Math.min(sorted.length, 5)}] ${url}`);

      const pageData = await this._scrapePage(url);
      if (!pageData) continue;

      const witnesses = await this._askClaude(pageData, topic, dateStr);
      if (witnesses.length > 0) {
        logger.info(`WitnessFinder: "${topic}" → ${witnesses.length} witnesses: ${witnesses.join(", ")}`);
        return witnesses;
      }
    }

    // ── Strategy 3: Broader news search ─────────────────────────────────
    logger.debug(`WitnessFinder: No witnesses from primary search, trying news...`);
    const newsResults = await this._newsSearch(topic, dateStr);
    const sortedNews = this._prioritizeGov(newsResults);
    for (let i = 0; i < Math.min(sortedNews.length, 3); i++) {
      const url = sortedNews[i];
      const pageData = await this._scrapePage(url);
      if (!pageData) continue;

      const witnesses = await this._askClaude(pageData, topic, dateStr);
      if (witnesses.length > 0) {
        logger.info(`WitnessFinder: "${topic}" → ${witnesses.length} witnesses (via news): ${witnesses.join(", ")}`);
        return witnesses;
      }
    }

    logger.info(`WitnessFinder: "${topic}" → no witnesses found`);
    return [];
  }

  /**
   * Sort URLs so .gov domains come first (committee sites are authoritative).
   */
  _prioritizeGov(urls) {
    return [...urls].sort((a, b) => {
      const aGov = a.includes(".gov") || a.includes(".senate.gov") || a.includes(".house.gov");
      const bGov = b.includes(".gov") || b.includes(".senate.gov") || b.includes(".house.gov");
      if (aGov && !bGov) return -1;
      if (!aGov && bGov) return 1;
      return 0;
    });
  }

  // ── Web search ──────────────────────────────────────────────────────────

  // ── .gov hearing schedule search ──────────────────────────────────────

  /**
   * Searches for hearing schedule pages on .senate.gov and .house.gov.
   * These pages list upcoming hearings with witness names.
   */
  async _govScheduleSearch(topic, dateStr) {
    // Extract keywords from topic for more targeted queries
    const keywords = topic.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3);
    const keyTerms = keywords.join(" ");

    const dateQuery = dateStr ? ` ${dateStr}` : "";
    const queries = [
      // Targeted: schedule pages on .gov with topic keywords
      `site:senate.gov hearings ${keyTerms}${dateQuery}`,
      `site:house.gov hearings ${keyTerms}${dateQuery}`,
      `"${topic}" site:senate.gov hearing`,
      `"${topic}" site:house.gov hearing`,
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
      if (allLinks.length >= 4) break;
    }

    // Only return .gov URLs
    return allLinks.filter((url) =>
      url.includes(".senate.gov") || url.includes(".house.gov")
    ).slice(0, 4);
  }

  // ── General web search ────────────────────────────────────────────────

  async _webSearch(topic, dateStr) {
    const dateQuery = dateStr ? ` ${dateStr}` : "";
    const queries = [
      // Broad queries first — no quotes, better recall. Include date when available.
      `${topic} hearing witness list${dateQuery}`,
      `${topic} hearing witnesses testimony${dateQuery}`,
      `${topic} senate hearing${dateQuery}`,
      // Targeted with quotes as fallback
      `"${topic}" hearing`,
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
      if (allLinks.length >= 5) break;
    }

    return allLinks.slice(0, 6);
  }

  async _newsSearch(topic, dateStr) {
    const dateQuery = dateStr ? ` ${dateStr}` : "";
    const queries = [
      `${topic} hearing scheduled witnesses${dateQuery}`,
      `who will testify at ${topic} hearing${dateQuery}`,
      `${topic} committee hearing testimony${dateQuery}`,
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
      if (allLinks.length >= 3) break;
    }

    return allLinks.slice(0, 4);
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
        return [...new Set(results)].slice(0, 6)
          .filter((url) => !url.includes("kalshi.com") && !url.includes("kalshi.co"));
      });
      logger.debug(`WitnessFinder: DDG returned ${links.length} results`);
      return links;
    } catch (err) {
      logger.debug(`WitnessFinder: DDG failed: ${err.message}`);
      return [];
    } finally {
      if (page) await page.close();
    }
  }

  // ── Claude: schedule page extraction ────────────────────────────────────

  /**
   * Like _askClaude but optimized for hearing schedule/calendar pages that
   * list multiple upcoming hearings. Asks Claude to find the specific hearing
   * matching our topic and extract only those witnesses.
   */
  async _askClaudeSchedule(pageData, topic, dateStr) {
    const dateContext = dateStr ? ` scheduled for ${dateStr}` : "";
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system:
          "You find witness names for a specific hearing within a committee hearing schedule page. Return ONLY valid JSON. These are FUTURE hearings — look for witnesses who ARE SCHEDULED to testify. Include their full names as they appear. Do NOT include committee members, senators, or representatives.",
        messages: [
          {
            role: "user",
            content: `This page is a committee hearing schedule or calendar. Find the hearing that best matches "${topic}"${dateContext} and extract the witnesses scheduled to testify.\n\nIMPORTANT: If no hearing on this page matches "${topic}", return {"witnesses": []}. Only extract witnesses from the matching hearing — ignore all other hearings listed on the page.\n\nPage title: ${pageData.title}\n\nPage text:\n${pageData.bodyText.slice(0, 8000)}\n\nReturn JSON: {"witnesses": ["Full Name 1", "Full Name 2"]} or {"witnesses": []}.`
          },
        ],
      });

      return this._parseClaudeResponse(msg);
    } catch (err) {
      logger.debug(`WitnessFinder: Claude schedule error: ${err.message}`);
      return [];
    }
  }

  // ── Page scraping ───────────────────────────────────────────────────────

  async _scrapePage(url) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

      const pageData = await page.evaluate(() => {
        const title = document.title || "";
        const bodyText = (document.body?.innerText || "").slice(0, 8000);
        return { title, bodyText };
      });

      return pageData;
    } catch (err) {
      logger.debug(`WitnessFinder: Failed to scrape ${url}: ${err.message}`);
      return null;
    } finally {
      if (page) await page.close();
    }
  }

  // ── Claude extraction ───────────────────────────────────────────────────

  async _askClaude(pageData, topic, dateStr) {
    const dateContext = dateStr ? ` scheduled for ${dateStr}` : "";
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system:
          "You extract witness names from congressional hearing pages. Return ONLY valid JSON. These hearings are in the FUTURE — look for witnesses who ARE SCHEDULED or WILL testify, not those who already testified. Include their full names as they appear. Do NOT include committee members, senators, representatives, or the chairperson — only the outside witnesses called to give testimony.",
        messages: [
          {
            role: "user",
            content: `Extract the witness names scheduled to testify at the hearing about "${topic}"${dateContext} from this page.\n\nIMPORTANT: First verify this page is actually about the "${topic}" hearing. If this page is about a DIFFERENT hearing topic (different subject matter, different committee focus), return {"witnesses": []}. Only extract witnesses if the page definitely matches the "${topic}" hearing.\n\nPage title: ${pageData.title}\n\nPage text:\n${pageData.bodyText.slice(0, 6000)}\n\nReturn JSON: {"witnesses": ["Full Name 1", "Full Name 2"]} or {"witnesses": []} if no witness names are found or this is the wrong hearing.`
          },
        ],
      });

      return this._parseClaudeResponse(msg);
    } catch (err) {
      logger.debug(`WitnessFinder: Claude error: ${err.message}`);
      return [];
    }
  }

  /**
   * Parse Claude's JSON response, extracting the witnesses array.
   */
  _parseClaudeResponse(msg) {
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
        if (end !== -1) {
          try { parsed = JSON.parse(content.slice(start, end + 1)); } catch {}
        }
      }
    }

    if (parsed && Array.isArray(parsed.witnesses)) {
      return parsed.witnesses.filter((w) => typeof w === "string" && w.trim().length > 0);
    }

    return [];
  }
}

module.exports = WitnessFinder;
