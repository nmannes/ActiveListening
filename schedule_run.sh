#!/bin/bash
# schedule_run.sh — Schedules GPU launch + tvclient.js execution
# using `at` for non-blocking scheduling.
#
# Usage:
#   bash schedule_run.sh cava.json
#   bash schedule_run.sh cava.json --dry-run
#   bash schedule_run.sh cava.json --now
#   bash schedule_run.sh cava.json --force
#
# Timeline:
#   T-7min:  Launch GPU instance (with shutdown scheduled 30min after start)
#   T=0:     Run bun run tvclient.js --fromFile <file>

set -e
export TZ="America/New_York"
BUN="/home/nathan/.bun/bin/bun"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse arguments ---
JSON_FILE=""
DRY_RUN=false
RUN_NOW=false
SPOT_ARG=""
CLIENT_ONLY=false
FORCE=false
USE_BROWSER=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --now) RUN_NOW=true; shift ;;
        --spot) SPOT_ARG="--spot"; shift ;;
        --client-only) CLIENT_ONLY=true; shift ;;
        --force) FORCE=true; shift ;;
        --browser) USE_BROWSER=true; shift ;;
        --duration) 
            DURATION_MINUTES="$2"
            shift 2 ;;
        --server-duration)
            SERVER_DURATION_MINUTES="$2"
            shift 2 ;;
        *) 
            if [[ -z "$JSON_FILE" ]]; then 
                JSON_FILE="$1"
            fi
            shift ;;
    esac
done

if [[ -z "$JSON_FILE" ]]; then
    echo "Usage: $0 <market-file.json> [--dry-run|--now|--spot|--client-only] [--duration minutes] [--server-duration minutes]"
    exit 1
fi

if [[ ! -f "$JSON_FILE" ]]; then
    echo "Error: File '$JSON_FILE' not found"
    exit 1
fi

# --- Parse eventStartTime from JSON ---
if [[ "$RUN_NOW" == true || "$FORCE" == true ]]; then
    # Replicate prod delay: Launch +1m, Start +11m
    LAUNCH_EPOCH=$(date -d "+1 minute" +%s)
    START_EPOCH=$((LAUNCH_EPOCH + 10 * 60))
    EVENT_START_TIME=$(date -d "@$START_EPOCH" '+%Y-%m-%dT%H:%M:%S')
    echo "Forcing schedule to replicate prod env:"
    echo "  - GPU Launch: $(date -d "@$LAUNCH_EPOCH" '+%H:%M:%S')"
    echo "  - Client Run: $(date -d "@$START_EPOCH" '+%H:%M:%S') (+11m from now)"
else
    EVENT_START_TIME=$(jq -r '.eventStartTime' "$JSON_FILE")
    if [[ -z "$EVENT_START_TIME" || "$EVENT_START_TIME" == "null" ]]; then
        echo "Error: No 'eventStartTime' field found in $JSON_FILE"
        exit 1
    fi
    # Convert to epoch seconds
    START_EPOCH=$(date -d "$EVENT_START_TIME" +%s)
    # Compute launch time = 10 minutes before start
    LAUNCH_EPOCH=$((START_EPOCH - 10 * 60))
fi

NOW_EPOCH=$(date +%s)

# Shutdown delay = given duration (default 30) + 10 minutes for early launch
DURATION_MINUTES=${DURATION_MINUTES:-30}
SHUTDOWN_MINUTES=$((DURATION_MINUTES + 10))

# Server shutdown delay = given server duration (defaults to DURATION_MINUTES) + 10 minutes
SERVER_DURATION_MINUTES=${SERVER_DURATION_MINUTES:-$DURATION_MINUTES}
SERVER_SHUTDOWN_MINUTES=$((SERVER_DURATION_MINUTES + 10))

# Format times for `at` (HH:MM YYYY-MM-DD)
LAUNCH_AT=$(date -d "@$LAUNCH_EPOCH" '+%H:%M %Y-%m-%d')
START_AT=$(date -d "@$START_EPOCH" '+%H:%M %Y-%m-%d')

# Human-readable times for logging
START_HUMAN=$(date -d "@$START_EPOCH" '+%Y-%m-%d %H:%M:%S %Z')
LAUNCH_HUMAN=$(date -d "@$LAUNCH_EPOCH" '+%Y-%m-%d %H:%M:%S %Z')

echo "========================================"
echo "  Schedule Run"
echo "========================================"
echo "  File:         $JSON_FILE"
echo "  Event start:  $START_HUMAN"
if [[ "$CLIENT_ONLY" == true ]]; then
    echo "  Mode:         Client Only (Skipping GPU launch)"
else
    echo "  GPU launch:   $LAUNCH_HUMAN (T-10min)"
    echo "  GPU shutdown:  ${SERVER_DURATION_MINUTES} min after start (${SERVER_SHUTDOWN_MINUTES}min from launch)"
fi
echo "  Client dur:   ${DURATION_MINUTES} min after start (${SHUTDOWN_MINUTES}min from launch)"
echo "========================================"

if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo "  at jobs that would be scheduled:"
    if [[ "$CLIENT_ONLY" != true ]]; then
        echo "    1) GPU launch: $SCRIPT_DIR/launch_gpu_server.sh prod $SPOT_ARG --shutdown-minutes $SERVER_SHUTDOWN_MINUTES at $LAUNCH_AT"
    fi
    
    CMD_PREFIX=""
    BROWSER_ARG=""
    if [[ "$USE_BROWSER" == true ]]; then
        CMD_PREFIX="/home/linuxbrew/.linuxbrew/bin/xvfb-run -a "
        BROWSER_ARG="--browser"
    fi
    echo "    *) client.js:  cd $SCRIPT_DIR && $CMD_PREFIX$BUN run client.js --fromFile $ABS_JSON_FILE --duration $SHUTDOWN_MINUTES $BROWSER_ARG at $START_AT"
    echo ""
    echo "  (dry run — nothing scheduled)"
    exit 0
fi

# Resolve to absolute path for the at job
ABS_JSON_FILE="$(cd "$(dirname "$JSON_FILE")" && pwd)/$(basename "$JSON_FILE")"

# --- Schedule GPU launch at T-10min ---
if [[ "$CLIENT_ONLY" != true ]]; then
    echo "$SCRIPT_DIR/launch_gpu_server.sh prod $SPOT_ARG --shutdown-minutes $SERVER_SHUTDOWN_MINUTES  >> $SCRIPT_DIR/schedule_run.log 2>&1" \
        | at "$LAUNCH_AT"
fi

# --- Schedule tvclient.js at start time ---
CMD_PREFIX=""
BROWSER_ARG=""
if [[ "$USE_BROWSER" == true ]]; then
    CMD_PREFIX="/home/linuxbrew/.linuxbrew/bin/xvfb-run -a "
    BROWSER_ARG="--browser"
fi

echo "cd $SCRIPT_DIR && ( $CMD_PREFIX$BUN run client.js --fromFile $ABS_JSON_FILE --duration $SHUTDOWN_MINUTES $BROWSER_ARG >> $SCRIPT_DIR/schedule_run.log 2>&1; rm -f $ABS_JSON_FILE )" \
    | at "$START_AT"

echo ""
echo "Jobs scheduled. Output will be logged to $SCRIPT_DIR/schedule_run.log"
echo "Run 'atq' to see pending jobs, 'atrm <id>' to cancel."
