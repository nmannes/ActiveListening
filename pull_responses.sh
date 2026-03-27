#!/bin/bash
# pull_responses.sh — Downloads deepgram_responses from the remote instance

set -e

SSH_KEY_PATH="${HOME}/.ssh/us-east-1.pem"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/deepgram_responses"

PUBLIC_IP=$(./discover_instance.sh) || {
    echo "ERROR: Could not discover a running Kalshi worker."
    exit 1
}

echo "Targeting remote server at: $PUBLIC_IP"
echo "Syncing deepgram_responses to local..."

mkdir -p deepgram_responses

rsync -avz -e "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no" \
    "$REMOTE_USER@$PUBLIC_IP:$REMOTE_DIR/" \
    "./deepgram_responses/"

echo "Sync complete. Check the deepgram_responses/ directory."
