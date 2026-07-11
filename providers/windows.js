/**
 * providers/windows.js — Windows VM stream provider
 *
 * Reads raw PCM audio written by the Windows VM's bridge.ps1 script
 * (via the /shared volume mapped to windows/shared/) and forwards it
 * over WebSocket to the Kalshi server.
 *
 * This provider exists because Linux cannot handle Widevine DRM
 * (peacocktv.com, netflix.com, etc.). The Windows VM runs Chrome with
 * full DRM support, captures system audio via VB-Cable, and writes
 * raw PCM to the shared folder.
 *
 * The Windows-side bridge.ps1 must be running before this provider
 * starts — launch it manually via RDP or set up a scheduled task.
 */

const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const WebSocket = require("ws");

const DATA_DIR = process.env.KALSHI_DATA_DIR || path.join(__dirname, "..");
const LOCK_DIR = path.join(DATA_DIR, "locks");
const SHARED_DIR = path.join(__dirname, "..", "windows", "shared");
const PCM_FILE = path.join(SHARED_DIR, "audio.pcm");
const TEMP_FILE = path.join(SHARED_DIR, "audio.tmp.pcm");
const VM_LOCK_FILE = path.join(LOCK_DIR, "windows-vm.lock");

let ffmpegProc = null;
let _dockerLogsProc = null;
let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;
let _isStopped = false;
let _retryTimeout = null;
let _hasVMLock = false;

const VM_TIME_OUT_MS = 15 * 60 * 1000

// ── VM lock (only one client can use the Windows VM at a time) ──────

function acquireVMLock(marketSlug) {
  fs.mkdirSync(LOCK_DIR, { recursive: true });

  const lockPayload = JSON.stringify({
    pid: process.pid,
    market: marketSlug || "unknown",
    startedAt: new Date().toISOString(),
  });

  try {
    fs.writeFileSync(VM_LOCK_FILE, lockPayload, { flag: "wx" });
    _hasVMLock = true;
    _logger.info(`[windows] VM lock acquired (${marketSlug || process.pid})`);
    return;
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw new Error(`Failed to create VM lock: ${err.message}`);
    }
  }

  // Lock exists — check if holder is still alive
  let existing;
  try {
    existing = JSON.parse(fs.readFileSync(VM_LOCK_FILE, "utf8"));
  } catch (_) {
    existing = { pid: null };
  }

  if (existing.pid) {
    try {
      process.kill(existing.pid, 0);
      throw new Error(
        `Windows VM is in use by another client (PID ${existing.pid}, ` +
        `market: ${existing.market || "unknown"}). Only one client can use ` +
        `the VM at a time. Wait for the other job to finish.`,
      );
    } catch (killErr) {
      if (killErr.code === "ESRCH") {
        _logger.warn(`[windows] Stale VM lock found (PID ${existing.pid}), taking over`);
      } else {
        throw killErr;
      }
    }
  }

  // Stale lock — overwrite
  fs.writeFileSync(VM_LOCK_FILE, lockPayload);
  _hasVMLock = true;
  _logger.info(`[windows] VM lock acquired (stale overwritten)`);
}

function releaseVMLock() {
  if (!_hasVMLock) return;
  try {
    if (fs.existsSync(VM_LOCK_FILE)) fs.unlinkSync(VM_LOCK_FILE);
  } catch (_) { /* best effort */ }
  _hasVMLock = false;
  _logger?.info("[windows] VM lock released");
}

// ── Wait for a file to appear (Windows writes .tmp then renames) ─────
function waitForFile(filePath, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (_isStopped) return reject(new Error("Provider stopped"));
      if (fs.existsSync(filePath)) return resolve();
      if (Date.now() > deadline)
        return reject(
          new Error(
            `Timed out waiting for ${filePath} — is bridge.ps1 running on the Windows VM?`,
          ),
        );
      // Also check for the temp file (ffmpeg writes to .tmp first)
      if (fs.existsSync(TEMP_FILE)) {
        _logger.info("[windows] Temp PCM file found, waiting for rename...");
      }
      setTimeout(check, 500);
    };
    check();
  });
}

// ── Read growing PCM file and send to WebSocket ──────────────────────
function streamPcmFile(filePath) {
  if (_isStopped || _isShuttingDown()) return;

  _logger.info(`[windows] Opening PCM file: ${filePath}`);

  // Use ffmpeg to read the growing file — it handles partial writes and
  // back-pressure correctly. Our "input" is the raw PCM file; we just
  // need to pipe it through at the right rate.
  const ffmpegArgs = [
    "-f", "s16le",
    "-ar", "16000",
    "-ac", "1",
    "-re",               // Read at native frame rate (real-time)
    "-i", filePath,
    "-f", "s16le",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "pipe:1",
  ];

  _logger.info(`[windows] Starting ffmpeg reader...`);
  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  ffmpeg.stdout.on("data", (data) => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      try {
        _ws.send(data);
      } catch (e) {
        _logger.warn(`[windows] WebSocket send error: ${e.message || String(e)}`);
      }
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    const lines = data.toString().split("\n").filter((l) => l.trim());
    for (const line of lines) {
      _logger.trace(`[windows:ffmpeg] ${line}`);
    }
  });

  ffmpeg.stdout.on("error", (err) => {
    _logger.error(`[windows] stdout error: ${err.message || String(err)}`);
  });

  ffmpeg.stderr.on("error", (err) => {
    _logger.error(`[windows] stderr error: ${err.message || String(err)}`);
  });

  ffmpeg.on("close", (code) => {
    _logger.info(`[windows] ffmpeg reader exited with code ${code}`);
    if (!_isStopped && code !== 0 && code !== 255 && !_isShuttingDown()) {
      const delay = Math.min(10000, 1000);
      _logger.info(`[windows] Restarting reader in ${delay}ms...`);
      _retryTimeout = setTimeout(() => streamPcmFile(filePath), delay);
    }
  });

  ffmpeg.on("error", (err) => {
    _logger.error(`[windows] ffmpeg spawn error: ${err.message || String(err)}`);
  });

  ffmpegProc = ffmpeg;
  return ffmpeg;
}

// ── Docker Compose log streaming ────────────────────────────────────

function startDockerLogs() {
  if (_dockerLogsProc) return;

  const windowsDir = path.join(__dirname, "..", "windows");
  _dockerLogsProc = spawn(
    "docker", ["compose", "-f", "docker-compose.yml", "logs", "-f", "--tail", "0"],
    { cwd: windowsDir, stdio: ["ignore", "pipe", "pipe"] },
  );

  _dockerLogsProc.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n").filter(Boolean);
    for (const line of lines) {
      _logger.info(`[docker] ${line.trim()}`);
    }
  });

  _dockerLogsProc.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n").filter(Boolean);
    for (const line of lines) {
      _logger.warn(`[docker] ${line.trim()}`);
    }
  });

  _dockerLogsProc.on("error", (err) => {
    _logger.warn(`[docker] Log stream error: ${err.message || String(err)}`);
  });

  _dockerLogsProc.on("exit", (code) => {
    _dockerLogsProc = null;
    if (code !== 0 && !_isStopped) {
      _logger.warn(`[docker] Log stream exited with code ${code}`);
    }
  });
}

// ── Ensure Windows VM container is running ─────────────────────────

function ensureVmRunning() {
  // Check if the container is already running
  try {
    const status = execSync(
      "DOCKER_HOST=unix:///var/run/docker.sock docker ps --filter name=kalshi-windows --format '{{.Status}}'",
      { encoding: "utf8", timeout: 5000 },
    ).trim();
    if (status) {
      _logger.info("[windows] Windows VM container is already running");
      startDockerLogs();
      return;
    }
    _logger.info("[windows] Windows VM container not running, starting...");
  } catch (e) {
    _logger.warn(`[windows] Docker check failed: ${e.message || String(e)}`);
  }

  const windowsDir = path.join(__dirname, "..", "windows");
  try {
    execSync("DOCKER_HOST=unix:///var/run/docker.sock docker compose -f docker-compose.yml up -d", {
      cwd: windowsDir,
      encoding: "utf8",
      timeout: 120000,
    });
    _logger.info("[windows] Windows VM container started — VM is booting");
  } catch (e) {
    const stderr = e.stderr || e.message || String(e);
    throw new Error(
      `Failed to start Windows VM: ${stderr.trim()}. ` +
      `Is Docker installed and /dev/kvm available?`,
    );
  }

  startDockerLogs();
}

// ── Provider interface ──────────────────────────────────────────────

module.exports = {
  name: "windows",
  audioOnly: true,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _streamUrl = streamUrl;
    _logger = logger;
    _isShuttingDown = isShuttingDown;
    _isStopped = false;
    if (_retryTimeout) clearTimeout(_retryTimeout);

    _logger.info(`[windows] Windows VM provider starting`);
    _logger.info(`[windows] Stream URL: ${streamUrl}`);
    _logger.info(`[windows] PCM file:  ${PCM_FILE}`);

    // Acquire exclusive VM lock before touching anything
    acquireVMLock(market.slug);

    // Create shared directory (docker volume mount point) if missing
    fs.mkdirSync(SHARED_DIR, { recursive: true });

    // Write market info to shared folder so the Windows VM has access
    const marketJsonPath = path.join(SHARED_DIR, "market.json");
    const streamJsonPath = path.join(SHARED_DIR, "stream.json");
    fs.writeFileSync(marketJsonPath, JSON.stringify(market, null, 2));
    _logger.info(`[windows] Wrote market.json for ${market.slug}`);

    const streamJob = {
      url: streamUrl,
      title: market.title,
      slug: market.slug,
    };
    fs.writeFileSync(streamJsonPath, JSON.stringify(streamJob));
    _logger.info(`[windows] Wrote stream.json (url: ${streamUrl})`);

    // Start the Windows VM container if it's not already running
    ensureVmRunning();

    // Clean up any stale PCM file from previous sessions
    for (const f of [PCM_FILE, TEMP_FILE]) {
      try { fs.unlinkSync(f); } catch (_) { /* didn't exist, that's fine */ }
    }

    // Wait for the Windows bridge to start writing audio
    _logger.info(`[windows] Waiting for Windows bridge to start writing...`);
    _logger.info(`[windows] If this hangs, start bridge.ps1 on the Windows VM via RDP.`);
    await waitForFile(TEMP_FILE, VM_TIME_OUT_MS);

    // Start streaming the PCM file to the WebSocket
    streamPcmFile(TEMP_FILE);

    _logger.info(`[windows] Provider started successfully`);
  },

  updateWs(ws) {
    _ws = ws;
  },

  async stop() {
    _isStopped = true;
    if (_retryTimeout) {
      clearTimeout(_retryTimeout);
      _retryTimeout = null;
    }
    if (ffmpegProc) {
      ffmpegProc.kill();
      ffmpegProc = null;
    }
    if (_dockerLogsProc) {
      _dockerLogsProc.kill();
      _dockerLogsProc = null;
    }
    releaseVMLock();
    _logger?.info("[windows] Provider stopped.");
  },
};
