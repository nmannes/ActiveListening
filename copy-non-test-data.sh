#!/bin/bash
# copy-non-test-data.sh — Syncs the remote S3 bucket to the local s3/ folder,
# ignoring any top-level objects/prefixes that contain "test" in their name.

set -e

# Load environment variables from .env.prod if it exists
if [ -f .env.prod ]; then
    echo "Loading environment from .env.prod..."
    # Export variables from .env.prod, ignoring comments and empty lines
    set -a
    source .env.prod
    set +a
fi

BUCKET="${S3_BUCKET:-recordings-846345203908-us-east-1-an}"
LOCAL_DIR="s3"

# Ensure local directory exists
mkdir -p "$LOCAL_DIR"

echo "📂 All remote items in s3://$BUCKET/ :"
REMOTE_LIST=$(aws s3 ls "s3://$BUCKET/" | awk '{print $2}' | sed 's|/$||')
echo "$REMOTE_LIST" | sed 's|^|  |'
echo ""

# Use inverse grep to find the non-test items
VALID_ITEMS=$(echo "$REMOTE_LIST" | grep -v "test" || true)
echo "✅ Valid items (non-test) to be synced:"
echo "$VALID_ITEMS" | sed 's|^|  |'
echo ""

# Sync each folder individually
TOTAL=$(echo "$VALID_ITEMS" | grep -c . || true)
CURRENT=0

while read -r item; do
    [ -z "$item" ] && continue
    CURRENT=$((CURRENT + 1))
    echo "$(date '+%H:%M:%S') 📥 [$CURRENT/$TOTAL] Syncing $item ..."
    aws s3 sync "s3://$BUCKET/$item/" "$LOCAL_DIR/$item/" --only-show-errors "$@" --exclude "$LOCAL_DIR/$item/audio/speaker_*.wav"
    JSON_COUNT=$(find "$LOCAL_DIR/$item" -name '*.json' 2>/dev/null | wc -l)
    WAV_COUNT=$(find "$LOCAL_DIR/$item" -name '*.wav' 2>/dev/null | wc -l)
    echo "             → $JSON_COUNT json, $WAV_COUNT wav"
done <<< "$VALID_ITEMS"

echo "✅ Sync complete. $TOTAL folders synced."
