#!/bin/bash
set -e
FILE="$1"

eval "$(python3 -c "
import json
with open('$FILE') as f:
    d = json.load(f)
print(f'SLUG={d[\"slug\"]}')
print(f'SPEAKER={d.get(\"speaker\", \"\")}')
print(f'SPEAKER_NAME={d.get(\"speakerName\", \"\")}')
")"

cd /home/nathan/kalshi

python server.py &
SERVER_PID=$!
sleep 60

timeout 10m bun run client.js --local --fromFile "$FILE"

bash pull_all_s3_responses.sh

SESSION_DIR=$(ls -d "s3/${SLUG}_"* 2>/dev/null | head -1)
if [ -n "$SESSION_DIR" ]; then
    python label_speaker.py "$(basename "$SESSION_DIR")" "$SPEAKER" "$SPEAKER_NAME"
fi

kill $SERVER_PID 2>/dev/null || true
