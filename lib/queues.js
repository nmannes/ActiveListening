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

module.exports = {
  connection,
  runClientQueue,
  logSyncQueue,
  schedulingLoopQueue,
};
