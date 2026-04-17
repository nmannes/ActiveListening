/**
 * providers/youtube.js — YouTube stream provider
 *
 * Uses yt-dlp to extract direct audio stream URL from YouTube,
 * and send raw PCM audio over WebSocket to the remote server via FFmpeg.
 */

const { spawn } = require("child_process");
const WebSocket = require("ws");

let ffmpegProc = null;
let _ws = null;
let _streamUrl = null;
let _logger = null;
let _isStopped = false;
let _retryTimeout = null;

function setupAudioTranscoder(inputUrl, retryCount = 0) {
  if (_isStopped) return;
  _logger.info(
    `[youtube] Starting FFmpeg transcoder for URL: ${inputUrl} (Retry ${retryCount})`,
  );

  const ffmpegArgs = [
    "-fflags",
    "nobuffer",
    "-flags",
    "low_delay",
    "-probesize",
    "32000",
    "-analyzeduration",
    "100000",
    "-i",
    inputUrl,
    "-f",
    "s16le",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-flush_packets",
    "1",
    "pipe:1",
  ];

  const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpeg.stdout.on("data", (data) => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(data);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    _logger.trace(`[youtube-ffmpeg] ${data.toString().trim()}`);
  });

  ffmpeg.on("close", (code) => {
    _logger.info(`[youtube-ffmpeg] FFmpeg exited with code ${code}`);
    if (!_isStopped && code !== 0 && code !== 255) {
      const delay = Math.min(10000, 1000 * Math.pow(2, retryCount));
      _logger.info(`[youtube-ffmpeg] Retrying FFmpeg in ${delay}ms...`);
      _retryTimeout = setTimeout(() => {
        setupAudioTranscoder(inputUrl, retryCount + 1);
      }, delay);
    }
  });

  ffmpegProc = ffmpeg;
}

module.exports = {
  name: "youtube",
  audioOnly: true,

  async start({ ws, market, streamUrl, args, logger, isShuttingDown }) {
    _ws = ws;
    _streamUrl = streamUrl;
    _logger = logger;
    _isStopped = false;

    _logger.info(`[youtube] Starting YouTube provider for ${_streamUrl}`);

    const startTime = Date.now();
    const timeoutMs = 5 * 60 * 1000;

    while (Date.now() - startTime < timeoutMs && !_isStopped) {
      try {
        _logger.info(
          `[youtube] Attempting to extract audio stream with yt-dlp...`,
        );
        const directUrl = await new Promise((resolve, reject) => {
          const ytdlp = spawn("/home/linuxbrew/.linuxbrew/bin/yt-dlp", [
            "-f",
            "bestaudio/best",
            "-g",
            _streamUrl,
          ]);
          let out = "";
          let err = "";
          ytdlp.stdout.on("data", (d) => (out += d.toString()));
          ytdlp.stderr.on("data", (d) => (err += d.toString()));
          ytdlp.on("close", (code) => {
            if (code === 0 && out.trim()) {
              resolve(out.trim());
            } else {
              reject(new Error(`yt-dlp exited ${code}: ${err.trim()}`));
            }
          });
        });

        _logger.info(`[youtube] yt-dlp extracted URL, starting transcoder.`);
        setupAudioTranscoder(directUrl);
        return;
      } catch (e) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (Date.now() - startTime >= timeoutMs || _isStopped) {
          _logger.warn(
            `[youtube] yt-dlp extraction failed after ${elapsed}s, giving up.`,
          );
          break;
        }
        _logger.warn(
          `[youtube] yt-dlp failed (${e.message}) after ${elapsed}s. Retrying in 10s...`,
        );
        await new Promise((r) => setTimeout(r, 10000));
      }
    }

    if (!_isStopped) {
      throw new Error("Failed to extract YouTube stream after 5 minutes.");
    }
  },

  updateWs(ws) {
    _ws = ws;
  },

  stop() {
    _isStopped = true;
    if (_retryTimeout) {
      clearTimeout(_retryTimeout);
      _retryTimeout = null;
    }
    if (ffmpegProc) {
      ffmpegProc.kill();
      ffmpegProc = null;
    }
  },
};
