const logger = require("../logger");
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// YouTube search "Live" filter (includes live + scheduled premieres).
const LIVE_FILTER_PARAM = "sp=EgJAAQ%3D%3D";

const DEBATE_SELECTION_SYSTEM = `You pick which YouTube video, if any, is the upcoming debate event for a debate topic.

Rules:
- The debate event is a scheduled premiere or upcoming live broadcast of THE debate itself (e.g. from the debate commission, a campaign, a local news channel, C-SPAN, or a news network).
- NOT past recordings/replays of earlier debates (a video listed as old — e.g. badge "CC", text like "12 years ago" or "Streamed 8 days ago", or a duration — is a past video), NOT reaction/analysis/commentary videos, NOT highlights or news segments, NOT debates on a different topic.
- A scheduled start time or a "Premieres"/"Upcoming" badge is a strong signal the video is the event.
- If no scheduled or live video is the debate event, return null — never pick a past video.
- Use the topic, title, channel, and scheduled time to judge — the video need not repeat the topic word-for-word.

Return ONLY valid JSON: {"index": <number>} for the best match, or {"index": null} if none of the videos is the debate event.`;

/**
 * Finds the upcoming debate event on YouTube for a topic.
 *
 * Searches YouTube (Live filter first, plain search as fallback), then uses
 * Claude to comprehend the results' metadata (title, channel, scheduled
 * time) and pick the actual debate event. Returns the matched video or null.
 */
async function findDebateEvent(browser, topic) {
  const page = await browser.newPage();
  try {
    const queries = [
      `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}&${LIVE_FILTER_PARAM}`,
      `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`,
    ];
    let results = [];
    for (const url of queries) {
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        const data = await page.evaluate(() => window.ytInitialData);
        results = parseSearchResults(data);
        if (results.length > 0) break;
      } catch (e) {
        logger.warn(`[DebateStreams] Search attempt failed for "${topic}": ${e.message}`);
      }
    }
    return await pickDebateEvent(topic, results);
  } finally {
    await page.close();
  }
}

/** Picks the debate event via AI, falling back to badge heuristics on failure. */
async function pickDebateEvent(topic, results) {
  if (!results.length) return null;
  const ai = await aiPickDebateEvent(topic, results);
  if (ai) return ai;
  // AI errored or found nothing — degrade gracefully: scheduled premieres
  // first, then currently-live streams.
  return results.find((r) => isScheduled(r)) || results.find((r) => isLive(r)) || null;
}

/** Asks Claude which result is the debate event; null on failure or no match. */
async function aiPickDebateEvent(topic, results) {
  try {
    const list = results
      .map((r, i) => {
        const status = r.scheduledISO
          ? `scheduled premiere, starts ${r.scheduledISO} (UTC)`
          : r.isLiveNow || /^live/i.test(r.badge || "")
            ? "live now"
            : "past video";
        const when = r.scheduledText ? ` (listed "${r.scheduledText}")` : "";
        return `[${i}] title: ${r.videoTitle}\n    channel: ${r.channel || "unknown"}\n    status: ${status}${when}\n    badge: ${r.badge || "none"}`;
      })
      .join("\n\n");
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      // Thinking would eat the token budget before the JSON answer is produced.
      thinking: { type: "disabled" },
      system: DEBATE_SELECTION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Debate topic: "${topic}"\n\nVideos:\n\n${list}\n\nReturn the JSON.`,
        },
      ],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const index = parseIndex(textBlock?.text || "");
    if (index === null) {
      logger.info(`[DebateStreams] AI found no debate event for "${topic}"`);
      return null;
    }
    return results[index] || null;
  } catch (e) {
    logger.warn(`[DebateStreams] AI selection failed for "${topic}": ${e.message}`);
    return null;
  }
}

/** Extracts {"index": N|null} from a Claude response (tolerating prose). */
function parseIndex(content) {
  const match = (content || "").match(/"index"\s*:\s*(null|\d+)/);
  if (!match) return null;
  if (match[1] === "null") return null;
  return parseInt(match[1], 10);
}

/** True when the result is a scheduled premiere/upcoming broadcast. */
function isScheduled(r) {
  return !!r.scheduledISO || /premiere|upcoming/i.test(r.badge || "");
}

/** True when the result is a currently-live stream. */
function isLive(r) {
  return r.isLiveNow || /^live/i.test(r.badge || "");
}

/**
 * Extracts video results from a search page's ytInitialData.
 * @returns {{videoTitle, videoId, url, channel, badge, scheduledText, scheduledISO, isLiveNow}[]}
 */
function parseSearchResults(ytInitialData) {
  if (!ytInitialData) return [];
  const sectionList =
    ytInitialData.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer;
  if (!sectionList) return [];

  const results = [];
  for (const section of sectionList.contents || []) {
    const itemSection = section.itemSectionRenderer;
    if (!itemSection) continue;
    for (const item of itemSection.contents || []) {
      const vr = item.videoRenderer;
      if (!vr || !vr.videoId) continue;

      const title = (vr.title?.runs || []).map((r) => r.text || "").join("") || "";
      // Badge text lives in the overlay renderer (durations, "LIVE") and/or
      // the badges array (metadataBadgeRenderer.label: "LIVE", "Premieres").
      const badge =
        vr.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
        (vr.badges || [])
          .map((b) => b.metadataBadgeRenderer?.label || "")
          .filter(Boolean)
          .join(" ");
      // Only upcomingEventData gives a *future* start time; liveBroadcastDetails
      // startTimestamp is when an already-live stream began (the past).
      const epoch = vr.upcomingEventData?.startTime;
      const scheduledEpoch = epoch ? parseInt(epoch, 10) : NaN;
      const scheduledISO = isNaN(scheduledEpoch)
        ? null
        : new Date(scheduledEpoch * 1000).toISOString();

      results.push({
        videoTitle: title,
        videoId: vr.videoId,
        url: `https://www.youtube.com/watch?v=${vr.videoId}`,
        channel: vr.ownerText?.runs?.[0]?.text || "",
        badge,
        scheduledText: vr.publishedTimeText?.simpleText || "",
        scheduledISO,
        isLiveNow: !!(vr.liveBroadcastDetails && vr.liveBroadcastDetails.isLiveNow),
      });
    }
  }
  return results;
}

module.exports = {
  findDebateEvent,
  pickDebateEvent,
  parseIndex,
  isScheduled,
  isLive,
  parseSearchResults,
};

if (require.main === module) {
  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());
  const { HEADLESS } = require("../args");

  (async () => {
    const topic = process.argv[2];
    if (!topic) {
      console.error('Usage: bun run lib/scrapers/debate_streams.js "<debate topic>"');
      process.exit(1);
    }
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: "/usr/bin/google-chrome",
        headless: HEADLESS,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-minimized"],
        defaultViewport: null,
      });
      const event = await findDebateEvent(browser, topic);
      console.log(JSON.stringify(event, null, 2));
    } catch (e) {
      console.error("[DebateStreams] Error:", e);
    } finally {
      if (browser) await browser.close();
    }
  })();
}
