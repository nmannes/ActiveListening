const { Worker } = require("bullmq");
const { execSync } = require("child_process");
const { connection } = require("./lib/queues");

const SCRIPT_DIR = __dirname;

function spawn(command, job) {
  const jobId = job.id || "unknown";
  console.log(`[worker] [${jobId}] Executing: ${command}`);
  execSync(command, { cwd: SCRIPT_DIR, stdio: "inherit" });
}

const worker = new Worker(
  "gpu-server",
  async (job) => {
    const { shutdownMinutes, spot } = job.data;
    const spotArg = spot ? "--spot" : "";
    spawn(
      `bash launch_gpu_server.sh prod ${spotArg} --shutdown-minutes ${shutdownMinutes}`,
      job,
    );
  },
  { connection, concurrency: 1 },
);

const clientWorker = new Worker(
  "run-client",
  async (job) => {
    const { marketFile, duration, browser } = job.data;
    const prefix = browser ? "/home/linuxbrew/.linuxbrew/bin/xvfb-run -a " : "";
    const browserArg = browser ? "--browser" : "";
    spawn(
      `cd ${SCRIPT_DIR} && ${prefix}/home/nathan/.bun/bin/bun run client.js --fromFile ${marketFile} --duration ${duration} ${browserArg}`,
      job,
    );
  },
  { connection, concurrency: 1 },
);

const syncWorker = new Worker(
  "log-sync",
  async (job) => {
    const { runUUID, sessionId } = job.data;
    spawn(`bash sync_logs.sh ${runUUID} --slug ${sessionId}`, job);
  },
  { connection, concurrency: 1 },
);

const schedulingLoopWorker = new Worker(
  "scheduling-loop",
  async (job) => {
    const { includeDiscovery } = job.data;
    if (includeDiscovery) {
      spawn(`/home/nathan/.bun/bin/bun run e2e_discovery.js`, job);
    }
    spawn(`/home/nathan/.bun/bin/bun run schedule_matches.js`, job);
    spawn(`/home/nathan/.bun/bin/bun run signal_vs_no_closeout.js`, job);
  },
  { connection, concurrency: 1 },
);

console.log("[worker] BullMQ worker started — listening on gpu-server, run-client, log-sync, scheduling-loop");
