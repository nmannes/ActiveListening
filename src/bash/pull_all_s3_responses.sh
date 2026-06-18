#!/bin/bash
# pull_all_s3_responses.sh — Downloads deepgram_responses/ from every session in the S3 bucket
# Usage: ./pull_all_s3_responses.sh [--no-audio]
set -e

NO_AUDIO=0
if [ "${1:-}" = "--no-audio" ]; then
    NO_AUDIO=1
fi

BUCKET="${S3_BUCKET:-recordings-846345203908-us-east-1-an}"
LOCAL_DIR="s3"

echo "Listing all session prefixes in s3://$BUCKET/ ..."
PREFIXES=$(aws s3 ls "s3://$BUCKET/" | awk '{print $2}' | sed 's|/$||')

COUNT=$(echo "$PREFIXES" | wc -l)
echo "Found $COUNT session(s)."

for PREFIX in $PREFIXES; do
    S3_PATH="s3://$BUCKET/$PREFIX/deepgram_responses/"
    LOCAL_PATH="$LOCAL_DIR/$PREFIX/deepgram_responses/"

    # Check if we have already synced this prefix locally
    PREFIX_LOWER=$(echo "$PREFIX" | tr '[:upper:]' '[:lower:]')
    ALREADY_SYNCED=0
    if [ -d "$LOCAL_PATH" ] && [ "$(ls -A "$LOCAL_PATH" 2>/dev/null)" ]; then
        if [[ "$PREFIX_LOWER" == *"mlb"* || "$PREFIX_LOWER" == *"nhl"* || "$PREFIX_LOWER" == *"nba"* ]] || { [ -d "$LOCAL_DIR/$PREFIX/audio" ] && [ "$(ls -A "$LOCAL_DIR/$PREFIX/audio" 2>/dev/null)" ]; }; then
            ALREADY_SYNCED=1
        fi
    fi

    if [ "$ALREADY_SYNCED" -eq 1 ]; then
        echo "⏩ SKIP: Already synced $PREFIX"
        continue
    fi

    # Check if deepgram_responses exists for this prefix
    FILE_COUNT=$(aws s3 ls "$S3_PATH" 2>/dev/null | wc -l)
    if [ "$FILE_COUNT" -eq 0 ]; then
        echo "⏩ SKIP: No deepgram_responses in $PREFIX"
        continue
    fi

    echo "📥 Syncing $PREFIX ($FILE_COUNT files) → $LOCAL_PATH"
    mkdir -p "$LOCAL_PATH"
    aws s3 sync "$S3_PATH" "$LOCAL_PATH"

    if [ "$NO_AUDIO" -eq 0 ]; then
        PREFIX_LOWER=$(echo "$PREFIX" | tr '[:upper:]' '[:lower:]')
        if [[ "$PREFIX_LOWER" != *"mlb"* && "$PREFIX_LOWER" != *"nhl"* && "$PREFIX_LOWER" != *"nba"* ]]; then
            S3_AUDIO_PATH="s3://$BUCKET/$PREFIX/audio/"
            LOCAL_AUDIO_PATH="$LOCAL_DIR/$PREFIX/audio/"
            echo "🔊 Syncing audio for $PREFIX → $LOCAL_AUDIO_PATH"
            mkdir -p "$LOCAL_AUDIO_PATH"
            aws s3 sync "$S3_AUDIO_PATH" "$LOCAL_AUDIO_PATH"
        fi
    fi

    # Auto-identify speaker if this session matches a sample-scheduling entry
    SLUG=$(echo "$PREFIX" | sed 's/_[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}_[0-9]\{2\}-[0-9]\{2\}-[0-9]\{2\}$//')
    SCHEDULE_FILE="sample-scheduling/${SLUG}.json"
    if [ -f "$SCHEDULE_FILE" ]; then
        SPEAKER=$(jq -r '.speaker' "$SCHEDULE_FILE")
        SPEAKER_NAME=$(jq -r '.speakerName' "$SCHEDULE_FILE")
        if [ -n "$SPEAKER" ] && [ "$SPEAKER" != "null" ] && [ -n "$SPEAKER_NAME" ] && [ "$SPEAKER_NAME" != "null" ]; then
            echo "🏷️  Auto-labeling $PREFIX speaker $SPEAKER → $SPEAKER_NAME"
            PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
            python "$PROJECT_ROOT/src/python/label_speaker.py" "$PREFIX" "$SPEAKER" "$SPEAKER_NAME"
        fi
    fi
done

echo ""
echo "✅ Done. All deepgram_responses synced to ./$LOCAL_DIR/"
if [ "$NO_AUDIO" -eq 0 ]; then
    echo ""
    echo "🔨 Rebuilding audio library from speaker_labels.json..."
    python "$PROJECT_ROOT/src/python/scripts/build_audio_library.py"
fi
