import { getEvents } from "./api.js";
import fs from "fs";
import logger from "./logger.js";

const now = Date.now();
const one_month_ago = now - 30 * 24 * 60 * 60 * 1000;

logger.info(
  `Fetching events settled since ${new Date(one_month_ago).toISOString()}...`,
);

let allEvents = [];
let totalMentions = 0;
let cursor = null;

if (fs.existsSync("cursor.txt")) {
  cursor = fs.readFileSync("cursor.txt", "utf8").trim();
  logger.info(`Resuming from cursor: ${cursor}`);
}

let pageCount = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isMention = (e) =>
  (e.title && e.title.toLowerCase().includes("mention")) ||
  (e.event_ticker && e.event_ticker.toLowerCase().includes("mention")) ||
  (e.sub_title && e.sub_title.toLowerCase().includes("mention"));

while (true) {
  pageCount++;
  logger.info(`--- Page ${pageCount} ---`);
  await wait(1000); // 1s delay

  const data = await getEvents({
    limit: 200,
    status: "settled",
    min_close_ts: Math.floor(one_month_ago / 1000),
    max_close_ts: Math.floor(now / 1000),
    cursor: cursor,
  });

  if (data.error) {
    logger.error("API Error:", data.error);
    break;
  }

  if (data.events && data.events.length > 0) {
    const pageMentions = data.events.filter(isMention);
    totalMentions += pageMentions.length;
    allEvents.push(...data.events);

    logger.info(`Events in page: ${data.events.length}`);
    logger.info(`Mentions in page: ${pageMentions.length}`);
    logger.info(`Total events so far: ${allEvents.length}`);
    logger.info(`Total mentions so far: ${totalMentions}`);

    // Save data after each iteration
    saveEvents(allEvents);
  }

  cursor = data.cursor;

  // Write cursor to file
  if (cursor) {
    fs.writeFileSync("cursor.txt", cursor);
    logger.info(`Cursor saved: ${cursor}`);
  } else {
    if (fs.existsSync("cursor.txt")) fs.unlinkSync("cursor.txt");
    logger.info("No more cursors.");
  }

  if (allEvents.length >= 50000 || !cursor) {
    break;
  }
}

logger.info(`Finished fetching. Total events: ${allEvents.length}`);

function saveEvents(events) {
  fs.writeFileSync("events.json", JSON.stringify(events, null, 2));

  // Filter for mentions events specifically
  const mentions = events.filter(
    (e) =>
      (e.title && e.title.toLowerCase().includes("mention")) ||
      (e.event_ticker && e.event_ticker.toLowerCase().includes("mention")) ||
      (e.sub_title && e.sub_title.toLowerCase().includes("mention")),
  );

  logger.info(`Found ${mentions.length} mention-related events.`);
  fs.writeFileSync("event_mentions.json", JSON.stringify(mentions, null, 2));
}
