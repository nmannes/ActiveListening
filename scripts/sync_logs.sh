#!/bin/bash
# sync_logs.sh — Merge server (CloudWatch) and client (local) logs for a run UUID
# Usage: sync_logs.sh <run-uuid> [--slug <slug>] [--hours <n>] [--instance <id>]
set -e

RUN_UUID=""
SLUG=""
HOURS_AGO="24"
INSTANCE_ID=""

usage() {
    echo "Usage: sync_logs.sh <run-uuid> [--slug <slug>] [--hours <n>] [--instance <id>]"
    echo "  run-uuid      The run UUID shared by server and client"
    echo "  --slug        Session slug for the merged output filename (default: uses UUID)"
    echo "  --hours       Lookback window for CloudWatch logs (default: 24)"
    echo "  --instance    Optional: filter to a specific EC2 instance log stream"
    exit 1
}

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        --slug)
            SLUG="$2"
            shift 2
            ;;
        --hours)
            HOURS_AGO="$2"
            shift 2
            ;;
        --instance)
            INSTANCE_ID="$2"
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        -*)
            echo "Unknown option: $1"
            usage
            ;;
        *)
            if [ -z "$RUN_UUID" ]; then
                RUN_UUID="$1"
                shift
            else
                echo "Unexpected argument: $1"
                usage
            fi
            ;;
    esac
done

if [ -z "$RUN_UUID" ]; then
    usage
fi

LOG_GROUP="/kalshi/worker"
# Find client log by scanning for *::<uuid>.log pattern
CLIENT_LOG=$(ls runtime_logs/*::"${RUN_UUID}".log 2>/dev/null | head -1)
if [ -z "$CLIENT_LOG" ]; then
    # Fallback: old naming pattern
    CLIENT_LOG="runtime_logs/${RUN_UUID}.log"
    [ ! -f "$CLIENT_LOG" ] && CLIENT_LOG=""
fi
TEMP_DIR=$(mktemp -d)
SERVER_LOG="$TEMP_DIR/server.log"

OUTPUT_NAME="${SLUG:-$RUN_UUID}"
MERGED_LOG="runtime_logs/${OUTPUT_NAME}_merged.log"

cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

# ── Determine time range from client log ──────────────────────────────
CHUNK_SECONDS=$((15 * 60))   # 15-minute query chunks

if [ -f "$CLIENT_LOG" ]; then
    CLIENT_START=$(head -1 "$CLIENT_LOG" | jq -r '.time // empty')
    CLIENT_END=$(tail -1 "$CLIENT_LOG" | jq -r '.time // empty')

    if [ -n "$CLIENT_START" ] && [ -n "$CLIENT_END" ]; then
        START_TIME=$(date -d "$CLIENT_START - 5 minutes" +%s 2>/dev/null)
        END_TIME=$(date -d "$CLIENT_END + 5 minutes" +%s 2>/dev/null)
    fi
fi

# Fallback to --hours if client timestamps couldn't be determined
if [ -z "$START_TIME" ] || [ -z "$END_TIME" ]; then
    END_TIME=$(date +%s)
    START_TIME=$(date -d "$HOURS_AGO hours ago" +%s)
    echo "Client timestamps unavailable, using last $HOURS_AGO hours (fallback)..."
    USE_CHUNKS=false
else
    echo "Client log range: $CLIENT_START → $CLIENT_END"
    echo "Query window: $(date -d @$START_TIME +'%Y-%m-%dT%H:%M:%S') → $(date -d @$END_TIME +'%Y-%m-%dT%H:%M:%S')"
    USE_CHUNKS=true
fi

# ── Fetch server logs from CloudWatch ──────────────────────────────────
echo "Querying CloudWatch $LOG_GROUP for $RUN_UUID..."

if [ -n "$INSTANCE_ID" ]; then
    QUERY="fields @timestamp, @message | filter @message like /$RUN_UUID/ | filter @logStream like /$INSTANCE_ID/ | sort @timestamp asc"
else
    QUERY="fields @timestamp, @message | filter @message like /$RUN_UUID/ | sort @timestamp asc"
fi

> "$SERVER_LOG"

run_query() {
    local chunk_start=$1
    local chunk_end=$2
    local query_id

    query_id=$(aws logs start-query \
        --log-group-name "$LOG_GROUP" \
        --start-time "$chunk_start" \
        --end-time "$chunk_end" \
        --query-string "$QUERY" \
        --query 'queryId' \
        --output text)

    if [ -z "$query_id" ]; then
        echo "  Failed to start CloudWatch query for chunk."
        return 1
    fi

    while true; do
        local result=$(aws logs get-query-results --query-id "$query_id")
        local status=$(echo "$result" | jq -r '.status')

        if [ "$status" = "Complete" ]; then
            echo "$result" | jq -r '.results[][] | select(.field == "@message") | .value' >> "$SERVER_LOG"
            return 0
        elif [ "$status" = "Failed" ] || [ "$status" = "Cancelled" ]; then
            echo "  CloudWatch query $status."
            return 1
        fi
        sleep 2
    done
}

if [ "$USE_CHUNKS" = true ]; then
    current=$START_TIME
    while [ $current -lt $END_TIME ]; do
        chunk_end=$((current + CHUNK_SECONDS))
        if [ $chunk_end -gt $END_TIME ]; then
            chunk_end=$END_TIME
        fi

        label_start=$(date -d @$current +%H:%M:%S)
        label_end=$(date -d @$chunk_end +%H:%M:%S)
        echo "  Chunk $label_start → $label_end ..."
        run_query $current $chunk_end
        current=$chunk_end
    done
else
    run_query $START_TIME $END_TIME
fi

SERVER_COUNT=$(wc -l < "$SERVER_LOG")
echo "Server log lines: $SERVER_COUNT"

# ── Check for client log ──────────────────────────────────────────────
if [ ! -f "$CLIENT_LOG" ]; then
    echo "Client log not found: $CLIENT_LOG"
    echo "Only server logs are available."
    mkdir -p runtime_logs
    cp "$SERVER_LOG" "$MERGED_LOG" 2>/dev/null || true
    [ -s "$MERGED_LOG" ] && echo "Wrote $MERGED_LOG" || echo "No logs found."
    exit 0
fi

CLIENT_COUNT=$(wc -l < "$CLIENT_LOG")
echo "Client log lines: $CLIENT_COUNT"

# ── Merge and sort by time ────────────────────────────────────────────
mkdir -p runtime_logs

python -c "
import json, sys

lines = []
for f in ('$SERVER_LOG', '$CLIENT_LOG'):
    with open(f) as fh:
        for raw in fh:
            raw = raw.strip()
            if not raw:
                continue
            try:
                obj = json.loads(raw)
                ts = obj.get('time', '')
                lines.append((ts, json.dumps(obj)))
            except json.JSONDecodeError:
                lines.append(('', raw))

lines.sort(key=lambda x: x[0])

with open('$MERGED_LOG', 'w') as out:
    for _, line in lines:
        out.write(line + '\n')
"

MERGED_COUNT=$(wc -l < "$MERGED_LOG")
echo "Merged $MERGED_COUNT lines → $MERGED_LOG"

# ── Telegram notification ──────────────────────────────────────────────
if [ -n "$TELEGRAM_KEY" ] && [ -n "$TELEGRAM_MY_ID" ]; then
    MSG="[sync_logs] ${OUTPUT_NAME}
UUID: ${RUN_UUID}
Server: ${SERVER_COUNT:-0} lines
Client: ${CLIENT_COUNT:-0} lines
Merged: ${MERGED_COUNT} lines"

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_KEY}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "$(echo "$MSG" | python -c "import json,sys; print(json.dumps({'chat_id': sys.argv[1], 'text': sys.stdin.read()}))" "$TELEGRAM_MY_ID")" \
        > /dev/null
    echo "Telegram notification sent."
fi
