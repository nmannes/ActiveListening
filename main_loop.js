const { spawn, execSync } = require("child_process");

// Ensure bashrc env (PATH, etc.) is available even when not launched from on_start.sh
const bashrcEnv = execSync('bash -l -c "env"', {
  encoding: "utf8",
  timeout: 10000,
});
for (const line of bashrcEnv.split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) process.env[line.slice(0, eq)] = line.slice(eq + 1);
}

const { schedulingLoopQueue } = require("./lib/queues");
const { sendTelegram } = require("./lib/telegram");

const PYTHON = "python";
const BUN = "bun";

process.env.HF_HUB_DISABLE_PROMPT = "1";

const DISCOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function start() {
  console.log("Starting Kalshi Main Event Loop...");

  const children = [];

  // 1. Start UI Server in background
  console.log("Starting Market Manager UI...");
  const uiProc = spawn(process.execPath, ["run", "market_ui.js"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  uiProc.on("error", (err) => console.error("Failed to start UI server:", err));
  children.push(uiProc);

  // 2. Start BullMQ Worker in background
  console.log("Starting BullMQ Worker...");
  const workerProc = spawn(process.execPath, ["run", "worker.js"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  workerProc.on("error", (err) => console.error("Failed to start BullMQ worker:", err));
  children.push(workerProc);

  // 2b. Start Telegram bot server
  const tgProc = spawn(PYTHON, ["telegram_server.py"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  tgProc.on("error", (err) => console.error("Failed to start Telegram server:", err));
  children.push(tgProc);

  // 2c. Start Redis queue worker (sample generation + save)
  const qwProc = spawn(PYTHON, ["scripts/queue_worker.py"], {
    cwd: __dirname,
    stdio: "inherit",
  });
  qwProc.on("error", (err) => console.error("Failed to start queue worker:", err));
  children.push(qwProc);

  // Kill children on exit so orphans don't clash with restarts
  process.on("exit", () => children.forEach((c) => c.kill("SIGTERM")));
  ["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => process.exit()));

  // 3. Initial scheduling loop with discovery
  console.log("Enqueuing initial scheduling loop...");
  await schedulingLoopQueue.add("scheduling-loop", { includeDiscovery: true });
  sendTelegram("Scheduling loop started").catch(() => {});

  // 5. Recurring: full loop with discovery every 60 minutes
  setInterval(async () => {
    try {
      await schedulingLoopQueue.add("scheduling-loop", { includeDiscovery: true });
      const timestamp = new Date().toISOString();
      sendTelegram(`[${timestamp}] Scheduling loop enqueued`, "debug").catch(() => {});
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
