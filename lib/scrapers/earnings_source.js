const logger = require("../logger");

/**
 * Searches for a media stream or webcast URL from a list of external links.
 */
class EarningsSourceFinder {
  constructor(browser) {
    this.browser = browser;
    this.webcastProviders = [
      "on24.com",
      "choruscall.com",
      "q4inc.com",
      "webcasts.com",
      "veracast.com",
      "zoom.us",
      "microsoft.com/en-us/microsoft-teams",
      "youtube.com",
      "youtu.be",
    ];
  }

  async findSource(market) {
    const urls = market.externalLinks || [];
    // Filter out Kalshi internal links and category pages
    const candidates = urls.filter(
      (url) => !url.includes("kalshi.com") && !url.includes("demo.kalshi.co"),
    );

    if (candidates.length === 0) return null;

    logger.info(
      `EarningsSourceFinder: Checking ${candidates.length} candidates...`,
    );

    for (const url of candidates) {
      try {
        const source = await this.probeUrl(url);
        if (source) {
          logger.info(
            `EarningsSourceFinder: Found potential source: ${source}`,
          );
          return source;
        }
      } catch (err) {
        logger.debug(
          `EarningsSourceFinder: Error probing ${url}: ${err.message}`,
        );
      }
    }

    return null;
  }

  async probeUrl(url) {
    let page;
    try {
      page = await this.browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      // 1. Check for common webcast provider links
      const providerLink = await page.evaluate((providers) => {
        const links = Array.from(document.querySelectorAll("a"));
        for (const link of links) {
          const href = link.href.toLowerCase();
          if (providers.some((p) => href.includes(p))) {
            return link.href;
          }
          if (
            link.textContent.toLowerCase().includes("webcast") ||
            link.textContent.toLowerCase().includes("listen to webcast")
          ) {
            return link.href;
          }
        }
        return null;
      }, this.webcastProviders);

      if (providerLink) return providerLink;

      // 2. Check for embedded iframes (e.g. YouTube, specialized players)
      const iframeSrc = await page.evaluate((providers) => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        for (const f of iframes) {
          const src = f.src.toLowerCase();
          if (providers.some((p) => src.includes(p))) {
            return f.src;
          }
        }
        return null;
      }, this.webcastProviders);

      if (iframeSrc) return iframeSrc;

      // 3. Check for specific keywords in buttons
      const buttonLink = await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll("button, a.button, a.btn"),
        );
        for (const b of buttons) {
          const text = b.textContent.toLowerCase();
          if (
            text.includes("webcast") ||
            text.includes("listen") ||
            text.includes("audio")
          ) {
            if (b.tagName === "A") return b.href;
            // If it's a button, we might need more complex logic, but for now just return null
          }
        }
        return null;
      });

      if (buttonLink) return buttonLink;

      return null;
    } finally {
      if (page) await page.close();
    }
  }
}

module.exports = EarningsSourceFinder;
