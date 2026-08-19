const { spawn, execSync } = require("child_process");

// Ensure bashrc env (PATH, etc.) is available even when not launched from scripts/on_start.sh
const bashrcEnv = execSync('bash -l -c "env"', {
  encoding: "utf8",
  timeout: 10000,
});
for (const line of bashrcEnv.split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) process.env[line.slice(0, eq)] = line.slice(eq + 1);
}

const { connection, schedulingLoopQueue, transcriptRefreshQueue, socialFetchQueue } = require("./lib/queues");
const { sendTelegram } = require("./lib/telegram");

const PYTHON = "/home/nathan/.pyenv/shims/python";

process.env.HF_HUB_DISABLE_PROMPT = "1";

const REDIS_KEY = "kalshi:next_scrape_time";
const POLL_INTERVAL_MS = 60_000; // check Redis every minute
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // run every hour when self-managing

async function start() {
  console.log("Starting Kalshi Main Event Loop...");

  const children = [];
  let shuttingDown = false;

  function spawnChild(name, cmd, args) {
    console.log(`Starting ${name}...`);
    const proc = spawn(cmd, args, { cwd: __dirname, stdio: "inherit" });
    proc.on("error", (err) => console.error(`Failed to start ${name}:`, err.message || String(err)));
    proc.on("exit", (code, signal) => {
      if (shuttingDown) return;
      console.error(`${name} exited (code=${code}, signal=${signal}). Restarting in 5s...`);
      sendTelegram(`⚠️ ${name} crashed (code=${code}, signal=${signal}), restarting in 5s`, "debug").catch(() => { });
      setTimeout(() => {
        if (!shuttingDown) spawnChild(name, cmd, args);
      }, 5000);
    });
    children.push(proc);
    return proc;
  }

  // 1. Start UI Server in background
  spawnChild("market_ui.js", process.execPath, ["run", "--hot", "market_ui.js"]);

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
  sendTelegram("Scheduling loop started").catch(() => { });

  // 3b. Hourly dataset refresh: cheap mentions check every hour, full chain
  // (transcripts → history → report → backtest) only when the data changed
  // or the last full run is >24h old (gating in scripts/refresh_dataset.py)
  console.log("Registering hourly transcript refresh (:23)...");
  const repeatables = await transcriptRefreshQueue.getRepeatableJobs();
  for (const r of repeatables) {
    if (r.name === "transcript-refresh") {
      console.log(`Removing stale transcript-refresh repeatable: ${r.key}`);
      await transcriptRefreshQueue.removeRepeatableByKey(r.key);
    }
  }
  await transcriptRefreshQueue.add(
    "transcript-refresh",
    {},
    { repeat: { pattern: "23 * * * *" }, jobId: "transcript-refresh-hourly" },
  );

  // 3c. Daily social post-history backfill: fetch X history for every figure
  // in social/handles.json (resumable — re-runs only add new posts, so a
  // daily tick slowly backfills full histories without hammering X)
  console.log("Registering daily social fetch (:47)...");
  const socialRepeatables = await socialFetchQueue.getRepeatableJobs();
  for (const r of socialRepeatables) {
    if (r.name === "social-fetch") {
      console.log(`Removing stale social-fetch repeatable: ${r.key}`);
      await socialFetchQueue.removeRepeatableByKey(r.key);
    }
  }
  await socialFetchQueue.add(
    "social-fetch",
    {},
    { repeat: { pattern: "47 5 * * *" }, jobId: "social-fetch-daily" },
  );

  // 4. Set initial next-scrape time in Redis and begin the Redis-driven loop
  await connection.set(REDIS_KEY, Date.now() + POLL_INTERVAL_MS);
  scheduleNextFromRedis();

  console.log("Scrape cadence driven by Redis key:", REDIS_KEY);
}

async function scheduleNextFromRedis() {
  while (true) {
    const raw = await connection.get(REDIS_KEY);
    const nextTime = raw ? parseInt(raw, 10) : 0;
    const remaining = nextTime - Date.now();

    if (remaining <= 0) {
      await enqueueSchedulingLoop();
      await connection.set(REDIS_KEY, Date.now() + DEFAULT_INTERVAL_MS);
      continue;
    }

    // Wait until the scheduled time, but wake up each minute to re-check Redis
    await new Promise((r) => setTimeout(r, Math.min(remaining, POLL_INTERVAL_MS)));
  }
}

async function enqueueSchedulingLoop() {
  try {
    await schedulingLoopQueue.add("scheduling-loop", { includeDiscovery: true });
  } catch (e) {
    console.error("Failed to enqueue scheduling loop:", e);
  }
}

start().catch((err) => {
  console.error("Fatal error in main loop:", err);
  process.exit(1);
});
