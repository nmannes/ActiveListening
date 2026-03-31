#!/usr/bin/env node
/**
 * End-to-end transcription latency benchmark.
 *
 * Measures the time from when a PCM audio buffer is ready to be sent to the
 * transcriber, through transcription, keyword matching, all the way to
 * detection — mirroring the server.js pipeline.
 *
 * Steps:
 *   1. Generate test audio via edge-tts → ffmpeg → PCM (16kHz mono s16le)
 *   2. Spawn the transcription worker
 *   3. Split audio into ~2-second chunks (same CHUNK_THRESHOLD as production)
 *   4. Feed each chunk, time the round-trip
 *   5. Report per-chunk and total latency
 *
 * Usage:
 *   node benchmark_latency.js [--model tiny.en] [--device cpu] [--keyword ankle]
 *                              [--phrase "He twisted his ankle during the game"]
 *                              [--runs 5]
 */

const { spawn, execSync } = require("child_process");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// ── Config ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const MODEL = getArg("model", "tiny.en");
const DEVICE = getArg("device", "cpu");
const KEYWORD = getArg("keyword", "ankle");
const PHRASE = getArg("phrase", "He twisted his ankle during the game");
const RUNS = parseInt(getArg("runs", "5"), 10);

const CHUNK_THRESHOLD = 16000 * 2 * 2; // 2 seconds of 16-bit 16kHz mono PCM
const TEST_AUDIO_PATH = path.join(__dirname, "benchmark_test_audio.pcm");

// ── Step 1: Generate test audio ──────────────────────────────────────────────
async function generateTestAudio() {
  const mp3Path = path.join(__dirname, "benchmark_test_audio.mp3");

  console.log(`\n🎤 Generating test audio: "${PHRASE}"`);

  // Generate MP3 with edge-tts
  execSync(
    `python3 -m edge_tts --text "${PHRASE}" --write-media "${mp3Path}" --voice en-US-GuyNeural`,
    { stdio: "pipe" },
  );

  // Convert to 16kHz mono s16le PCM via ffmpeg
  execSync(
    `ffmpeg -y -i "${mp3Path}" -f s16le -acodec pcm_s16le -ar 16000 -ac 1 "${TEST_AUDIO_PATH}"`,
    { stdio: "pipe" },
  );

  fs.unlinkSync(mp3Path);

  const stats = fs.statSync(TEST_AUDIO_PATH);
  const durationSec = stats.size / (16000 * 2);
  console.log(
    `   → ${stats.size} bytes (${durationSec.toFixed(2)}s of audio)\n`,
  );
}

// ── Step 2: Spawn transcription worker ───────────────────────────────────────
function spawnTranscriber() {
  const WS_PORT = 8090; // Use different port than server.js to avoid conflicts
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "python3",
      [
        path.join(__dirname, "transcribe_worker.py"),
        "--model",
        MODEL,
        "--device",
        DEVICE,
        "--port",
        String(WS_PORT),
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    proc.stderr.on("data", (d) => process.stderr.write(`  [worker] ${d}`));
    proc.on("error", (err) => reject(err));

    const readyTimeout = setTimeout(
      () => reject(new Error("Worker not ready in 60s")),
      60000,
    );

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      if (line.trim().startsWith("READY")) {
        clearTimeout(readyTimeout);
        const port = parseInt(line.trim().split(" ")[1]) || WS_PORT;

        const WebSocket = require("ws");
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        let _onTranscript = null;

        ws.on("open", () => {
          const transcriber = {
            write: (pcmBuffer) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(pcmBuffer);
              }
            },
            onTranscript: (cb) => {
              _onTranscript = cb;
            },
            kill: () => {
              ws.close();
              proc.kill();
            },
          };
          resolve(transcriber);
        });

        ws.on("message", (data) => {
          try {
            const result = JSON.parse(data.toString());
            if (_onTranscript && typeof result.text === "string") {
              _onTranscript(result.text);
            }
          } catch (e) {
            /* ignore */
          }
        });

        ws.on("error", (err) => reject(err));
      }
    });
  });
}

// ── Step 3: Run benchmark ────────────────────────────────────────────────────
async function runBenchmark() {
  await generateTestAudio();

  console.log(`⏳ Loading model "${MODEL}" on ${DEVICE}...`);
  const transcriber = await spawnTranscriber();
  console.log("   → Model loaded.\n");

  // Warm-up run (model compilation / caching)
  {
    console.log("🔥 Warm-up transcription (discarded)...");
    const warmup = Buffer.alloc(16000 * 2 * 3, 0); // 3 seconds of silence
    const t0 = performance.now();
    await new Promise((res) => {
      transcriber.onTranscript(() => res());
      transcriber.write(warmup);
    });
    console.log(`   → ${(performance.now() - t0).toFixed(1)}ms\n`);
  }

  const pcmData = fs.readFileSync(TEST_AUDIO_PATH);
  const keywordLower = KEYWORD.toLowerCase();

  // Split into 300ms chunks (to simulate continuous stream)
  const STEP_SIZE = 16000 * 2 * 0.3;
  const chunks = [];
  for (let offset = 0; offset < pcmData.length; offset += STEP_SIZE) {
    chunks.push(
      pcmData.subarray(offset, Math.min(offset + STEP_SIZE, pcmData.length)),
    );
  }
  console.log(`📊 Audio split into ${chunks.length} chunks of 300ms each`);
  console.log(`   Running ${RUNS} iterations...\n`);

  const allResults = [];

  for (let run = 0; run < RUNS; run++) {
    const runResult = {
      chunks: [],
      totalMs: 0,
      detectedAt: null,
      firstDetectedText: null,
    };
    const runStart = performance.now();

    await new Promise((resolveRun) => {
      let chunkIdx = 0;
      let detected = false;

      transcriber.onTranscript((text) => {
        if (detected) return;

        const words = text.split(" ");
        for (const word of words) {
          const token = word
            .replace(/[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g, "")
            .toLowerCase();
          if (token === keywordLower) {
            detected = true;
            runResult.detectedAt = performance.now() - runStart;
            runResult.firstDetectedText = text;
            resolveRun();
            break;
          }
        }
      });

      const feedNextChunk = () => {
        if (detected || chunkIdx >= chunks.length) {
          if (!detected) resolveRun();
          return;
        }

        const chunkStart = performance.now();
        transcriber.write(chunks[chunkIdx]);
        chunkIdx++;

        // Simulate real-time arrival of 300ms chunks
        setTimeout(feedNextChunk, 300);
      };

      feedNextChunk();
    });

    runResult.totalMs = performance.now() - runStart;
    allResults.push(runResult);
  }

  // ── Report ───────────────────────────────────────────────────────────────
  console.log("═".repeat(70));
  console.log(" RESULTS");
  console.log("═".repeat(70));

  const summaryLines = [];
  for (let r = 0; r < allResults.length; r++) {
    const run = allResults[r];
    console.log(`\n── Run ${r + 1} ──`);
    if (run.detectedAt !== null) {
      console.log(
        `  ⏱  Keyword detected at ${run.detectedAt.toFixed(1)}ms from audio start`,
      );
      console.log(`     Text: "${run.firstDetectedText}"`);
    } else {
      console.log(`  ⚠  Keyword "${KEYWORD}" not detected in transcription`);
    }
    summaryLines.push({
      run: r + 1,
      detectionMs: run.detectedAt,
      totalMs: run.totalMs,
    });
  }

  const detected = summaryLines.filter((s) => s.detectionMs !== null);
  console.log("\n" + "═".repeat(70));
  console.log(" SUMMARY");
  console.log("═".repeat(70));
  console.log(`  Model: ${MODEL} | Device: ${DEVICE} | Keyword: "${KEYWORD}"`);
  console.log(`  Stream: 300ms continuous chunks`);
  console.log(`  Runs: ${RUNS} | Detected in: ${detected.length}/${RUNS}`);

  if (detected.length > 0) {
    const times = detected.map((d) => d.detectionMs);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    // We know the audio file is ~2.9s and the phrase "ankle" is around ~1.5s in.
    // We measure absolute time from start of playback to detection.
    console.log(`\n  Audio Start -> Keyword Detection latency:`);
    console.log(`    Min:  ${min.toFixed(1)}ms`);
    console.log(`    Avg:  ${avg.toFixed(1)}ms`);
    console.log(`    Max:  ${max.toFixed(1)}ms`);
    console.log(
      `\n  *Note: absolute latency includes the time it takes the TTS edge-voice to actually speak the word in the audio file (~1.5s) + model inference.*`,
    );
  }

  console.log("");

  transcriber.kill();
  try {
    fs.unlinkSync(TEST_AUDIO_PATH);
  } catch {}
  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
