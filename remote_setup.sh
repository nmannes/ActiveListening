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

# In remote_setup.sh, you could add something like this:
if ! command -v ffmpeg &> /dev/null; then
    echo "FFmpeg not found. Downloading static build..."
    # URL for the BtbN build you mentioned
    URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
    curl -L -O "$URL"
    tar -xvf ffmpeg-master-latest-linux64-gpl.tar.xz > /dev/null
    sudo mv ffmpeg-master-latest-linux64-gpl/bin/ffmpeg /usr/local/bin/
    sudo mv ffmpeg-master-latest-linux64-gpl/bin/ffprobe /usr/local/bin/
    # Cleanup
    rm -rf ffmpeg-master-latest-linux64-gpl*
fi

sudo dnf install -y python3-pip >> logs/remote_setup.log 2>&1
pip3 install -r requirements.txt >> logs/remote_setup.log 2>&1 || (echo "Pip install failed" && exit 1)

echo "Detecting hardware..."
DEVICE="cpu"
if command -v nvidia-smi &> /dev/null; then 
    DEVICE="cuda"
fi

echo "Launching remote_server.py in environment: $ENV ($DEVICE mode)..."
# Ensure the process survives the shell exit
python3 remote_server.py --env "$ENV" --device "$DEVICE" --model base.en >> "logs/remote_server.log" 2>&1