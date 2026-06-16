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

const PYTHON = "/home/nathan/.pyenv/shims/python";
const BUN = "bun";

process.env.HF_HUB_DISABLE_PROMPT = "1";

const DISCOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function start() {
  console.log("Starting Kalshi Main Event Loop...");

  const children = [];
  let shuttingDown = false;

  function spawnChild(name, cmd, args) {
    console.log(`Starting ${name}...`);
    const proc = spawn(cmd, args, { cwd: __dirname, stdio: "inherit" });
    proc.on("error", (err) => console.error(`Failed to start ${name}:`, err));
    proc.on("exit", (code, signal) => {
      if (shuttingDown) return;
      console.error(`${name} exited (code=${code}, signal=${signal}). Restarting in 5s...`);
      sendTelegram(`⚠️ ${name} crashed (code=${code}, signal=${signal}), restarting in 5s`, "debug").catch(() => {});
      setTimeout(() => {
        if (!shuttingDown) spawnChild(name, cmd, args);
      }, 5000);
    });
    children.push(proc);
    return proc;
  }

  // 1. Start UI Server in background
  spawnChild("market_ui.js", process.execPath, ["run", "market_ui.js"]);

  // 2. Start BullMQ Worker in background
  spawnChild("worker.js", process.execPath, ["run", "worker.js"]);

  // 2b. Start Telegram bot server
  spawnChild("telegram_server.py", PYTHON, ["telegram_server.py"]);

  // 2c. Start Redis queue worker (sample generation + save)
  spawnChild("queue_worker.py", PYTHON, ["scripts/queue_worker.py"]);

  // Kill children on exit so orphans don't clash with restarts
  const doShutdown = () => {
    shuttingDown = true;
    process.exit();
  };
  process.on("exit", () => children.forEach((c) => c.kill("SIGTERM")));
  ["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, doShutdown));

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
