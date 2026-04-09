#!/bin/bash
# pull_all_s3_responses.sh — Downloads deepgram_responses/ from every session in the S3 bucket
set -e

BUCKET="${S3_BUCKET:-recordings-846345203908-us-east-1-an}"
LOCAL_DIR="s3"

echo "Listing all session prefixes in s3://$BUCKET/ ..."
PREFIXES=$(aws s3 ls "s3://$BUCKET/" | awk '{print $2}' | sed 's|/$||')

COUNT=$(echo "$PREFIXES" | wc -l)
echo "Found $COUNT session(s)."

for PREFIX in $PREFIXES; do
    S3_PATH="s3://$BUCKET/$PREFIX/deepgram_responses/"
    LOCAL_PATH="$LOCAL_DIR/$PREFIX/deepgram_responses/"

    # Check if deepgram_responses exists for this prefix
    FILE_COUNT=$(aws s3 ls "$S3_PATH" 2>/dev/null | wc -l)
    if [ "$FILE_COUNT" -eq 0 ]; then
        echo "⏩ SKIP: No deepgram_responses in $PREFIX"
        continue
    fi

    echo "📥 Syncing $PREFIX ($FILE_COUNT files) → $LOCAL_PATH"
    mkdir -p "$LOCAL_PATH"
    aws s3 sync "$S3_PATH" "$LOCAL_PATH" --quiet
done

echo ""
echo "✅ Done. All deepgram_responses synced to ./$LOCAL_DIR/"
