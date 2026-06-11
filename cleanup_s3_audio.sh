#!/bin/bash
# cleanup_s3_audio.sh — Remove all locally cached audio/ directories from s3/
set -e

LOCAL_DIR="${1:-s3}"

if [ ! -d "$LOCAL_DIR" ]; then
    echo "Directory $LOCAL_DIR not found."
    exit 1
fi

BEFORE=$(du -sh "$LOCAL_DIR" 2>/dev/null | cut -f1)
DIRS=$(find "$LOCAL_DIR" -type d -name audio 2>/dev/null)

if [ -z "$DIRS" ]; then
    echo "No audio/ directories found in $LOCAL_DIR"
    exit 0
fi

echo "Removing audio directories from $LOCAL_DIR..."
for dir in $DIRS; do
    echo "  rm -rf $dir"
    rm -rf "$dir"
done

AFTER=$(du -sh "$LOCAL_DIR" 2>/dev/null | cut -f1)
echo ""
echo "Done. $LOCAL_DIR/ went from $BEFORE → $AFTER"
