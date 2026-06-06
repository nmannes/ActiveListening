#!/usr/bin/env node
/**
 * test_queues.js — Quick smoke test for BullMQ queues
 *
 * Adds test jobs with a long delay so they won't actually execute,
 * verifies they land in Redis, then optionally removes them.
 *
 * Usage:
 *   bun run test_queues.js          # add test jobs
 *   bun run test_queues.js --clean  # remove all test jobs
 *   bun run test_queues.js --stats  # show queue counts only
 */

const {
  runClientQueue,
  logSyncQueue,
  schedulingLoopQueue,
  connection,
} = require("./lib/queues");

const TEST_PREFIX = "test::";
const LONG_DELAY = 24 * 60 * 60 * 1000; // 24h — won't actually execute

const queues = {
  "run-client": runClientQueue,
  "log-sync": logSyncQueue,
  "scheduling-loop": schedulingLoopQueue,
};

async function showStats() {
  console.log("\n── Queue Stats ──");
  for (const [name, q] of Object.entries(queues)) {
    const counts = await q.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    console.log(`  ${name}: waiting=${counts.waiting} active=${counts.active} delayed=${counts.delayed} completed=${counts.completed} failed=${counts.failed}`);
  }
  console.log("");
}

async function addTestJobs() {
  console.log("Adding test jobs (24h delay, won't execute)...\n");

  const clientJob = await runClientQueue.add(
    `${TEST_PREFIX}run-client`,
    { marketFile: "/tmp/test-market.json", duration: 1, browser: false },
    { delay: LONG_DELAY },
  );
  console.log(`  [run-client]  Added job: ${clientJob.id}`);

  const syncJob = await logSyncQueue.add(
    `${TEST_PREFIX}sync-logs`,
    { runUUID: "test-run-uuid", sessionId: "test-session" },
    { delay: LONG_DELAY },
  );
  console.log(`  [log-sync]        Added job: ${syncJob.id}`);

  const loopJob = await schedulingLoopQueue.add(
    `${TEST_PREFIX}scheduling-loop`,
    { includeDiscovery: true },
    { delay: LONG_DELAY },
  );
  console.log(`  [scheduling-loop] Added job: ${loopJob.id}`);

  console.log("\nDone. Check http://localhost:3000/admin/queues or run with --stats\n");
}

async function cleanTestJobs() {
  console.log("Removing test jobs...\n");
  for (const [name, q] of Object.entries(queues)) {
    const jobs = await q.getJobs(["delayed", "waiting", "paused", "active"]);
    let removed = 0;
    for (const job of jobs) {
      if (job.name.startsWith(TEST_PREFIX)) {
        await job.remove();
        removed++;
      }
    }
    console.log(`  ${name}: removed ${removed} test job(s)`);
  }
  console.log("\nDone.\n");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--clean")) {
    await showStats();
    await cleanTestJobs();
    await showStats();
  } else if (args.includes("--stats")) {
    await showStats();
  } else {
    await showStats();
    await addTestJobs();
    await showStats();
  }

  await connection.quit();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
