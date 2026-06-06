#!/bin/bash
set -e
FILE="$1"

cd /home/nathan/kalshi
python server.py &
SERVER_PID=$!
sleep 60

timeout 10m /home/nathan/.bun/bin/bun run client.js --local --fromFile "$FILE"

bash pull_all_s3_responses.sh

SLUG=$(jq -r '.slug' "$FILE")
SPEAKER=$(jq -r '.speaker' "$FILE")
SPEAKER_NAME=$(jq -r '.speakerName' "$FILE")

SESSION_DIR=$(ls -d "s3/${SLUG}_"* 2>/dev/null | head -1)
if [ -n "$SESSION_DIR" ]; then
    python label_speaker.py "$(basename "$SESSION_DIR")" "$SPEAKER" "$SPEAKER_NAME"
fi

kill $SERVER_PID 2>/dev/null || true
