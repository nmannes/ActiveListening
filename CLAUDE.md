# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Real-time audio/video monitoring system for Kalshi prediction markets. Discovers markets, matches them to live events, transcribes and identifies speakers via Deepgram + TitaNet, detects keyword signals, and executes trades.

## Commands

All commands dispatch through `./bin/kalshi <command>`, which routes to the correct runtime (Python, Node, or Bash).

```bash
# Core pipeline
./bin/kalshi discover              # Fetch markets + external schedules
./bin/kalshi schedule              # Match markets to events, enqueue BullMQ jobs
./bin/kalshi server                # Start WebSocket server (transcription + trading)
./bin/kalshi listen <file>         # One-off listening session from scheduling JSON

# Background services
./bin/kalshi bot                   # Telegram bot
./bin/kalshi queue-worker          # Redis queue worker (sample gen + save)
./bin/kalshi js-worker             # BullMQ worker (run-client, log-sync, scheduling-loop)

# Audio / speaker library
./bin/kalshi generate "Name"       # Generate voice samples from YouTube
./bin/kalshi build-library         # Build voice sample library from S3 recordings

# Infrastructure
./bin/kalshi deploy                # Deploy code to remote GPU server (rsync)
./bin/kalshi launch-gpu            # Launch EC2 GPU instance + deploy + start server
./bin/kalshi destroy               # Teardown all EC2 instances
./bin/kalshi logs                  # Pull session logs from remote

# UI & testing
./bin/kalshi ui                    # Interactive web UI for market discovery
./bin/kalshi test                  # Run Python test suite (pytest)
./bin/kalshi e2e-test              # End-to-end test against a provider
```

Run single test files:
```bash
python3 -m pytest tests/test_bedrock_inference.py
node matching.test.js
node lib/speaker_identification.test.js
```

## Architecture

**Three languages with distinct roles:**
- **Python** — server, audio processing, speaker ID (TitaNet), trading, Telegram bot, queue worker. `pylib/` is the Python library, `scripts/` has standalone scripts.
- **Node.js** — market discovery, scheduling, BullMQ worker, WebSocket client, scrapers, signal analysis. `lib/` is the JS library.
- **Bash** — infrastructure scripts (EC2 lifecycle, log sync, code deploy).

**Core pipeline:** Discovery → Scheduling → Listening → Trading

1. **Discovery** (`lib/discover_markets.js`, `lib/discovery_matcher.js`): Fetches Kalshi markets via API, scrapes external event schedules (ESPN, earnings calendars, TV listings, YouTube upcoming streams). Finds media sources and speaker entities for each market.

2. **Scheduling** (`lib/scheduling.js`, `schedule_matches.js`): Matches discovered markets to upcoming events, determines durations, enqueues BullMQ `run-client` jobs with per-market JSON files.

3. **Listening** (`server.py` + providers): A WebSocket server (`server.py`) receives PCM audio from clients. Audio flows through Deepgram for transcription + diarization. Speaker identification runs in two stages: TitaNet-Large embeddings (audio-based) and Bedrock LLM (transcript-based fallback). Detected keywords trigger trades.

4. **Trading** (`pylib/trade_processor.py`, `lib/word_configurations.js`): When whitelisted speakers say trigger phrases, fill-or-kill orders are placed on Kalshi. Keyword rules (substitutions, custom buy amounts) are in `lib/word_configurations.js`.

**Provider pattern** (`providers/`): Each provider module (youtube, browser, tv, yttv, espn, amazon) exports a standard interface — `start(wsUrl, logger)` → streams PCM audio to the server, `stop()` tears down. `client.js` loads the provider dynamically and handles all shared boilerplate (WebSocket connection, market parsing, shutdown).

**BullMQ queues** (`lib/queues.js`, `worker.js`): Three queues backed by Redis:
- `run-client` — launches EC2 instances, runs clients, destroys stacks
- `log-sync` — pulls session logs from remote
- `scheduling-loop` — runs discovery + scheduling

**Telegram bot** (`telegram_server.py`, `pylib/telegram.py`): Two channels — info (trades, scheduling, whitelist) and debug (speaker ID details, audio clips, transcripts). Handles `/generate`, `/samples`, `/trust`, `/status` commands and inline keyboard callbacks.

**Voice sample generation** (`scripts/generate_samples.py`): Searches YouTube with diverse queries, downloads audio, runs Silero VAD, computes TitaNet embeddings, clusters to isolate target speaker, sends candidates to Telegram for approve/reject.

## Configuration

Single source of truth: `config.yaml`. Read by JS via `js-yaml`, Python via `pyyaml`, Bash via `lib/get_config.py` helper. Environment variables (`.env.prod`) provide secrets: API keys, Redis host, S3 bucket.

Key config sections: `durations`, `timing`, `worker` (concurrency, thresholds), `server` (ports), `audio` (Deepgram model, sample rate), `trading` (default buy counts/prices), `aws` (region, AMI, key paths).

## Important patterns

- **Streaming pipeline**: Client captures media → FFmpeg transcodes to 16kHz mono PCM → WebSocket to server → Deepgram WebSocket for transcription → speaker ID → keyword matching → Kalshi trade API.
- **Client auto-detects provider**: If `--provider` is not specified, `client.js` classifies the stream URL to pick the right provider module.
- **EC2 lifecycle**: Each listening session gets a dedicated GPU instance launched via CloudFormation. The worker's finally block always attempts stack deletion. A 5s delay before deletion allows TCP connections to drain.
- **Orphan process cleanup**: After client.js exits, the worker runs `pkill -f "chrome.*<slug>"` and `pkill -f "ffmpeg.*<slug>"` to prevent FD/memory exhaustion. Provider `stop()` methods must be awaited — fire-and-forget `browser.close()` can leave Chrome processes that exhaust file descriptors and cause SSH loss.
- **The `main_loop.js`** spawns and supervises four long-running child processes: market UI, BullMQ worker, Telegram bot, and Redis queue worker. It restarts any that crash and enqueues the scheduling loop every 60 minutes.
- **Cache directory** (`cache/`): Stores discovery results, matched/unmatched markets, manual matches, unscheduled blocklist. Set `KALSHI_CACHE_DIR` to override.
