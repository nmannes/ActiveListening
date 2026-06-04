const { spawn } = require("child_process");
const { schedulingLoopQueue } = require("./lib/queues");

const DISCOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function start() {
  console.log("Starting Kalshi Main Event Loop...");

  // 1. Start UI Server in background
  console.log("Starting Market Manager UI...");
  const uiProc = spawn(process.execPath, ["run", "market_ui.js"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  uiProc.on("error", (err) => console.error("Failed to start UI server:", err));

  // 2. Start BullMQ Worker in background
  console.log("Starting BullMQ Worker...");
  const workerProc = spawn(process.execPath, ["run", "worker.js"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  workerProc.on("error", (err) => console.error("Failed to start BullMQ worker:", err));

  // 3. Initial scheduling loop with discovery
  console.log("Enqueuing initial scheduling loop...");
  await schedulingLoopQueue.add("scheduling-loop", { includeDiscovery: true });

  // 5. Recurring: full loop with discovery every 60 minutes
  setInterval(async () => {
    try {
      await schedulingLoopQueue.add("scheduling-loop", { includeDiscovery: true });
      console.log(`[${new Date().toISOString()}] Enqueued scheduling loop (with discovery)`);
    } catch (e) {
      console.error("Failed to enqueue scheduling loop:", e);
    }
  }, DISCOVERY_INTERVAL_MS);

  console.log("Discovery every 60m — all via BullMQ.");
}

start().catch((err) => {
  console.error("Fatal error in main loop:", err);
  process.exit(1);
});
