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

const { spawn, execSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// ── Config ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const MODEL = getArg('model', 'tiny.en');
const DEVICE = getArg('device', 'cpu');
const KEYWORD = getArg('keyword', 'ankle');
const PHRASE = getArg('phrase', 'He twisted his ankle during the game');
const RUNS = parseInt(getArg('runs', '5'), 10);

const CHUNK_THRESHOLD = 16000 * 2 * 2; // 2 seconds of 16-bit 16kHz mono PCM
const TEST_AUDIO_PATH = path.join(__dirname, 'benchmark_test_audio.pcm');

// ── Step 1: Generate test audio ──────────────────────────────────────────────
async function generateTestAudio() {
    const mp3Path = path.join(__dirname, 'benchmark_test_audio.mp3');

    console.log(`\n🎤 Generating test audio: "${PHRASE}"`);

    // Generate MP3 with edge-tts
    execSync(
        `python3 -m edge_tts --text "${PHRASE}" --write-media "${mp3Path}" --voice en-US-GuyNeural`,
        { stdio: 'pipe' }
    );

    // Convert to 16kHz mono s16le PCM via ffmpeg
    execSync(
        `ffmpeg -y -i "${mp3Path}" -f s16le -acodec pcm_s16le -ar 16000 -ac 1 "${TEST_AUDIO_PATH}"`,
        { stdio: 'pipe' }
    );

    fs.unlinkSync(mp3Path);

    const stats = fs.statSync(TEST_AUDIO_PATH);
    const durationSec = stats.size / (16000 * 2);
    console.log(`   → ${stats.size} bytes (${durationSec.toFixed(2)}s of audio)\n`);
}

// ── Step 2: Spawn transcription worker ───────────────────────────────────────
function spawnTranscriber() {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [
            path.join(__dirname, 'transcribe_worker.py'),
            '--model', MODEL,
            '--device', DEVICE,
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        proc.stderr.on('data', d => process.stderr.write(`  [worker] ${d}`));
        proc.on('error', err => reject(err));

        const rl = readline.createInterface({ input: proc.stdout });

        const lineHandler = (line) => {
            if (line.trim() === 'READY') {
                rl.removeListener('line', lineHandler);

                const responseLines = [];
                let responseResolve = null;
                rl.on('line', (responseLine) => {
                    if (responseResolve) {
                        const cb = responseResolve;
                        responseResolve = null;
                        cb(responseLine);
                    } else {
                        responseLines.push(responseLine);
                    }
                });

                const transcribe = (pcmBuffer) => {
                    return new Promise((res, rej) => {
                        try {
                            const header = `AUDIO ${pcmBuffer.length}\n`;
                            proc.stdin.write(header);
                            proc.stdin.write(pcmBuffer);
                            if (responseLines.length > 0) {
                                res(JSON.parse(responseLines.shift()));
                            } else {
                                responseResolve = (line) => {
                                    try { res(JSON.parse(line)); } catch (e) { rej(e); }
                                };
                            }
                        } catch (e) { rej(e); }
                    });
                };
                transcribe.kill = () => proc.kill();
                resolve(transcribe);
            }
        };
        rl.on('line', lineHandler);

        setTimeout(() => reject(new Error('Worker not ready in 60s')), 60000);
    });
}

// ── Step 3: Run benchmark ────────────────────────────────────────────────────
async function runBenchmark() {
    await generateTestAudio();

    console.log(`⏳ Loading model "${MODEL}" on ${DEVICE}...`);
    const transcribe = await spawnTranscriber();
    console.log('   → Model loaded.\n');

    // Warm-up run (model compilation / caching)
    {
        const warmup = Buffer.alloc(CHUNK_THRESHOLD, 0);
        console.log('🔥 Warm-up transcription (discarded)...');
        const t0 = performance.now();
        await transcribe(warmup);
        console.log(`   → ${(performance.now() - t0).toFixed(1)}ms\n`);
    }

    const pcmData = fs.readFileSync(TEST_AUDIO_PATH);
    const keywordLower = KEYWORD.toLowerCase();

    // Split into chunks
    const chunks = [];
    for (let offset = 0; offset < pcmData.length; offset += CHUNK_THRESHOLD) {
        chunks.push(pcmData.subarray(offset, Math.min(offset + CHUNK_THRESHOLD, pcmData.length)));
    }
    console.log(`📊 Audio split into ${chunks.length} chunk(s) of ~2s each`);
    console.log(`   Running ${RUNS} iterations...\n`);

    const allResults = [];

    for (let run = 0; run < RUNS; run++) {
        const runResult = { chunks: [], totalMs: 0, detectedAt: null, detectedChunk: null };
        const transcript = [];

        const runStart = performance.now();

        for (let i = 0; i < chunks.length; i++) {
            const chunkStart = performance.now();

            // ── Transcription ──
            const result = await transcribe(chunks[i]);
            const transcribeEnd = performance.now();
            const transcribeMs = transcribeEnd - chunkStart;

            const text = (result.text || '').trim();

            // ── Keyword matching (mirrors server.js logic) ──
            const matchStart = performance.now();
            const words = text.split(' ');
            let detected = false;
            for (const word of words) {
                const token = word.replace(/[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g, '').toLowerCase();
                if (!token) continue;
                transcript.push(token);
                if (token === keywordLower) {
                    detected = true;
                }
            }
            const matchMs = performance.now() - matchStart;
            const totalChunkMs = performance.now() - chunkStart;

            runResult.chunks.push({
                chunk: i,
                text,
                transcribeMs,
                matchMs,
                totalChunkMs,
                detected,
            });

            if (detected && !runResult.detectedAt) {
                runResult.detectedAt = performance.now() - runStart;
                runResult.detectedChunk = i;
            }
        }

        runResult.totalMs = performance.now() - runStart;
        allResults.push(runResult);
    }

    // ── Report ───────────────────────────────────────────────────────────────
    console.log('═'.repeat(70));
    console.log(' RESULTS');
    console.log('═'.repeat(70));

    const summaryLines = [];
    for (let r = 0; r < allResults.length; r++) {
        const run = allResults[r];
        console.log(`\n── Run ${r + 1} ──`);
        for (const c of run.chunks) {
            const flag = c.detected ? ' ✅ KEYWORD' : '';
            console.log(`  Chunk ${c.chunk}: transcribe=${c.transcribeMs.toFixed(1)}ms  match=${c.matchMs.toFixed(2)}ms  text="${c.text}"${flag}`);
        }
        if (run.detectedAt !== null) {
            console.log(`  ⏱  Keyword detected at chunk ${run.detectedChunk} — ${run.detectedAt.toFixed(1)}ms from audio arrival`);
        } else {
            console.log(`  ⚠  Keyword "${KEYWORD}" not detected in transcription`);
        }
        summaryLines.push({
            run: r + 1,
            detectionMs: run.detectedAt,
            totalMs: run.totalMs,
            avgTranscribeMs: run.chunks.reduce((s, c) => s + c.transcribeMs, 0) / run.chunks.length,
        });
    }

    const detected = summaryLines.filter(s => s.detectionMs !== null);
    console.log('\n' + '═'.repeat(70));
    console.log(' SUMMARY');
    console.log('═'.repeat(70));
    console.log(`  Model: ${MODEL} | Device: ${DEVICE} | Keyword: "${KEYWORD}"`);
    console.log(`  Chunk size: ${(CHUNK_THRESHOLD / (16000 * 2)).toFixed(1)}s (${CHUNK_THRESHOLD} bytes)`);
    console.log(`  Runs: ${RUNS} | Detected in: ${detected.length}/${RUNS}`);

    if (detected.length > 0) {
        const times = detected.map(d => d.detectionMs);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        console.log(`\n  Audio-to-detection latency:`);
        console.log(`    Min:  ${min.toFixed(1)}ms`);
        console.log(`    Avg:  ${avg.toFixed(1)}ms`);
        console.log(`    Max:  ${max.toFixed(1)}ms`);

        const avgTranscribe = summaryLines.reduce((s, r) => s + r.avgTranscribeMs, 0) / summaryLines.length;
        console.log(`\n  Avg transcription per 2s chunk: ${avgTranscribe.toFixed(1)}ms`);
        console.log(`  Buffering overhead:             ${(CHUNK_THRESHOLD / (16000 * 2) * 1000).toFixed(0)}ms (fixed, waiting for audio to fill 2s)`);
        console.log(`\n  ⏱  Total expected real-world latency = buffer (${(CHUNK_THRESHOLD / (16000 * 2) * 1000).toFixed(0)}ms) + transcription (~${avgTranscribe.toFixed(0)}ms) ≈ ${((CHUNK_THRESHOLD / (16000 * 2) * 1000) + avgTranscribe).toFixed(0)}ms`);
    }

    console.log('');

    transcribe.kill();
    try { fs.unlinkSync(TEST_AUDIO_PATH); } catch { }
    process.exit(0);
}

runBenchmark().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
