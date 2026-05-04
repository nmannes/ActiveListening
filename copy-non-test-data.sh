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

echo "📥 Syncing s3://$BUCKET/ to $LOCAL_DIR/ ..."

# Build include arguments based on valid items
INCLUDE_ARGS=()
if [ -n "$VALID_ITEMS" ]; then
    while read -r item; do
        if [ -n "$item" ]; then
            # Re-include the item and its contents
            INCLUDE_ARGS+=(--include "$item/*" --include "$item")
        fi
    done <<< "$VALID_ITEMS"
fi

# Run the sync command (Download: S3 -> Local)
# Construction: --exclude "*" followed by specific --include flags
# "$@" allows passing additional flags like --dryrun or --delete
aws s3 sync "s3://$BUCKET/" "$LOCAL_DIR/" --quiet --exclude "*" "${INCLUDE_ARGS[@]}" "$@"

echo "✅ Sync operation completed."
