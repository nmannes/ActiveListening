const { Queue } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  maxRetriesPerRequest: null,
});

const gpuServerQueue = new Queue("gpu-server", { connection });
const runClientQueue = new Queue("run-client", { connection });
const logSyncQueue = new Queue("log-sync", { connection });

module.exports = {
  connection,
  gpuServerQueue,
  runClientQueue,
  logSyncQueue,
};
