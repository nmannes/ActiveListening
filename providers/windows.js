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
const { spawn } = require("child_process");
const WebSocket = require("ws");

const SHARED_DIR = path.join(__dirname, "..", "windows", "shared");
const PCM_FILE = path.join(SHARED_DIR, "audio.pcm");
const TEMP_FILE = path.join(SHARED_DIR, "audio.tmp.pcm");

let ffmpegProc = null;
let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isShuttingDown = null;
let _isStopped = false;
let _retryTimeout = null;

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

    // Ensure the shared directory exists
    if (!fs.existsSync(SHARED_DIR)) {
      throw new Error(
        `Shared directory ${SHARED_DIR} does not exist. ` +
        `Is the Windows VM running with the /shared volume mounted?`,
      );
    }

    // Clean up any stale PCM file from previous sessions
    for (const f of [PCM_FILE, TEMP_FILE]) {
      try { fs.unlinkSync(f); } catch (_) { /* didn't exist, that's fine */ }
    }

    // Wait for the Windows bridge to start writing audio
    _logger.info(`[windows] Waiting for Windows bridge to start writing...`);
    _logger.info(`[windows] If this hangs, start bridge.ps1 on the Windows VM via RDP.`);
    await waitForFile(TEMP_FILE, 60000);

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
    _logger?.info("[windows] Provider stopped.");
  },
};
