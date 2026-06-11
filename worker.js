const fs = require("fs");
const { Worker } = require("bullmq");
const { execSync } = require("child_process");
const { connection } = require("./lib/queues");

const SCRIPT_DIR = __dirname;

function spawn(command, job) {
  const jobId = job.id || "unknown";
  console.log(`[worker] [${jobId}] Executing: ${command}`);
  execSync(command, { cwd: SCRIPT_DIR, stdio: "inherit" });
}

function spawnCapture(command) {
  return execSync(command, { cwd: SCRIPT_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
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
      if (eventDateET !== todayET) {
        console.log(`[worker] Skipping "${slug}" — event date (${eventDateET} ET) does not match today (${todayET} ET)`);
        return;
      }
    }

    // 1. Launch dedicated EC2 instance
    console.log(`[worker] Launching EC2 instance for "${slug}" (shutdown in ${shutdownMinutes}m)...`);
    const env = process.env.KALSHI_ENV || "prod";
    const title = market.title || slug;
    const launchOutput = spawnCapture(
      `bash launch_gpu_server.sh ${env} --shutdown-minutes ${shutdownMinutes} --tag ${slug} --title "${title.replace(/"/g, '\\"')}"`,
    );

    const deployResult = parseDeployResult(launchOutput);
    if (!deployResult) {
      console.error("[worker] Failed to get IP from launch script, aborting client run");
      return;
    }

    const { ip, stackName } = deployResult;
    console.log(`[worker] EC2 instance ready at ${ip} (stack: ${stackName})`);

    // 2. Run client against the instance
    try {
      const bunCmd = browser ? "xvfb-run -a bun" : "bun";
      const browserFlag = browser ? " --browser" : "";
      spawn(
        `cd ${SCRIPT_DIR} && ${bunCmd} run client.js --fromFile ${marketFile} --duration ${duration} --ip ${ip}${browserFlag}`,
        job,
      );
    } finally {
      // 3. Clean up the CloudFormation stack
      try {
        console.log(`[worker] Destroying stack: ${stackName}`);
        spawnCapture(`aws cloudformation delete-stack --region us-east-1 --stack-name ${stackName}`);
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
    const { runUUID, sessionId } = job.data;
    spawn(`bash sync_logs.sh ${runUUID} --slug ${sessionId}`, job);
  },
  { connection, concurrency: 1, lockDuration: 10 * 60 * 1000 },
);

const schedulingLoopWorker = new Worker(
  "scheduling-loop",
  async (job) => {
    spawn(`bun run e2e_discovery.js`, job);
    spawn(`bun run schedule_matches.js`, job);
  },
  { connection, concurrency: 1, lockDuration: 10 * 60 * 1000, stalledInterval: 10 * 60 * 1000 },
);

console.log("[worker] BullMQ worker started — listening on run-client, log-sync, scheduling-loop");
