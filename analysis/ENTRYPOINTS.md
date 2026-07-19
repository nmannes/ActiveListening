# Common Entrypoints

All commands go through `./bin/kalshi <command>`. It dispatches to the right language
(Python, Node, Bash) under the hood.

## Core Pipeline

| Command | What it does |
|---------|-------------|
| `./kalshi discover` | Fetch Kalshi markets + external schedules |
| `./kalshi schedule` | Match markets to events, write scheduled JSONs, enqueue BullMQ jobs |
| `./kalshi listen <file>` | Run a one-off listening session from a sample scheduling JSON |
| `./kalshi server` | Start the WebSocket server (audio/video streaming, transcription, speaker ID, trading) |
| `./kalshi js-worker` | Start the BullMQ worker |

## Telegram Bot & Queue Worker (always running on client)

| Command | What it does |
|---------|-------------|
| `./kalshi bot [--debug]` | Persistent Telegram bot — handles /generate, /status, /trust, /samples, callbacks |
| `./kalshi queue-worker [--debug]` | Redis queue worker — processes sample-generation and save-samples jobs |

## Audio / Speaker Library

| Command | What it does |
|---------|-------------|
| `./kalshi generate "Name"` | Generate voice samples for a target (yt-dlp + TitaNet clustering) |
| `./kalshi generate "Name" --dry-run` | Dry-run: full pipeline without Telegram or saving, prints summary |
| `./kalshi build-library` | Build voice sample library from data/speaker_labels.json + S3 recordings |

## Infrastructure

| Command | What it does |
|---------|-------------|
| `./kalshi deploy` | Deploy local code changes to remote GPU server |
| `./kalshi launch-gpu` | Launch GPU EC2 instance, deploy code, start server |
| `./kalshi destroy` | Teardown all EC2 instances |
| `./kalshi logs` | Pull session logs from remote |

## UI & Testing

| Command | What it does |
|---------|-------------|
| `./kalshi ui` | Start the market discovery web UI |
| `./kalshi test` | Run the Python test suite |

## Raw commands (not yet in CLI)

For one-off debugging or scripts without a `kalshi` subcommand yet:

| Raw command | What it does |
|-------------|-------------|
| `node main_loop.js` | Main orchestration loop (discovery + scheduling every hour) |
| `node client.js` | WebSocket client — connects to server, streams PCM audio + video frames |
| `python3 scripts/label_speaker.py` | Manually label speakers in a recording session |
| `python3 tests/verify_identities_testing.py` | Offline replay test for speaker ID accuracy |
| `python3 scripts/infer_speakers.py` | Bedrock transcript-based inference on saved transcript |
| `node scripts/verify_logging.js` | Verify logging/metrics pipeline |
| `node compare_hits.js` | Compare hit detection between sessions |
| `node scripts/query_db.js` | Query the local results database |
