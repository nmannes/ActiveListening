# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Important:** All scripting must be done using `python` and not `python3`. The project uses pyenv-managed Python, and `python3` may resolve to a different version or not have the required packages available.

## Commands

All commands dispatch through the unified CLI (`./bin/kalshi`), which routes to the correct runtime (Python, Node, or Bash):

```bash
# Core pipeline
./bin/kalshi discover          # Fetch Kalshi markets + scrape external schedules (Puppeteer)
./bin/kalshi schedule          # Match markets to events, write per-session JSONs, enqueue jobs
./bin/kalshi listen <file>     # One-off listening session from a scheduling JSON
./bin/kalshi server            # Start the WebSocket server (Python)
./bin/kalshi js-worker         # Start the BullMQ worker (Node.js) — handles run-client, log-sync, scheduling-loop queues

# Audio / speaker
./bin/kalshi generate <name>   # Voice sample generation pipeline (YouTube → VAD → TitaNet → Telegram verify)
./bin/kalshi build-library     # Build voice sample library from S3 recordings
./bin/kalshi bot               # Persistent Telegram bot
./bin/kalshi queue-worker      # Redis queue worker for sample generation + save

# Infrastructure
./bin/kalshi deploy            # rsync code to remote GPU server
./bin/kalshi launch-gpu        # Launch EC2 GPU instance, deploy code, start server
./bin/kalshi destroy           # Teardown all EC2 instances
./bin/kalshi logs              # Pull session logs from remote

# UI / testing
./bin/kalshi ui                # Interactive web UI (Express + Bun hot-reload)
./bin/kalshi test              # Run Python test suite (pytest)
./bin/kalshi e2e-test          # End-to-end test against a provider (youtube, browser, tv, yttv, espn, amazon)
```

**Running individual tests:**
```bash
# Python tests
PYTHONPATH=. python -m pytest tests/test_signal_handler.py -v
PYTHONPATH=. python -m pytest tests/test_replay_session.py -v
PYTHONPATH=. python -m pytest tests/test_speaker_ask.py -v
PYTHONPATH=. python -m pytest tests/ -k "test_name" -v

# Node.js tests (Bun)
bun test tests/matching.test.js
bun test tests/e2e_discovery.test.js
bun test tests/speaker_identification.test.js
bun test tests/video_gif.test.js
bun test tests/speaker_confirmations.test.js
```

**Backtest (signal simulation):**
```bash
PYTHONPATH=. python backtest/simulate.py backtest_data/<slug>/signals.jsonl
PYTHONPATH=. python backtest/simulate.py backtest_data/<slug>/signals.jsonl --db market_tracking/<slug>.db --market scheduled/<slug>.json
```

## Architecture

This is a **real-time audio/video monitoring system** for Kalshi prediction markets. It discovers markets, matches them to live events (TV broadcasts, YouTube streams, etc.), transcribes audio via Deepgram, identifies speakers via TitaNet embeddings, detects keyword signals, and executes trades.

### Runtime model

The project uses **three runtimes** working together:
- **Node.js (Bun)** — discovery, scheduling, market matching, scraping, the BullMQ worker, and the streaming client
- **Python** — the WebSocket server, audio processing (TitaNet, VAD), speaker recognition, signal detection, trading, voice sample generation, and Telegram bot
- **Bash** — infrastructure scripts (EC2 management, code sync, log pulling)

The CLI dispatcher (`bin/kalshi`) determines which runtime to use for each command.

### Core pipeline

```
Discovery (Node)  →  Scheduling (Node)  →  Listening (Python server + Node client)
                       ↓                        ↓
                  BullMQ queues          Deepgram transcription
                  (run-client)           TitaNet speaker ID
                                         Keyword signal detection
                                              ↓
                                         Trade execution (Kalshi API)
```

1. **Discovery** (`e2e_discovery.js`): Fetches Kalshi markets via API, scrapes external event schedules using Puppeteer (ESPN, Fox News, MSNBC, C-SPAN, Amazon, YouTube upcoming streams, NCAA).

2. **Scheduling** (`schedule_matches.js`): Matches discovered markets to events using fuzzy entity matching (`lib/discovery_matcher.js`), writes per-session JSON files to `scheduled/`, and enqueues `run-client` BullMQ jobs for each match.

3. **Listening**: The Node.js `client.js` captures media from a provider (TV, YouTube, browser, etc.), connects via WebSocket to `server.py`, and streams PCM audio. The Python server streams to Deepgram for transcription + diarization, runs speaker identification, detects keyword signals, and executes trades.

### Key subsystems

**Provider system** (`providers/`): Each provider module exports a `start(options)` function that captures media from a different source — `tv.js` (HLS streams via ffmpeg), `browser.js` (Puppeteer-based capture for DRM'd sites), `youtube.js`, `yttv.js`, `espn.js`, `amazon.js`. `client.js` auto-detects the provider from the stream URL or accepts `--provider`.

**Speaker identification** (`pylib/speaker_recognition.py`, `pylib/speaker_identifier.py`): Two-stage identification. Audio-based: TitaNet-Large computes 192-dim speaker embeddings, compared to a reference library via cosine similarity (threshold 0.65, fallback 0.40). Transcript-based: Falls back to Bedrock LLM (Nova Lite) inference on the transcript when no voice sample exists.

**Speaker ask** (`pylib/speaker_ask.py`, `lib/video_gif.js`, `lib/speaker_confirmations.js`): Live human-in-the-loop fallback when the session can't confidently identify a speaker. The EC2 server (config `speakerAsk:`) sends a Telegram ask on the `voice` channel — speaker voice clip, a GIF of the video at that moment (client-side rolling frame ring in `lib/video_gif.js`), and a Wikipedia photo per candidate — with candidate / Other / Ignore buttons. Confirming labels the speaker for the session (trading whitelist) **and** saves quality-gated samples (label ≠ save: similarity + diversity gates, ~3 per confirm, 100/identity cap). Answers flow telegram_server (local) → Redis → `lib/speaker_confirmations.js` → WS → EC2; curated samples flow back over the WS and are written to `~/audio-library` only on the local box (the library of record).

**Signal detection & trading** (`pylib/signal_detector.py`, `pylib/trade_processor.py`): Per-speaker word buffers fed through a keyword phrase index (`pylib/keyword_matching.py`). When a whitelisted speaker says a trigger phrase, `SignalHandler` evaluates trading gates (confidence threshold, YES ask price floor, session loss cap) and places fill-or-kill orders on Kalshi.

**Voice sample generation** (`scripts/generate_samples.py`): Searches YouTube, downloads audio, runs Silero VAD for speech segments, computes TitaNet embeddings, clusters to isolate the target speaker's voice, sends candidates to Telegram for human verification. Review batches are capped at ≤4 segments per source video and ≤10 per batch; only the review set plus a bounded spare pool per video is persisted (disk/Redis). 100 total per speaker (`MAX_SAMPLES_PER_IDENTITY`, counted as `.embedding` files in `~/audio-library` — generation is skipped once an identity is at the cap).

**Backtest system** (`backtest/`): Replays saved Deepgram responses and orderbook snapshots through the exact same signal detection and trading gates to compute simulated P&L. `backtest/simulate.py` reads `signals.jsonl` and `market_tracking/*.db` to replay trades with realistic fills.

**Replay system** (`pylib/replay_runner.py`): Time-synced replay of speaker identification against saved recordings — feeds Deepgram responses + PCM audio through the `SpeakerRecognitionLoop` on a virtual clock to verify both audio-based and transcript-based identification offline.

**BullMQ queues** (`lib/queues.js`): Five Redis-backed queues:
- `run-client` — launches EC2 instances, runs client.js, tears down instances (concurrency: 5)
- `log-sync` — syncs session logs from remote instances
- `scheduling-loop` — runs discovery + scheduling
- `sample-generation` / `save-samples` — voice sample pipeline stages

The `main_loop.js` supervisor spawns `market_ui.js`, `worker.js`, `telegram_server.py`, and `queue_worker.py` as child processes with crash-restart.

**Configuration**: `config.yaml` is the single source of truth, read by JS (`js-yaml`), Python (`pyyaml`), and Bash (via `pylib/get_config.py`). Environment-specific secrets live in `.env.prod` / `.env.demo`.

### Directory map

| Path | Purpose |
|------|---------|
| `bin/kalshi` | Unified CLI dispatcher |
| `lib/` | JS libraries: discovery, scheduling, matching, scraping, trading, signals, queues |
| `pylib/` | Python libraries: audio processing, speaker ID, signal detection, trading, Telegram, models |
| `pylib/models/` | Pydantic models for market config, predictions, transcription, WebSocket messages |
| `providers/` | Media capture providers (tv, browser, youtube, yttv, espn, amazon) |
| `scripts/` | Standalone scripts: sample generation, queue worker, library builder, infra |
| `backtest/` | Offline signal simulation and P&L computation |
| `tests/` | Test suites (pytest for Python, Bun for JS) with fixtures for e2e and replay |
| `server.py` | WebSocket server entrypoint (Python) |
| `client.js` | WebSocket client (Node/Bun) |
| `main_loop.js` | Supervisor that spawns and restarts all persistent processes |
| `worker.js` | BullMQ worker for run-client, log-sync, scheduling-loop |
| `telegram_server.py` | Persistent Telegram bot |
| `config.yaml` | Shared runtime config across all three runtimes |
| `market_ui.js` | Express web UI for browsing markets and schedules |
| `audio-library/` | Voice sample WAV files + embeddings |
| `scheduled/` | Per-session scheduling JSONs (generated by schedule_matches.js) |

### Multi-language patterns

- JS and Python mirror key logic: keyword matching exists in both `lib/matching.js` and `pylib/keyword_matching.py` — the Python version is used at runtime on the server; the JS version is used in tests.
- Config flows through `config.yaml` → language-specific loaders (`lib/config.js`, `pylib/get_config.py`).
- Telegram messaging has dual implementations: `lib/telegram.js` (Node, for discovery/scheduling notifications) and `pylib/telegram.py` (Python, for server-side notifications like trades and speaker IDs).
- Two separate Telegram bot tokens: `TELEGRAM_KEY` (info: trades, scheduling) and `TELEGRAM_KEY_DEBUG` (debug: speaker ID details, transcripts, sample generation).

### CI

`.gitlab-ci.yml` defines two jobs:
- `server-tests`: Python 3.10, runs pytest on `test_bedrock_inference.py`, `test_replay_session.py`, `test_signal_handler.py`, `test_speaker_ask.py` with coverage
- `client-tests`: Bun, runs `tests/matching.test.js`, `tests/e2e_discovery.test.js`, `tests/speaker_identification.test.js`, `tests/video_gif.test.js`, `tests/speaker_confirmations.test.js`
