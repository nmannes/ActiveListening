#!/bin/bash
# sync_code.sh — Automates re-syncing code to an existing AWS GPU instance

set -e

# --- Configuration ---
export SSH_KEY_PATH="$HOME/.ssh/us-east-1.pem" 
export REMOTE_USER="ec2-user"
export REMOTE_DIR="/home/ec2-user"

if [ ! -f "remote_server_ip.txt" ]; then
    echo "ERROR: remote_server_ip.txt not found. Cannot determine the server IP."
    echo "Make sure there's an instance running and remote_server_ip.txt exists in the current directory."
    exit 1
fi

PUBLIC_IP=$(cat remote_server_ip.txt)
echo "Targeting remote server at: $PUBLIC_IP"

# Use the environment argument if provided, otherwise default to prod
ENV=${1:-prod}
echo "Environment: $ENV"

# --- Sync Code ---
echo "Syncing code to remote instance..."

FILES_TO_COPY=(
    "remote_server.py"
    "clip.py"
    "requirements.txt"
    "remote_setup.sh"
    ".env.demo"
    ".env.prod"
    "demo_private_key.txt"
    "prod_private_key.txt"
)

rsync -avz -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
    "${FILES_TO_COPY[@]}" \
    "$REMOTE_USER@$PUBLIC_IP:$REMOTE_DIR/"

echo "Code synced."

# --- Restart Server ---
echo "Restarting server on remote instance..."

# Kill existing python server
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REMOTE_USER@$PUBLIC_IP" "fuser -k 8090/tcp 2>/dev/null; sleep 1"

# Start it back up
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$REMOTE_USER@$PUBLIC_IP" "source ~/.cuda_env 2>/dev/null; export ENV=$ENV DEVICE=\$(test -x /usr/bin/nvidia-smi && echo cuda || echo cpu); cd ~; setsid python3 remote_server.py > logs/server.log 2>&1 < /dev/null & sleep 5; if pgrep -f 'python3 remote_server' > /dev/null; then echo SERVER_OK; tail -3 logs/server.log; else echo SERVER_FAILED; cat logs/server.log; exit 1; fi"

echo "--------------------------------------------------------"
echo "Done! Server is running at $PUBLIC_IP:8090"
echo "ssh -i \"$SSH_KEY_PATH\" $REMOTE_USER@$PUBLIC_IP"
echo "Logs are available on remote at: ~/logs/server.log"
echo "--------------------------------------------------------"
