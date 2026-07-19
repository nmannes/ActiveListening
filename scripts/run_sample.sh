#!/bin/bash
set -e
FILE="$1"

echo "[run_sample] Starting with file: $FILE"

cd /home/nathan/kalshi
echo "[run_sample] Starting server.py in background..."
python server.py &
SERVER_PID=$!
echo "[run_sample] Server PID: $SERVER_PID, sleeping 60s..."
sleep 60

echo "[run_sample] Running client.js with timeout 10m..."
timeout 10m bun run client.js --local --fromFile "$FILE"
echo "[run_sample] client.js finished (exit code: $?)"

echo "[run_sample] Pulling S3 responses..."
bash scripts/pull_all_s3_responses.sh
echo "[run_sample] S3 pull complete"

SLUG=$(jq -r '.slug' "$FILE")
SPEAKER=$(jq -r '.speaker' "$FILE")
SPEAKER_NAME=$(jq -r '.speakerName' "$FILE")
echo "[run_sample] Slug=$SLUG Speaker=$SPEAKER SpeakerName=$SPEAKER_NAME"

SESSION_DIR=$(ls -d "s3/${SLUG}_"* 2>/dev/null | head -1)
if [ -n "$SESSION_DIR" ]; then
    echo "[run_sample] Labeling speaker in session: $SESSION_DIR"
    python scripts/label_speaker.py "$(basename "$SESSION_DIR")" "$SPEAKER" "$SPEAKER_NAME"
    echo "[run_sample] Speaker labeling done"
else
    echo "[run_sample] No session dir found for slug: $SLUG"
fi

echo "[run_sample] Killing server (PID: $SERVER_PID)..."
kill $SERVER_PID 2>/dev/null || true
echo "[run_sample] Done."
