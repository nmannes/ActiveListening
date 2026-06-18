const fs = require("fs");
const path = require("path");

/**
 * Acquires an advisory filesystem lock to prevent concurrent runs.
 *
 * Creates a lockfile containing the current PID. If the lockfile exists and
 * the owning process is alive, the current process exits. Stale locks (dead
 * owner) are reclaimed.
 *
 * Registers process handlers for SIGINT, SIGTERM, exit, and uncaughtException
 * to release the lock automatically.
 *
 * @param {string} name      - Unique lock name (e.g. "scheduler")
 * @param {object} [opts]
 * @param {string} [opts.locksDir] - Directory for lock files
 * @returns {{ cleanup: Function }}  Call cleanup() to release the lock
 */
function acquireLock(name, opts = {}) {
  const locksDir =
    opts.locksDir ||
    path.join(process.env.KALSHI_DATA_DIR || path.resolve(__dirname, "..", "..", ".."), "locks");

  if (!fs.existsSync(locksDir)) {
    fs.mkdirSync(locksDir, { recursive: true });
  }

  const lockFile = path.join(locksDir, `${name}.lock`);

  attemptWrite(lockFile);

  const cleanup = () => {
    try {
      if (fs.existsSync(lockFile)) {
        const pid = parseInt(fs.readFileSync(lockFile, "utf8"), 10);
        if (pid === process.pid) {
          fs.unlinkSync(lockFile);
        }
      }
    } catch (e) {
      console.error(`Lockfile cleanup error: ${e.message}`);
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    cleanup();
    process.exit(1);
  });

  return { cleanup };
}

function attemptWrite(lockFile) {
  try {
    fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
  } catch (e) {
    let pid;
    try {
      pid = parseInt(fs.readFileSync(lockFile, "utf8"), 10);
    } catch (_) {
      pid = null;
    }

    if (pid) {
      try {
        process.kill(pid, 0);
        console.log(`Lock held by PID ${pid}. Exiting.`);
        process.exit(0);
      } catch (_) {
        // Stale lock — owner is dead, reclaim it
        fs.unlinkSync(lockFile);
        fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });
      }
    }
  }
}

module.exports = { acquireLock };
