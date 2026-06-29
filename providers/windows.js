/**
 * providers/windows.js — Windows VM streaming provider
 *
 * Launches an ephemeral Windows VM via QEMU/KVM, delegates browser-based
 * streaming to the windows-bridge running inside the VM. The bridge runs
 * Chrome (with Widevine DRM) and ffmpeg, sending PCM audio directly to
 * the remote EC2 server.
 *
 * This provider follows the standard interface:
 *   start({ ws, market, streamUrl, args, logger, isShuttingDown })
 *   updateWs(ws)
 *   stop()
 *
 * Audio path: Windows VM → EC2 server (direct, bypasses Linux host)
 */

const { spawn } = require("child_process");
const path = require("path");
const WebSocket = require("ws");

const SCRIPT_DIR = path.dirname(__dirname);

// ── Module-level state (reset per session) ─────────────────────────────
let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;
let _isStopped = false;
let _retryTimeout = null;
let _vmPid = null;
let _sessionId = null;
let _mgmtWs = null;       // Management connection to the bridge
let _bridgeReady = false;

// ── Helpers ────────────────────────────────────────────────────────────

function execLaunch(cmd) {
  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [cmd, _sessionId], {
      cwd: SCRIPT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`launch script exited ${code}: ${stderr}`));
      }
    });
  });
}

function execDestroy() {
  return new Promise((resolve) => {
    const proc = spawn("bash", [path.join(SCRIPT_DIR, "destroy_windows_vm.sh"), _sessionId], {
      cwd: SCRIPT_DIR,
      stdio: "ignore",
    });
    proc.on("error", () => resolve());
    proc.on("exit", () => resolve());
    // Force resolve after 15s — don't block shutdown on cleanup
    setTimeout(resolve, 15000);
  });
}

function bridgeCommand(msg) {
  if (_mgmtWs && _mgmtWs.readyState === WebSocket.OPEN) {
    _mgmtWs.send(JSON.stringify(msg));
  }
}

// ── Connect to bridge ──────────────────────────────────────────────────
function connectToBridge(bridgeUrl) {
  return new Promise((resolve, reject) => {
    if (_isStopped || (_isShuttingDown && _isShuttingDown())) {
      return reject(new Error("Shutting down"));
    }

    _logger.info(`[windows] Connecting to bridge at ${bridgeUrl}...`);
    const mgmt = new WebSocket(bridgeUrl);
    const timeout = setTimeout(() => {
      mgmt.close();
      reject(new Error("Bridge connection timeout"));
    }, 15000);

    mgmt.on("open", () => {
      clearTimeout(timeout);
      _mgmtWs = mgmt;
      _logger.info("[windows] Connected to bridge");
      resolve();
    });

    mgmt.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "log") {
          _logger.info(`[vm:${msg.level}] ${msg.message}`);
        } else if (msg.type === "server_msg") {
          // Forward transcript/signal messages for logging
          if (msg.data && msg.data.type === "transcript") {
            _logger.info(`TRANSCRIPT (vm): ${msg.data.text}`);
          }
        }
      } catch {}
    });

    mgmt.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Bridge connection error: ${err.message}`));
    });

    mgmt.on("close", () => {
      _mgmtWs = null;
      _logger.warn("[windows] Bridge management connection closed");
    });
  });
}

// ── Provider interface ──────────────────────────────────────────────────

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
    _retryTimeout = null;
    _vmPid = null;
    _mgmtWs = null;
    _bridgeReady = false;

    // Build a session ID from the market slug
    _sessionId = (market.slug || `winvm-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_");

    // 1. Launch the Windows VM
    _logger.info(`[windows] Launching Windows VM for session ${_sessionId}...`);
    _logger.info(`[windows] Stream URL: ${streamUrl}`);

    let launchOutput;
    try {
      launchOutput = await execLaunch(path.join(SCRIPT_DIR, "launch_windows_vm.sh"));
    } catch (e) {
      throw new Error(`Failed to launch Windows VM: ${e.message}`);
    }

    // Parse BRIDGE_READY from stdout
    const match = launchOutput.stdout.match(/BRIDGE_READY\s+(\S+)\s+(\d+)/);
    if (!match) {
      throw new Error(`VM launch script did not output BRIDGE_READY. stdout: ${launchOutput.stdout}`);
    }
    const bridgeUrl = match[1];
    _vmPid = parseInt(match[2], 10);

    _logger.info(`[windows] VM ready (PID: ${_vmPid}), bridge at ${bridgeUrl}`);

    if (_isStopped || (_isShuttingDown && _isShuttingDown())) {
      _logger.warn("[windows] Shutting down before bridge connection");
      return;
    }

    // 2. Connect to the bridge
    await connectToBridge(bridgeUrl);

    if (_isStopped || (_isShuttingDown && _isShuttingDown())) {
      _logger.warn("[windows] Shutting down before session start");
      return;
    }

    // 3. Start the streaming session on the bridge
    // The bridge connects its own WebSocket to the server, so we pass
    // the server URL from the ws object client.js created, plus the hello
    // handshake payload so the server knows the market, runUUID, etc.
    const serverWsUrl = _ws.url;
    if (!serverWsUrl) {
      throw new Error("WebSocket URL not available from client connection");
    }

    // Build hello handshake (matching what client.js sends)
    const hello = { type: "hello", market, runUUID: logger.fields?.runUUID || "unknown" };
    hello.audioOnly = true;
    if (market.clipProfile !== undefined) hello.clipProfile = market.clipProfile;

    _logger.info(`[windows] Starting bridge session → ${serverWsUrl}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // Don't block — session might still start
        _logger.warn("[windows] Bridge start confirmation timeout, continuing...");
      }, 30000);

      const onMessage = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "started") {
            clearTimeout(timeout);
            _mgmtWs.removeListener("message", onMessage);
            _bridgeReady = true;
            _logger.info("[windows] Bridge confirmed streaming started");
            resolve();
          } else if (msg.type === "error") {
            clearTimeout(timeout);
            _mgmtWs.removeListener("message", onMessage);
            reject(new Error(`Bridge start error: ${msg.message}`));
          }
        } catch {}
      };

      _mgmtWs.on("message", onMessage);
      bridgeCommand({
        type: "start",
        url: _streamUrl,
        serverWsUrl,
        hello,
      });
    });
  },

  updateWs(_newWs) {
    // No-op — the bridge owns its own WebSocket connection to the server.
    // If the server reconnects, the bridge handles reconnection internally.
  },

  async stop() {
    _isStopped = true;
    if (_retryTimeout) {
      clearTimeout(_retryTimeout);
      _retryTimeout = null;
    }

    // Send stop to bridge
    if (_mgmtWs && _mgmtWs.readyState === WebSocket.OPEN) {
      _logger.info("[windows] Stopping bridge session...");
      try {
        bridgeCommand({ type: "stop" });
        _mgmtWs.close();
      } catch {}
      _mgmtWs = null;
    }

    // Destroy the VM (async, don't block shutdown on it)
    if (_sessionId) {
      _logger.info(`[windows] Destroying VM session ${_sessionId}...`);
      execDestroy().catch(() => {});
    }

    _bridgeReady = false;
    _vmPid = null;
    _sessionId = null;
    _ws = null;
    _streamUrl = null;
    _logger = null;
  },
};
