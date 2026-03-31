#!/bin/bash
# copy_aws_sso.sh - Copies AWS SSO configurations and tokens to a remote machine.

set -e

# --- Configuration ---
LOCAL_AWS_DIR="$HOME/.aws"
REMOTE_USER="nathan"

# --- Usage ---
usage() {
    echo "Usage: $0 <remote_host> [ssh_key_path]"
    echo "Example: $0 54.123.45.67"
    echo "Example: $0 54.123.45.67 ~/.ssh/my_key.pem"
    exit 1
}

REMOTE_HOST="${1:-100.124.20.12}"

echo "Copying AWS SSO configs to $REMOTE_HOST..."

# --- 1. Verify Local Configs ---
if [[ ! -d "$LOCAL_AWS_DIR" ]]; then
    echo "Error: Local AWS directory not found at $LOCAL_AWS_DIR"
    exit 1
fi

# --- 2. Prepare Remote ---
echo "Creating remote directory..."
ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" "mkdir -p ~/.aws"

# --- 3. Sync Files ---
echo "Syncing all AWS configurations (~/.aws)..."
rsync -avz --exclude 'cli/cache' -e "ssh -o StrictHostKeyChecking=no" \
    "$LOCAL_AWS_DIR/" \
    "$REMOTE_USER@$REMOTE_HOST:~/.aws/"

scp $HOME/.ssh/us-east-1.pem $REMOTE_USER@$REMOTE_HOST:~/.ssh/

echo "--------------------------------------------------------"
echo "Success! AWS configurations synced to $REMOTE_HOST"
echo "--------------------------------------------------------"

ssh $REMOTE_USER@$REMOTE_HOST 'aws sts get-caller-identity --region us-east-1'