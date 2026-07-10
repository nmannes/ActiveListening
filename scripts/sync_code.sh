#!/bin/bash
# sync_code.sh — Automates re-syncing code to an existing AWS GPU instance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Configuration ---
export SSH_KEY_PATH="$HOME/.ssh/us-east-1.pem"
export REMOTE_USER="ubuntu"
export REMOTE_DIR="/home/ubuntu"


PUBLIC_IP=$("$SCRIPT_DIR/discover_instance.sh") || {
    echo "ERROR: Could not discover a running Kalshi worker."
    exit 1
}
echo "Targeting remote server at: $PUBLIC_IP"

# Use the environment argument if provided, otherwise default to prod
ENV=${1:-prod}
echo "Environment: $ENV"

# --- Sync Code ---
echo "Syncing code to remote instance..."

# Kill existing python server
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REMOTE_USER@$PUBLIC_IP" "cd kalshi && git pull"

echo "Code synced."

# --- Restart Server ---
echo "Restarting server on remote instance..."

# Kill existing python server
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REMOTE_USER@$PUBLIC_IP" "fuser -k 8090/tcp 2>/dev/null; sleep 1"

# Start it back up
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REMOTE_USER@$PUBLIC_IP" "source ~/.bashrc 2>/dev/null; export ENV=$ENV DEVICE=\$(test -x /usr/bin/nvidia-smi && echo cuda || echo cpu); cd ~; setsid /home/ubuntu/.pyenv/versions/3.10.19/bin/python3 server.py > logs/server.log 2>&1 < /dev/null & sleep 5; if pgrep -f 'server.py' > /dev/null; then echo SERVER_OK; tail -3 logs/server.log; else echo SERVER_FAILED; cat logs/server.log; exit 1; fi"



echo "--------------------------------------------------------"
echo "Done! Server is running at $PUBLIC_IP:8090"
echo "ssh -i \"$SSH_KEY_PATH\" $REMOTE_USER@$PUBLIC_IP"
echo "Logs are available on remote at: ~/logs/server.log"
echo "--------------------------------------------------------"
