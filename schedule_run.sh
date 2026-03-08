#!/bin/bash
# schedule_run.sh — Schedules GPU launch + tvclient.js execution
# using `at` for non-blocking scheduling.
#
# Usage:
#   bash schedule_run.sh cava.json
#   bash schedule_run.sh cava.json --dry-run
#   bash schedule_run.sh cava.json --now
#
# Timeline:
#   T-7min:  Launch GPU instance (with shutdown scheduled 30min after start)
#   T=0:     Run bun run tvclient.js --fromFile <file>

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse arguments ---
JSON_FILE=""
DRY_RUN=false
RUN_NOW=false
SPOT_ARG=""
CLIENT_ONLY=false

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --now) RUN_NOW=true ;;
        --spot) SPOT_ARG="--spot" ;;
        --client-only) CLIENT_ONLY=true ;;
        --duration) 
            DURATION_MINUTES="$2"
            shift 2 ;;
        *) 
            if [[ "$arg" != "$DURATION_MINUTES" && -z "$JSON_FILE" ]]; then 
                JSON_FILE="$arg"
            fi 
            ;;
    esac
done

if [[ -z "$JSON_FILE" ]]; then
    echo "Usage: $0 <market-file.json> [--dry-run|--now|--spot|--client-only] [--duration minutes]"
    exit 1
fi

if [[ ! -f "$JSON_FILE" ]]; then
    echo "Error: File '$JSON_FILE' not found"
    exit 1
fi

# --- Parse eventStartTime from JSON ---
EVENT_START_TIME=$(jq -r '.eventStartTime' "$JSON_FILE")
if [[ -z "$EVENT_START_TIME" || "$EVENT_START_TIME" == "null" ]]; then
    echo "Error: No 'eventStartTime' field found in $JSON_FILE"
    exit 1
fi

# Convert to epoch seconds
START_EPOCH=$(date -d "$EVENT_START_TIME" +%s)
NOW_EPOCH=$(date +%s)

# Compute launch time = 3 minutes before start
LAUNCH_EPOCH=$((START_EPOCH - 3 * 60))

# Shutdown delay = given duration (default 30) + 3 minutes for early launch
DURATION_MINUTES=${DURATION_MINUTES:-30}
SHUTDOWN_MINUTES=$((DURATION_MINUTES + 3))

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
    echo "  GPU launch:   $LAUNCH_HUMAN (T-3min)"
    echo "  GPU shutdown:  ${DURATION_MINUTES} min after start (${SHUTDOWN_MINUTES}min from launch)"
fi
echo "========================================"

if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo "  at jobs that would be scheduled:"
    if [[ "$CLIENT_ONLY" != true ]]; then
        echo "    1) GPU launch   at $LAUNCH_AT"
    fi
    echo "    *) tvclient.js  at $START_AT"
    echo ""
    echo "  (dry run — nothing scheduled)"
    exit 0
fi

# Resolve to absolute path for the at job
ABS_JSON_FILE="$(cd "$(dirname "$JSON_FILE")" && pwd)/$(basename "$JSON_FILE")"

if [[ "$RUN_NOW" == true ]]; then
    # --- Run everything immediately ---
    if [[ "$CLIENT_ONLY" != true ]]; then
        echo "[$(date '+%H:%M:%S')] Launching GPU instance now..."
        bash "$SCRIPT_DIR/launch_gpu_server.sh" prod $SPOT_ARG --shutdown-minutes $SHUTDOWN_MINUTES  2>&1 | tee -a "$SCRIPT_DIR/schedule_run.log"
        if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
            echo "ERROR: launch_gpu_server.sh failed. Aborting."
            exit 1
        fi
    fi

    echo "[$(date '+%H:%M:%S')] Starting tvclient.js now..."
    cd "$SCRIPT_DIR" && exec bun run tvclient.js --fromFile "$ABS_JSON_FILE" --duration 45
    exit 0
fi

# --- Schedule GPU launch at T-3min ---
if [[ "$CLIENT_ONLY" != true ]]; then
    echo "$SCRIPT_DIR/launch_gpu_server.sh prod $SPOT_ARG --shutdown-minutes $SHUTDOWN_MINUTES  >> $SCRIPT_DIR/schedule_run.log 2>&1" \
        | at "$LAUNCH_AT"
fi

# --- Schedule tvclient.js at start time ---
echo "cd $SCRIPT_DIR && bun run tvclient.js --fromFile $ABS_JSON_FILE --duration 45 >> $SCRIPT_DIR/schedule_run.log 2>&1" \
    | at "$START_AT"

echo ""
echo "Jobs scheduled. Output will be logged to $SCRIPT_DIR/schedule_run.log"
echo "Run 'atq' to see pending jobs, 'atrm <id>' to cancel."
