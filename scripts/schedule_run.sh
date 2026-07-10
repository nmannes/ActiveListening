#!/bin/bash
# schedule_run.sh — Enqueues client.js execution via BullMQ (Redis-backed job queue).
#
# Each event gets its own EC2 instance — the worker handles launch.
#
# Usage:
#   bash schedule_run.sh cava.json
#   bash schedule_run.sh cava.json --dry-run
#   bash schedule_run.sh cava.json --now
#   bash schedule_run.sh cava.json --force
#
# Timeline:
#   T-10min:  Enqueue run-client job (worker launches EC2 + runs client)

set -e
export TZ="America/New_York"
BUN="bun"
PYTHON="/home/nathan/.pyenv/shims/python"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse arguments ---
JSON_FILE=""
DRY_RUN=false
RUN_NOW=false
FORCE=false
USE_BROWSER=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --now) RUN_NOW=true; shift ;;
        --force) FORCE=true; shift ;;
        --browser) USE_BROWSER=true; shift ;;
        --duration)
            DURATION_MINUTES="$2"
            shift 2 ;;
        *)
            if [[ -z "$JSON_FILE" ]]; then
                JSON_FILE="$1"
            fi
            shift ;;
    esac
done

if [[ -z "$JSON_FILE" ]]; then
    echo "Usage: $0 <market-file.json> [--dry-run|--now|--browser] [--duration minutes]"
    exit 1
fi

if [[ ! -f "$JSON_FILE" ]]; then
    echo "Error: File '$JSON_FILE' not found"
    exit 1
fi

# --- Parse eventStartTime from JSON ---
if [[ "$RUN_NOW" == true || "$FORCE" == true ]]; then
    START_EPOCH=$(date -d "+1 minute" +%s)
    EVENT_START_TIME=$(date -d "@$START_EPOCH" '+%Y-%m-%dT%H:%M:%S')
    echo "Forcing immediate schedule:"
    echo "  - Client Run: $(date -d "@$START_EPOCH" '+%H:%M:%S')"
else
    EVENT_START_TIME=$(jq -r '.eventStartTime' "$JSON_FILE")
    if [[ -z "$EVENT_START_TIME" || "$EVENT_START_TIME" == "null" ]]; then
        echo "Error: No 'eventStartTime' field found in $JSON_FILE"
        exit 1
    fi
    START_EPOCH=$(date -d "$EVENT_START_TIME" +%s)
fi

NOW_EPOCH=$(date +%s)

CONFIG_GET="$SCRIPT_DIR/get_config.py"
CONFIG_DEFAULT_DURATION=$($PYTHON "$CONFIG_GET" durations defaultMinutes)
CONFIG_SCHEDULE_PADDING=$($PYTHON "$CONFIG_GET" timing schedulePaddingMinutes)
CONFIG_LAUNCH_BUFFER=$($PYTHON "$CONFIG_GET" timing launchBufferMinutes)

DURATION_MINUTES=${DURATION_MINUTES:-$CONFIG_DEFAULT_DURATION}
SHUTDOWN_MINUTES=$((DURATION_MINUTES + CONFIG_SCHEDULE_PADDING))

START_HUMAN=$(date -d "@$START_EPOCH" '+%Y-%m-%d %H:%M:%S %Z')
LAUNCH_EPOCH=$((START_EPOCH - 10 * 60))
LAUNCH_HUMAN=$(date -d "@$LAUNCH_EPOCH" '+%Y-%m-%d %H:%M:%S %Z')

# Extract slug from the JSON file
SLUG=$(jq -r '.slug' "$JSON_FILE")

echo "========================================"
echo "  Schedule Run"
echo "========================================"
echo "  File:         $JSON_FILE"
echo "  Slug:         $SLUG"
echo "  Event start:  $START_HUMAN"
echo "  Launch:       $LAUNCH_HUMAN"
echo "  Duration:     ${DURATION_MINUTES}min"
echo "  Mode:         NEW Server (dedicated EC2)"
echo "========================================"

if [[ "$DRY_RUN" == true ]]; then
    CMD_PREFIX=""
    BROWSER_ARG=""
    if [[ "$USE_BROWSER" == true ]]; then
        CMD_PREFIX="xvfb-run -a "
        BROWSER_ARG="--browser"
    fi
    echo ""
    echo "  BullMQ job that would be enqueued:"
    echo "    run-client: cd $SCRIPT_DIR && $CMD_PREFIX$BUN run client.js --fromFile $ABS_JSON_FILE --duration $SHUTDOWN_MINUTES $BROWSER_ARG at $LAUNCH_HUMAN"
    echo ""
    echo "  (dry run — nothing enqueued)"
    exit 0
fi

# Resolve to absolute path
ABS_JSON_FILE="$(cd "$(dirname "$JSON_FILE")" && pwd)/$(basename "$JSON_FILE")"

# --- Enqueue via BullMQ ---
BROWSER_FLAG="false"
if [[ "$USE_BROWSER" == true ]]; then
    BROWSER_FLAG="true"
fi

NOW_MS=$((NOW_EPOCH * 1000))
CLIENT_DELAY_MS=$(((LAUNCH_EPOCH - NOW_EPOCH) * 1000))
SERVER_SHUTDOWN_MINUTES=$((DURATION_MINUTES + CONFIG_LAUNCH_BUFFER + CONFIG_SCHEDULE_PADDING))

$BUN run enqueue_run_client.js \
    --marketFile "$ABS_JSON_FILE" \
    --duration "$SHUTDOWN_MINUTES" \
    --browser "$BROWSER_FLAG" \
    --slug "$SLUG" \
    --shutdownMinutes "$SERVER_SHUTDOWN_MINUTES" \
    --delay "$CLIENT_DELAY_MS"