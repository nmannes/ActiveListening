# Kalshi Event Monitoring

Real-time audio/video monitoring system for Kalshi prediction markets. Discovers markets, matches them to live events, transcribes and identifies speakers via Deepgram + TitaNet, detects keyword signals, and executes trades.

## Quick start

```bash
./bin/kalshi discover          # Fetch markets + external schedules
./bin/kalshi schedule          # Match markets to events, enqueue jobs
./bin/kalshi server            # Start the WebSocket server
./bin/kalshi bot               # Start the Telegram bot
./bin/kalshi queue-worker      # Start the Redis queue worker
```

All commands dispatch through `./bin/kalshi <command>` which routes to the correct runtime (Python, Node, or Bash).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Discovery   │────▶│  Scheduling   │────▶│  Listening     │
│  (markets,   │     │  (matching    │     │  (Deepgram,    │
│   schedules) │     │   to events)  │     │   speaker ID,  │
└─────────────┘     └──────────────┘     │   keyword sig) │
                                          └───────┬───────┘
                                                  │
                    ┌──────────────┐              │
                    │  Telegram    │◀─────────────┤
                    │  bot + queue │              │
                    │  worker      │              │
                    └──────┬───────┘     ┌───────┴───────┐
                           │             │  Trading       │
                           ▼             │  (Kalshi API)  │
                    ┌──────────────┐     └───────────────┘
                    │  Audio       │
                    │  Library     │
                    │  (~/audio-   │
                    │   library/)  │
                    └──────────────┘
```

## Core pipeline

### Discovery & scheduling

| Command | Description |
|---------|-------------|
| `./bin/kalshi discover` | Fetch Kalshi markets via API, scrape external event schedules (ESPN, earnings calendars, etc.) |
| `./bin/kalshi schedule` | Match discovered markets to upcoming events, write per-session scheduling JSONs, enqueue BullMQ jobs |
| `./bin/kalshi ui` | Interactive web UI for browsing discovered markets and schedules |

The scheduling loop (`main_loop.js`) runs discovery + scheduling hourly, then starts listening sessions at the scheduled times.

### Live monitoring

| Command | Description |
|---------|-------------|
| `./bin/kalshi server` | WebSocket server accepting PCM audio + video frames from clients |
| `./bin/kalshi listen <file>` | One-off listening session from a scheduling JSON file |
| `./bin/kalshi js-worker` | Node.js BullMQ worker for session lifecycle |

The server streams audio to Deepgram for transcription + diarization, runs speaker identification against a voice sample library, detects pre-configured keyword signals, and executes trades on Kalshi when whitelisted speakers say trigger phrases.

### Speaker identification

Two-stage identification:

1. **Audio-based (TitaNet-Large):** Computes 192-dim speaker embeddings from per-speaker WAV segments, compares against a reference library via cosine similarity.
2. **Transcript-based (Bedrock LLM):** Falls back to LLM inference on the transcript when no voice sample exists for a target entity.

Whitelisted speakers trigger trades when their keywords are detected. All other speaker ID details route to the debug Telegram channel.

### Audio library & sample generation

| Command | Description |
|---------|-------------|
| `./bin/kalshi generate "Name"` | Download YouTube videos, extract target speaker voice via VAD + TitaNet clustering, send candidates for Telegram verification |
| `./bin/kalshi generate "Name" --dry-run` | Full pipeline without saving — prints per-video breakdown |
| `./bin/kalshi build-library` | Build voice sample library from `data/speaker_labels.json` + S3 recordings |

The sample generation pipeline:
1. Searches YouTube with diverse queries (speech, interview, press conference, speaking event, hearing)
2. Downloads audio, runs Silero VAD to extract 4–25s speech segments
3. Computes TitaNet embeddings, clusters to isolate the target speaker's voice
4. Caps at 5 segments per source video for diversity, 30 total per speaker
5. Sends candidates to Telegram for approve/reject verification
6. Saves approved samples to `~/audio-library/{slug}.wav` + `.embedding`

Pre-approved segments (confidence >= 0.85) are auto-accepted. The total cap is enforced across all runs — existing samples are counted before saving.

### Trading

Keyword signals are configured per market in `lib/word_configurations.js`. When a whitelisted speaker says a trigger phrase, the trade processor places fill-or-kill orders on Kalshi. Signal detection and trade execution notifications go to the info Telegram channel.

## Telegram integration

The Telegram bot (`./bin/kalshi bot`) runs persistently and handles:
- `/generate <name>` — enqueue voice sample generation
- `/samples <name>` — list voice samples in library
- `/trust <name>` — manage auto-approve preferences
- `/status` — show queue and worker status
- Inline keyboard callbacks for sample approve/reject/auto-approve-all

Two separate bot tokens are used:
- **Info channel** (`TELEGRAM_KEY`): whitelist additions, trades, market scheduling
- **Debug channel** (`TELEGRAM_KEY_DEBUG`): speaker ID details, audio clips, sample generation lifecycle, transcripts

Both channels use the same chat ID (`TELEGRAM_MY_ID`).

## Infrastructure

| Command | Description |
|---------|-------------|
| `./bin/kalshi deploy` | Deploy code changes to remote GPU server via rsync |
| `./bin/kalshi launch-gpu` | Launch EC2 GPU instance, deploy code, start server |
| `./bin/kalshi destroy` | Teardown all EC2 instances |
| `./bin/kalshi logs` | Pull session logs from remote server |

The server runs on AWS EC2 GPU instances. Audio processing (TitaNet embeddings, CLIP frame classification) uses the GPU. Configuration lives in `.env.prod`.

## Configuration

Key environment variables (from `.env.prod`):

| Variable | Purpose |
|----------|---------|
| `REDIS_HOST`, `REDIS_PORT` | Redis connection for BullMQ queues and verification state |
| `S3_BUCKET` | S3 bucket for recordings and speaker embeddings |
| `TELEGRAM_KEY` | Info channel bot token |
| `TELEGRAM_KEY_DEBUG` | Debug channel bot token |
| `TELEGRAM_MY_ID` | Chat ID for both channels |
| `KALSHI_KEY_ID`, `KALSHI_PRIVATE_KEY_PATH` | Kalshi trading API credentials |
| `DEEPGRAM_API_KEY` | Deepgram transcription + diarization |
| `DEVICE` | Torch device (`cpu` or `cuda`) |

## Project layout

```
.
├── bin/kalshi              # Unified CLI dispatcher
├── lib/                    # JavaScript libraries (discovery, scheduling, trading, signals)
├── pylib/                  # Python libraries (audio processing, speaker ID, trading, Telegram)
├── scripts/                # Standalone Python scripts (sample generation, queue worker, library builder)
├── server.py               # WebSocket server entrypoint
├── client.js               # WebSocket client (PCM audio + video frames)
├── main_loop.js            # Main orchestration loop (discovery → scheduling → listening)
├── telegram_server.py      # Persistent Telegram bot
├── worker.js               # Node.js BullMQ worker
├── sample-scheduling/      # Per-speaker sample scheduling JSONs
├── data/speaker_labels.json  # Session speaker identity labels
├── .env.prod               # Production environment variables
├── Dockerfile              # Container definition
└── ~/audio-library/        # Voice sample library (WAV + embeddings)
```

## Testing

```bash
./bin/kalshi test           # Run Python test suite
node matching.test.js       # Run matching tests
node lib/speaker_identification.test.js  # Speaker entity extraction tests
```
