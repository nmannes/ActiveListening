#!/bin/bash
# pull_remote_logs.sh — Pulls runtime logs from the GPU instance
# Only runs if remote_server_ip.txt exists and the instance is reachable.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IP_FILE="$SCRIPT_DIR/remote_server_ip.txt"
SSH_KEY="$HOME/.ssh/us-east-1.pem"
REMOTE_USER="ec2-user"
LOCAL_LOG_DIR="$SCRIPT_DIR/logs/remote"

IP=$(./discover_instance.sh) || exit 0

# Check if instance is reachable (quick timeout)
if ! nc -zvw2 "$IP" 22 > /dev/null 2>&1; then
    echo "$(date) — Instance $IP not reachable, skipping" >> "$SCRIPT_DIR/logs/pull_logs.log"
    exit 0
fi

mkdir -p "$LOCAL_LOG_DIR"

rsync -az -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=5" \
    "$REMOTE_USER@$IP:/home/ec2-user/logs/" "$LOCAL_LOG_DIR/" 2>/dev/null

echo "$(date) — Pulled logs from $IP" >> "$SCRIPT_DIR/logs/pull_logs.log"
