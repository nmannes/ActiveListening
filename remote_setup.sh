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

echo "Installing dependencies (this takes a moment on base AMI)..."
# On a base AMI, we also need to install python3-pip
sudo dnf install -y python3-pip > /dev/null
pip3 install -r requirements.txt

echo "Detecting hardware..."
DEVICE="cpu"
if command -v nvidia-smi &> /dev/null; then 
    DEVICE="cuda"
fi

mkdir -p logs

echo "Launching remote_server.py in environment: $ENV ($DEVICE mode)..."
nohup python3 remote_server.py --env "$ENV" --device "$DEVICE" --model base.en > "logs/remote_server.log" 2>&1 &

echo "Server started in background."
