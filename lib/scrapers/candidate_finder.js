const Anthropic = require("@anthropic-ai/sdk");
const logger = require("../logger");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

class CandidateFinder {
  /**
   * Extracts the debate topic from a Kalshi market title.
   * "What will the candidates say during the Massachusetts Democratic Senate Debate?"
   *   → "Massachusetts Democratic Senate Debate"
   * "What will the candidates say during the SC Republican Senate Debate?"
   *   → "SC Republican Senate Debate"
   */
  static extractDebateTopic(title) {
    if (!title) return null;

    const clean = (s) => s.replace(/^(the|a|an|upcoming)\s+/i, "").trim();

    // "during the X Debate" or "during X Debate"
    const debateMatch = title.match(/during\s+(?:the\s+)?(.+?)\s+debate\??$/i);
    if (debateMatch) return clean(debateMatch[1]);

    // Fallback: everything after "say during" or "say in" or "say at"
    const sayMatch = title.match(/say\s+(?:during|in|at)\s+(.+?)\??$/i);
    if (sayMatch) return clean(sayMatch[1]);

    return null;
  }

  constructor(browser) {
    this.browser = browser;
  }

  /**
   * Main entry point. Searches for candidate names for a debate market.
   * @param {object} market - { title, date }
   * @returns {Promise<string[]>} - Array of candidate full names
   */
  async findCandidates(market) {
    const title = market.title || "";
    const topic = CandidateFinder.extractDebateTopic(title);
    const date = market.date || null;

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
      logger.info(`CandidateFinder: Could not extract debate topic from: ${title}`);
      return [];
    }

    logger.info(`CandidateFinder: "${topic}"${dateStr ? ` (${dateStr})` : ""}...`);

    // ── Strategy 1: News search for debate participant announcements ──────
    const newsResults = await this._newsSearch(topic, dateStr);
    for (let i = 0; i < Math.min(newsResults.length, 4); i++) {
      const url = newsResults[i];
      logger.debug(`CandidateFinder: [news ${i + 1}/${Math.min(newsResults.length, 4)}] ${url}`);

      const pageData = await this._scrapePage(url);
      if (!pageData) continue;

      const candidates = await this._askClaude(pageData, topic, dateStr);
      if (candidates.length > 0) {
        logger.info(`CandidateFinder: "${topic}" → ${candidates.length} candidates (via news): ${candidates.join(", ")}`);
        return candidates;
      }
    }

    // ── Strategy 2: General web search for debate participants ────────────
    const webResults = await this._webSearch(topic, dateStr);
    for (let i = 0; i < Math.min(webResults.length, 5); i++) {
      const url = webResults[i];
      logger.debug(`CandidateFinder: [web ${i + 1}/${Math.min(webResults.length, 5)}] ${url}`);

      const pageData = await this._scrapePage(url);
      if (!pageData) continue;

      const candidates = await this._askClaude(pageData, topic, dateStr);
      if (candidates.length > 0) {
        logger.info(`CandidateFinder: "${topic}" → ${candidates.length} candidates: ${candidates.join(", ")}`);
        return candidates;
      }
    }

    logger.info(`CandidateFinder: "${topic}" → no candidates found`);
    return [];
  }

  // ── Web search ──────────────────────────────────────────────────────────

  async _newsSearch(topic, dateStr) {
    const dateQuery = dateStr ? ` ${dateStr}` : "";
    const queries = [
      `${topic} debate participants candidates${dateQuery}`,
      `who is participating in ${topic} debate${dateQuery}`,
      `${topic} debate who is running${dateQuery}`,
      `${topic} candidates debate stage${dateQuery}`,
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

    return allLinks.slice(0, 5);
  }

  async _webSearch(topic, dateStr) {
    const dateQuery = dateStr ? ` ${dateStr}` : "";
    const queries = [
      `${topic} debate candidates${dateQuery}`,
      `${topic} debate lineup${dateQuery}`,
      `${topic} primary debate who qualified${dateQuery}`,
      `"${topic}" debate participants`,
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

    return allLinks.slice(0, 7);
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
      logger.debug(`CandidateFinder: DDG returned ${links.length} results`);
      return links;
    } catch (err) {
      logger.debug(`CandidateFinder: DDG failed: ${err.message}`);
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

      const pageData = await page.evaluate(() => {
        const title = document.title || "";
        const bodyText = (document.body?.innerText || "").slice(0, 8000);
        return { title, bodyText };
      });

      return pageData;
    } catch (err) {
      logger.debug(`CandidateFinder: Failed to scrape ${url}: ${err.message}`);
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
          "You extract debate participant / candidate names from news articles and event pages. Return ONLY valid JSON. These are FUTURE or upcoming debates — look for candidates who ARE SCHEDULED or expected to participate. Include their full names as they appear. Political debates feature the CANDIDATES themselves (senators, representatives, governors, etc.) — DO include elected officials and politicians.",
        messages: [
          {
            role: "user",
            content: `Extract the names of candidates participating in the "${topic}" debate${dateContext} from this page.\n\nIMPORTANT: First verify this page is actually about the "${topic}" debate. If this page is about a DIFFERENT debate or event, return {"candidates": []}. Only extract candidates if the page definitely matches the "${topic}" debate.\n\nPage title: ${pageData.title}\n\nPage text:\n${pageData.bodyText.slice(0, 6000)}\n\nReturn JSON: {"candidates": ["Full Name 1", "Full Name 2"]} or {"candidates": []} if no candidate names are found or this is the wrong debate.`
          },
        ],
      });

      return this._parseClaudeResponse(msg);
    } catch (err) {
      logger.debug(`CandidateFinder: Claude error: ${err.message}`);
      return [];
    }
  }

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

    if (parsed && Array.isArray(parsed.candidates)) {
      return parsed.candidates.filter((w) => typeof w === "string" && w.trim().length > 0);
    }

    return [];
  }
}

module.exports = CandidateFinder;
