const fs = require("fs");
const path = require("path");
const os = require("os");
const { Worker } = require("bullmq");
const { exec, spawn: spawnProcess } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { connection } = require("./lib/queues");
const { worker: workerConfig } = require("./lib/config");
const { STALE_THRESHOLD_MINUTES } = require("./lib/constants");

const CPU_THRESHOLD = workerConfig.cpuThreshold;
const RESCHEDULE_DELAY_MS = workerConfig.rescheduleDelayMinutes * 60 * 1000;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_MINUTES * 60 * 1000;

const SCRIPT_DIR = __dirname;
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

async function spawn(command, job) {
  const jobId = job.id || "unknown";
  console.log(`[worker] [${jobId}] Executing: ${command}`);
  try {
    await execAsync(command, { cwd: SCRIPT_DIR, stdio: "inherit", maxBuffer: MAX_BUFFER });
  } catch (e) {
    const msg = e.message || `exit code ${e.code} (signal ${e.signal})`;
    console.error(`[worker] [${jobId}] Command failed: ${msg}`);
    throw e;
  }
}

// Stream a child process's output into the BullMQ job log so the Bull Board
// shows live progress, and parse marker lines into job.updateProgress().
async function spawnWithLogs(command, job, { progressRe, totalRe } = {}) {
  const jobId = job.id || "unknown";
  console.log(`[worker] [${jobId}] Executing: ${command}`);
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, { cwd: SCRIPT_DIR, shell: true });
    let buf = "";
    let total = null;
    const recent = [];
    const onData = (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const raw of lines) {
        const line = raw.replace(/\r$/, "");
        if (!line.trim()) continue;
        recent.push(line);
        if (recent.length > 50) recent.shift();
        job.log(line).catch(() => {});
        if (totalRe) {
          const m = line.match(totalRe);
          if (m) total = parseInt(m[1]);
        }
        if (progressRe) {
          const m = line.match(progressRe);
          if (m && total) {
            job.updateProgress(Math.min(parseInt(m[1]) / total, 1)).catch(() => {});
          }
        }
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(
          `Command failed (exit ${code}${signal ? `, signal ${signal}` : ""}): ${command}\n--- last output ---\n${recent.join("\n")}`
        ));
      }
    });
  });
}

async function spawnCapture(command) {
  try {
    const { stdout } = await execAsync(command, { cwd: SCRIPT_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: MAX_BUFFER });
    return stdout;
  } catch (e) {
    const stderr = (e.stderr || "").trim();
    const stdout = (e.stdout || "").trim();
    const details = [stderr, stdout].filter(Boolean).join("\n");
    const msg = e.message || `exit code ${e.code} (signal ${e.signal})`;
    throw new Error(`Command failed: ${command}\n${details || msg}`);
  }
}

function cpuUsage() {
  return os.loadavg()[0] / os.cpus().length;
}

function parseDeployResult(stdout) {
  const match = stdout.match(/DEPLOY_RESULT=(\{.*\})/);
  if (!match) {
    console.error("[worker] Could not parse DEPLOY_RESULT from launch script output");
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.error("[worker] Failed to parse DEPLOY_RESULT JSON:", e.message);
    return null;
  }
}

const runClientWorker = new Worker(
  "run-client",
  async (job) => {
    // Pause switch: when set (redis-cli SET kalshi:run_client_paused 1), record
    // the match instead of launching an EC2 instance and listening.
    if (await connection.get("kalshi:run_client_paused")) {
      const { marketFile, duration, browser, slug } = job.data;
      let market = {};
      try {
        market = JSON.parse(fs.readFileSync(marketFile, "utf8"));
      } catch (e) { /* market file may be stale/missing — record what we have */ }
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        slug,
        marketFile,
        duration,
        browser,
        title: market.title || "",
        eventStartTime: market.eventStartTime || "",
      }) + "\n";
      fs.appendFileSync(path.join(SCRIPT_DIR, "data", "skipped_run_client.jsonl"), line);
      const msg = `[paused] Match recorded, client run skipped: ${slug}`;
      console.log(`[worker] ${msg}`);
      job.log(msg);
      return;
    }

    const { marketFile, duration, browser, slug, shutdownMinutes } = job.data;

    // Verify the event hasn't gone stale. Delayed jobs whose delay elapsed
    // while the worker was down (machine off/asleep, crash loop) are promoted
    // on the next worker start and would otherwise run hours late. The
    // scheduler drops stale events at enqueue time with the same threshold
    // (lib/scheduling.js collectCandidates), but jobs already sitting in
    // Redis bypass that check.
    const market = JSON.parse(fs.readFileSync(marketFile, "utf8"));
    const eventStartTime = market.eventStartTime;
    if (eventStartTime) {
      const lateMs = Date.now() - new Date(eventStartTime).getTime();
      if (lateMs > STALE_THRESHOLD_MS) {
        const msg = `Skipping "${slug}" — event started ${Math.round(lateMs / 60000)}m ago (> ${STALE_THRESHOLD_MINUTES}m staleness threshold)`;
        console.log(`[worker] ${msg}`);
        job.log(msg);
        return;
      }

      // Verify the event date matches today's date in Eastern time
      const eventDateET = new Date(eventStartTime).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      if (eventDateET < todayET) {
        const msg = `Skipping "${slug}" — event date (${eventDateET} ET) is before today (${todayET} ET)`;
        console.log(`[worker] ${msg}`);
        job.log(msg);
        return;
      }
    }

    // 1. Launch dedicated EC2 instance
    const launchMsg = `Launching EC2 instance for "${slug}" (shutdown in ${shutdownMinutes}m)`;
    console.log(`[worker] ${launchMsg}`);
    job.log(launchMsg);
    const env = process.env.KALSHI_ENV || "prod";
    const title = market.title || slug;
    const launchOutput = await spawnCapture(
      `bash scripts/launch_gpu_server.sh ${env} --shutdown-minutes ${shutdownMinutes} --tag ${slug} --title "${title.replace(/"/g, '\\"')}"`,
    );

    let deployResult = parseDeployResult(launchOutput);
    if (!deployResult) {
      console.error("[worker] Launch script failed, searching for existing instance...");

      const tryFindIp = async (filters) => {
        try {
          const output = await spawnCapture(
            `aws ec2 describe-instances --region us-east-1 --filters ${filters} "Name=instance-state-name,Values=running,pending" --query 'Reservations[0].Instances[0].[PublicIpAddress,InstanceId,State.Name]' --output text`,
          );
          const parts = output.trim().split(/\s+/);
          const ip = parts[0];
          const id = parts[1];
          const state = parts[2];
          if (!ip || ip === "None") return null;

          // If instance is pending, wait for it to become running
          if (state === "pending") {
            console.log(`[worker]  Instance ${id} is pending, waiting up to 10m...`);
            for (let i = 0; i < 60; i++) {
              await new Promise(r => setTimeout(r, 10000));
              try {
                const check = await spawnCapture(
                  `aws ec2 describe-instances --region us-east-1 --instance-ids ${id} --query 'Reservations[0].Instances[0].[PublicIpAddress,State.Name]' --output text`,
                );
                const [checkIp, checkState] = check.trim().split(/\s+/);
                if (checkState === "running" && checkIp && checkIp !== "None") {
                  console.log(`[worker]  Instance ${id} now running at ${checkIp}`);
                  const nameOutput = await spawnCapture(
                    `aws ec2 describe-tags --region us-east-1 --filters "Name=resource-id,Values=${id}" "Name=key,Values=Name" --query 'Tags[0].Value' --output text`,
                  );
                  return { ip: checkIp, instanceId: id, stackName: nameOutput.trim() || `unknown-${id}` };
                }
              } catch (e) { /* keep polling */ }
            }
            console.error(`[worker]  Instance ${id} did not become running within 10m`);
            return null;
          }

          const nameOutput = await spawnCapture(
            `aws ec2 describe-tags --region us-east-1 --filters "Name=resource-id,Values=${id}" "Name=key,Values=Name" --query 'Tags[0].Value' --output text`,
          );
          return { ip, instanceId: id, stackName: nameOutput.trim() || `unknown-${id}` };
        } catch (e) {
          console.error("[worker]  Instance search failed:", e.message);
        }
        return null;
      };

      // 1. Try to find instance tagged with this event slug
      deployResult = await tryFindIp(`"Name=tag:Event,Values=${slug}"`);
      if (deployResult) {
        console.log(`[worker] Found instance by event tag: ${deployResult.ip}`);
        job.log(`Reusing instance (event tag): ${deployResult.ip}`);
      } else {
        // 2. Fall back to any running instance
        console.error("[worker] No instance for this event, falling back to any running instance...");
        deployResult = await tryFindIp(`"Name=tag:Name,Values=kalshi-worker*"`);
        if (deployResult) {
          console.log(`[worker] Found generic instance: ${deployResult.ip}`);
          job.log(`Reusing generic instance: ${deployResult.ip}`);
        }
      }

      if (!deployResult) {
        console.error("[worker] No instance found at all, aborting client run");
        return;
      }
    }

    const { ip, stackName } = deployResult;
    console.log(`[worker] EC2 instance ready at ${ip} (stack: ${stackName})`);
    job.log(`EC2 ready: ${ip} (stack: ${stackName})`);

    // 2. Run client against the instance
    try {
      const bunCmd = browser ? "xvfb-run -a bun" : "bun";
      const browserFlag = browser ? " --browser" : "";
      job.log(`Starting client: ${slug} (duration: ${duration}m)`);
      await spawn(
        `cd ${SCRIPT_DIR} && ${bunCmd} run client.js --fromFile ${marketFile} --duration ${duration} --ip ${ip}${browserFlag}`,
        job,
      );
      job.log(`Client finished: ${slug}`);
    } finally {
      // 2b. Kill any orphaned Chrome/ffmpeg processes that client.js may have left behind
      try {
        console.log(`[worker] Cleaning up orphaned processes for ${slug}...`);
        await spawnCapture(`pkill -f "chrome.*${slug}" 2>/dev/null; pkill -f "ffmpeg.*${slug}" 2>/dev/null; true`);
      } catch (e) {
        // pkill returns non-zero if no matching processes — that's expected
      }

      // 2c. Brief delay so TCP connections to the EC2 instance drain cleanly
      await new Promise((r) => setTimeout(r, 5000));

      // 3. Clean up the CloudFormation stack
      try {
        console.log(`[worker] Destroying stack: ${stackName}`);
        job.log(`Destroying stack: ${stackName}`);
        await spawnCapture(`aws cloudformation delete-stack --region us-east-1 --stack-name ${stackName}`);
      } catch (e) {
        console.error(`[worker] Failed to delete stack ${stackName}:`, e.message);
      }
    }
  },
  { connection, concurrency: 5, lockDuration: workerConfig.runClientLockDurationHours * 60 * 60 * 1000, stalledInterval: workerConfig.runClientLockDurationHours * 60 * 60 * 1000 },
);

const syncWorker = new Worker(
  "log-sync",
  async (job) => {
    const usage = cpuUsage();
    if (usage > CPU_THRESHOLD) {
      const delayMin = RESCHEDULE_DELAY_MS / 60000;
      const msg = `Rescheduling log-sync in ${delayMin}m: CPU load ${(usage * 100).toFixed(0)}% > ${(CPU_THRESHOLD * 100).toFixed(0)}%`;
      console.log(`[worker] ${msg}`);
      job.log(msg);
      await job.moveToDelayed(Date.now() + RESCHEDULE_DELAY_MS);
      return;
    }
    const { runUUID, sessionId } = job.data;
    await spawn(`bash scripts/sync_logs.sh ${runUUID} --slug ${sessionId}`, job);
  },
  { connection, concurrency: 1, lockDuration: workerConfig.logSyncLockDurationMinutes * 60 * 1000 },
);

const schedulingLoopWorker = new Worker(
  "scheduling-loop",
  async (job) => {
    const usage = cpuUsage();
    if (usage > CPU_THRESHOLD) {
      const delayMin = RESCHEDULE_DELAY_MS / 60000;
      const msg = `Rescheduling scheduling loop in ${delayMin}m: CPU load ${(usage * 100).toFixed(0)}% > ${(CPU_THRESHOLD * 100).toFixed(0)}%`;
      console.log(`[worker] ${msg}`);
      job.log(msg);
      await job.moveToDelayed(Date.now() + RESCHEDULE_DELAY_MS);
      return;
    }
    await spawn(`bun run e2e_discovery.js`, job);
    await spawn(`bun run schedule_matches.js`, job);
  },
  { connection, concurrency: 1, lockDuration: workerConfig.schedulingLoopLockDurationMinutes * 60 * 1000, stalledInterval: workerConfig.schedulingLoopLockDurationMinutes * 60 * 1000 },
);

// Hourly dataset refresh with change gating (scripts/refresh_dataset.py):
// the cheap mentions fetch runs on every tick and the heavy chain
// (transcripts → history → report → backtest) only when the mentions data
// changed or the last full run is >24h old. Long lock: the initial
// watchlist backfill can take ~2h; incremental runs are fast.
const PYTHON = "/home/nathan/.pyenv/shims/python";

const transcriptRefreshWorker = new Worker(
  "transcript-refresh",
  async (job) => {
    const usage = cpuUsage();
    if (usage > CPU_THRESHOLD) {
      const delayMin = RESCHEDULE_DELAY_MS / 60000;
      const msg = `Rescheduling transcript refresh in ${delayMin}m: CPU load ${(usage * 100).toFixed(0)}% > ${(CPU_THRESHOLD * 100).toFixed(0)}%`;
      console.log(`[worker] ${msg}`);
      job.log(msg);
      await job.moveToDelayed(Date.now() + RESCHEDULE_DELAY_MS);
      return;
    }
    const full = job.data && job.data.full ? " --full" : "";
    // Streamed rather than inherited so Bull Board shows the chain's live
    // output and a bar that spans the whole ~25min refresh (see the
    // [refresh] beat markers in scripts/refresh_dataset.py).
    await spawnWithLogs(
      `PYTHONPATH=. ${PYTHON} -u scripts/refresh_dataset.py${full}`,
      job,
      {
        totalRe: /^\[refresh\] total_beats=(\d+)/,
        progressRe: /^\[refresh\] \[(\d+)\/(\d+)\]/,
      },
    );
  },
  { connection, concurrency: workerConfig.transcriptRefreshConcurrency, lockDuration: workerConfig.transcriptRefreshLockDurationMinutes * 60 * 1000, stalledInterval: workerConfig.transcriptRefreshLockDurationMinutes * 60 * 1000 },
);

// Daily social post-history backfill (scripts/fetch_social_all.py): fetch X
// history for every figure in social/handles.json. Resumable and error-tolerant
// per handle, so long runs can be retried. Long lock: full backfills for
// prolific accounts take hours.
const socialFetchWorker = new Worker(
  "social-fetch",
  async (job) => {
    const usage = cpuUsage();
    if (usage > CPU_THRESHOLD) {
      const delayMin = RESCHEDULE_DELAY_MS / 60000;
      const msg = `Rescheduling social fetch in ${delayMin}m: CPU load ${(usage * 100).toFixed(0)}% > ${(CPU_THRESHOLD * 100).toFixed(0)}%`;
      console.log(`[worker] ${msg}`);
      job.log(msg);
      await job.moveToDelayed(Date.now() + RESCHEDULE_DELAY_MS);
      return;
    }
    const d = job.data || {};
    const opts = [
      d.handle ? `--handle ${d.handle}` : null,
      d.maxSeconds ? `--max-seconds ${d.maxSeconds}` : null,
      d.minDate ? `--min-date ${d.minDate}` : null,
      d.maxPosts ? `--max-posts ${d.maxPosts}` : null,
    ].filter(Boolean).join(" ");
    const command = `PYTHONPATH=. ${PYTHON} scripts/fetch_social_all.py${opts ? " " + opts : ""}`;
    job.log(`Running: ${command}`);
    await spawnWithLogs(
      command,
      job,
      {
        totalRe: /^\[social-fetch\] total_handles=(\d+)/,
        progressRe: /^\[social-fetch\] \[(\d+)\/(\d+)\]/,
      },
    );
  },
  { connection, concurrency: workerConfig.socialFetchConcurrency, lockDuration: workerConfig.socialFetchLockDurationMinutes * 60 * 1000, stalledInterval: workerConfig.socialFetchLockDurationMinutes * 60 * 1000 },
);

console.log("[worker] BullMQ worker started — listening on run-client, log-sync, scheduling-loop, transcript-refresh, social-fetch");
