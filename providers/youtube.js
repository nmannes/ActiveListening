/**
 * providers/youtube.js — YouTube stream provider
 *
 * Uses yt-dlp to extract direct audio stream URL from YouTube,
 * and send raw PCM audio over WebSocket to the remote server via FFmpeg.
 */

const { spawn } = require("child_process");
const WebSocket = require("ws");

let ffmpegProc = null;
let _ytdlpProc = null;
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

/**
 * Pipe yt-dlp audio output directly into ffmpeg for VOD (non-live) videos.
 * This avoids the DASH URL fragmentation issue with `-g`.
 */
function setupPipedTranscoder(youtubeUrl) {
  if (_isStopped) return;
  _logger.info(`[youtube] Starting piped yt-dlp -> FFmpeg for ${youtubeUrl}`);

  const ytdlp = spawn("/home/linuxbrew/.linuxbrew/bin/yt-dlp", [
    "-f", "bestaudio/best",
    "-o", "-",
    youtubeUrl,
  ]);

  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-i", "pipe:0",
    "-f", "s16le",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-flush_packets", "1",
    "pipe:1",
  ], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ytdlp.stdout.pipe(ffmpeg.stdin);

  ytdlp.stderr.on("data", (data) => {
    _logger.trace(`[youtube-ytdlp] ${data.toString().trim()}`);
  });

  ytdlp.on("close", (code) => {
    _logger.info(`[youtube-ytdlp] yt-dlp exited with code ${code}`);
    // Close ffmpeg's stdin so it finishes processing remaining data
    ffmpeg.stdin.end();
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
  });

  ffmpegProc = ffmpeg;
  _ytdlpProc = ytdlp;
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

    // Detect if stream is live or VOD
    const isLive = await new Promise((resolve) => {
      const ytdlp = spawn("/home/linuxbrew/.linuxbrew/bin/yt-dlp", [
        "--print", "is_live",
        "--no-download",
        _streamUrl,
      ]);
      let out = "";
      ytdlp.stdout.on("data", (d) => (out += d.toString()));
      ytdlp.on("close", () => resolve(out.trim() === "True"));
    });

    _logger.info(`[youtube] Stream type: ${isLive ? "LIVE" : "VOD"}`);

    if (!isLive) {
      // VOD: pipe yt-dlp -> ffmpeg to get the full video audio
      setupPipedTranscoder(_streamUrl);
      return;
    }

    // Live: extract direct URL with yt-dlp -g for low-latency streaming
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
    if (_ytdlpProc) {
      _ytdlpProc.kill();
      _ytdlpProc = null;
    }
    if (ffmpegProc) {
      ffmpegProc.kill();
      ffmpegProc = null;
    }
  },
};
