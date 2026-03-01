#!/bin/bash
# remote_setup.sh — Configures the EC2 instance and starts the Kalshi server.
# This script is intended to be run ON THE REMOTE MACHINE.

set -e

ENV=$1
REMOTE_DIR=$2

if [ -z "$ENV" ] || [ -z "$REMOTE_DIR" ]; then
    echo "Usage: $0 [demo|prod] [remote_dir]"
    exit 1
fi

cd "$REMOTE_DIR"

echo "Scheduling shutdown in 30 minutes..."
sudo shutdown -h +30

mkdir -p logs
echo "$(date) —— Starting remote_setup.sh" > logs/remote_setup.log

echo "Installing dependencies (this takes ~1-2 mins on fresh AMI)..."
# On Amazon Linux 2023, we need to enable the EPEL-like repos or just install ffmpeg
# Actually, AL2023 has ffmpeg in some repos, but let's be safe.
sudo dnf install -y python3-pip ffmpeg >> logs/remote_setup.log 2>&1
pip3 install -r requirements.txt >> logs/remote_setup.log 2>&1 || (echo "Pip install failed" && exit 1)

echo "Detecting hardware..."
DEVICE="cpu"
if command -v nvidia-smi &> /dev/null; then 
    DEVICE="cuda"
fi

echo "Launching remote_server.py in environment: $ENV ($DEVICE mode)..."
# Ensure the process survives the shell exit
remote_server.py --env "$ENV" --device "$DEVICE" --model base.en >> "logs/remote_server.log" 2>&1