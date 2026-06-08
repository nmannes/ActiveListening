#!/usr/bin/env node
/**
 * enqueue_run_client.js — Enqueues a run-client job into BullMQ.
 *
 * Called from schedule_run.sh with all parameters as CLI args.
 *
 * Usage:
 *   node enqueue_run_client.js \
 *     --marketFile /path/to/market.json \
 *     --duration 40 \
 *     --browser false \
 *     --slug my-slug \
 *     --shutdownMinutes 60 \
 *     --delay 600000
 */

const fs = require("fs");
const { runClientQueue, connection, extractEventId } = require("./lib/queues");

const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
  if (val.startsWith("--")) {
    const key = val.slice(2);
    const next = arr[i + 1];
    acc[key] = next && !next.startsWith("--") ? next : true;
  }
  return acc;
}, {});

async function main() {
  const marketFile = args.marketFile;
  const duration = parseInt(args.duration, 10);
  const browser = args.browser === "true";
  const slug = args.slug;
  const shutdownMinutes = parseInt(args.shutdownMinutes, 10);
  const delay = Math.max(0, parseInt(args.delay, 10) || 0);

  if (!marketFile || !slug || isNaN(duration) || isNaN(shutdownMinutes)) {
    console.error("Usage: node enqueue_run_client.js --marketFile <path> --duration <min> --slug <slug> --shutdownMinutes <min> [--delay <ms>] [--browser <bool>]");
    process.exit(1);
  }

  const market = JSON.parse(fs.readFileSync(marketFile, "utf8"));
  const eventId = extractEventId(market.mediaStreamURL);

  const job = await runClientQueue.add(
    "run-client",
    {
      marketFile,
      duration,
      browser,
      slug,
      shutdownMinutes,
    },
    { delay, jobId: `${slug}-${eventId}` },
  );

  console.log("Run client job enqueued:", job.id);
  await connection.quit();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
