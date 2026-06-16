const fs = require("fs");
const os = require("os");
const { Worker } = require("bullmq");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { connection } = require("./lib/queues");

const CPU_THRESHOLD = 0.5; // reschedule non-client jobs when 1m load avg exceeds 50% of cpu count
const RESCHEDULE_DELAY_MS = 30 * 60 * 1000; // 30 minutes

const SCRIPT_DIR = __dirname;

async function spawn(command, job) {
  const jobId = job.id || "unknown";
  console.log(`[worker] [${jobId}] Executing: ${command}`);
  await execAsync(command, { cwd: SCRIPT_DIR, stdio: "inherit" });
}

async function spawnCapture(command) {
  try {
    const { stdout } = await execAsync(command, { cwd: SCRIPT_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return stdout;
  } catch (e) {
    const stderr = (e.stderr || "").trim();
    const stdout = (e.stdout || "").trim();
    const details = [stderr, stdout].filter(Boolean).join("\n");
    throw new Error(`Command failed: ${command}\n${details}`);
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
    const { marketFile, duration, browser, slug, shutdownMinutes } = job.data;

    // Verify the event date matches today's date in Eastern time
    const market = JSON.parse(fs.readFileSync(marketFile, "utf8"));
    const eventStartTime = market.eventStartTime;
    if (eventStartTime) {
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
      `bash launch_gpu_server.sh ${env} --shutdown-minutes ${shutdownMinutes} --tag ${slug} --title "${title.replace(/"/g, '\\"')}"`,
    );

    const deployResult = parseDeployResult(launchOutput);
    if (!deployResult) {
      console.error("[worker] Failed to get IP from launch script, aborting client run");
      return;
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
  { connection, concurrency: 5, lockDuration: 3.5 * 60 * 60 * 1000, stalledInterval: 3.5 * 60 * 60 * 1000 },
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
    await spawn(`bash sync_logs.sh ${runUUID} --slug ${sessionId}`, job);
  },
  { connection, concurrency: 1, lockDuration: 10 * 60 * 1000 },
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
  { connection, concurrency: 1, lockDuration: 10 * 60 * 1000, stalledInterval: 10 * 60 * 1000 },
);

console.log("[worker] BullMQ worker started — listening on run-client, log-sync, scheduling-loop");
