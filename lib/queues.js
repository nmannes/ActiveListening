const crypto = require("crypto");
const { Queue } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

const runClientQueue = new Queue("run-client", { connection });
const logSyncQueue = new Queue("log-sync", { connection });
const schedulingLoopQueue = new Queue("scheduling-loop", { connection });
const transcriptRefreshQueue = new Queue("transcript-refresh", { connection });
const sampleGenQueue = new Queue("sample-generation", { connection });
const saveSamplesQueue = new Queue("save-samples", { connection });

function extractEventId(url) {
  if (!url) return "no-url";
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
  );
  if (ytMatch) return `yt-${ytMatch[1]}`;
  if (url.includes("localhost")) {
    const m = url.match(/localhost:\d+\/([^/?]+)/);
    if (m) return `tv-${m[1]}`;
  }
  return `ev-${crypto.createHash("md5").update(url).digest("hex").slice(0, 8)}`;
}

module.exports = {
  connection,
  runClientQueue,
  logSyncQueue,
  schedulingLoopQueue,
  transcriptRefreshQueue,
  sampleGenQueue,
  saveSamplesQueue,
  extractEventId,
};
