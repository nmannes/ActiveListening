#!/bin/bash
# schedule_run.sh — Schedules GPU launch + tvclient.js execution
# using `at` for non-blocking scheduling.
#
# Usage:
#   bash schedule_run.sh cava.json
#   bash schedule_run.sh cava.json --dry-run
#
# Timeline:
#   T-7min:  Launch GPU instance (with shutdown scheduled 30min after start)
#   T=0:     Run bun run tvclient.js --fromFile <file>

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse arguments ---
JSON_FILE=""
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        *) if [[ -z "$JSON_FILE" ]]; then JSON_FILE="$arg"; fi ;;
    esac
done

if [[ -z "$JSON_FILE" ]]; then
    echo "Usage: $0 <market-file.json> [--dry-run]"
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

# Compute launch time = 7 minutes before start
LAUNCH_EPOCH=$((START_EPOCH - 7 * 60))

# Shutdown delay = 37 minutes from launch (= 30 minutes after start)
SHUTDOWN_MINUTES=37

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
echo "  GPU launch:   $LAUNCH_HUMAN (T-7min)"
echo "  GPU shutdown:  30 min after start (${SHUTDOWN_MINUTES}min from launch)"
echo "========================================"

if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo "  at jobs that would be scheduled:"
    echo "    1) GPU launch   at $LAUNCH_AT"
    echo "    2) tvclient.js  at $START_AT"
    echo ""
    echo "  (dry run — nothing scheduled)"
    exit 0
fi

# Resolve to absolute path for the at job
ABS_JSON_FILE="$(cd "$(dirname "$JSON_FILE")" && pwd)/$(basename "$JSON_FILE")"

# --- Schedule GPU launch at T-7min ---
echo "$SCRIPT_DIR/launch_gpu_server.sh prod --shutdown-minutes $SHUTDOWN_MINUTES >> $SCRIPT_DIR/schedule_run.log 2>&1" \
    | at "$LAUNCH_AT"

# --- Schedule tvclient.js at start time ---
echo "cd $SCRIPT_DIR && bun run tvclient.js --fromFile $ABS_JSON_FILE >> $SCRIPT_DIR/schedule_run.log 2>&1" \
    | at "$START_AT"

echo ""
echo "Jobs scheduled. Output will be logged to $SCRIPT_DIR/schedule_run.log"
echo "Run 'atq' to see pending jobs, 'atrm <id>' to cancel."
