import { getEvents } from "./api.js";
import fs from "fs";
import logger from "./logger.js";

const OUT_FILE = "all_historic_mentions.jsonl";
const CURSOR_FILE = "cursor_all_historic.txt";

const isMention = (e) =>
  (e.title && e.title.toLowerCase().includes("mention")) ||
  (e.event_ticker && e.event_ticker.toLowerCase().includes("mention")) ||
  (e.sub_title && e.sub_title.toLowerCase().includes("mention"));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let cursor = null;
  let pageCount = 0;
  let totalMentions = 0;

  if (fs.existsSync(CURSOR_FILE)) {
    cursor = fs.readFileSync(CURSOR_FILE, "utf8").trim();
    logger.info(`Resuming from cursor: ${cursor}`);
  }

  // Count existing lines for resumption stats
  if (fs.existsSync(OUT_FILE)) {
    const existing = fs.readFileSync(OUT_FILE, "utf8").trim();
    totalMentions = existing ? existing.split("\n").length : 0;
    logger.info(`Output already has ${totalMentions} mentions`);
  }

  while (true) {
    pageCount++;
    logger.info(`--- Page ${pageCount} (${totalMentions} mentions so far) ---`);
    await wait(500);

    const params = {
      limit: 200,
      status: "settled",
    };
    if (cursor) params.cursor = cursor;

    const data = await getEvents(params);

    if (data.error) {
      logger.error("API Error:", data.error);
      break;
    }

    if (!data.events || data.events.length === 0) {
      logger.info("No more events returned.");
      break;
    }

    const pageMentions = data.events.filter(isMention);

    // Append each mention as a line immediately
    for (const m of pageMentions) {
      fs.appendFileSync(OUT_FILE, JSON.stringify(m) + "\n");
    }
    totalMentions += pageMentions.length;

    logger.info(
      `Page: ${data.events.length} events, ${pageMentions.length} mentions | Total: ${totalMentions}`,
    );

    cursor = data.cursor;
    if (cursor) {
      fs.writeFileSync(CURSOR_FILE, cursor);
    } else {
      if (fs.existsSync(CURSOR_FILE)) fs.unlinkSync(CURSOR_FILE);
      logger.info("No more cursors — done.");
      break;
    }
  }

  logger.info(`Done. ${totalMentions} historic mention events saved to ${OUT_FILE}`);
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
