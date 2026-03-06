#!/bin/bash
# remote_setup.sh — Configures the EC2 instance and starts the Kalshi server.
# This script is intended to be run ON THE REMOTE MACHINE.

set -e

ENV=$1
SHUTDOWN_MINUTES=${2:-30}

if [ -z "$ENV" ]; then
    echo "Usage: $0 [demo|prod] [shutdown_minutes]"
    exit 1
fi

echo "Scheduling shutdown in $SHUTDOWN_MINUTES minutes..."
sudo shutdown -h +$SHUTDOWN_MINUTES

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

echo "Pre-downloading CLIP model..."
python3 -c "import open_clip; open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')" >> logs/remote_setup.log 2>&1

echo "Detecting hardware..."
DEVICE="cpu"
if [[ "$ENV" == "prod" ]] && command -v nvidia-smi &> /dev/null; then 
    DEVICE="cuda"
    echo "Found GPU, setting DEVICE to cuda"
    echo "Installing CUDA libraries via pip..."
    pip3 install nvidia-cublas-cu12 nvidia-cudnn-cu12 >> logs/remote_setup.log 2>&1
    
    # Configure LD_LIBRARY_PATH for the remote_server.py process
    # Find CUDA libs installed via pip (works across Python versions)
    CUBLAS_DIR=$(dirname "$(find ~/.local /usr -name 'libcublas.so*' 2>/dev/null | head -1)" 2>/dev/null)
    CUDNN_DIR=$(dirname "$(find ~/.local /usr -name 'libcudnn.so*' 2>/dev/null | head -1)" 2>/dev/null)
    CUDA_PATHS="${CUBLAS_DIR}:${CUDNN_DIR}"
    if [ ! -z "$CUBLAS_DIR" ]; then
        echo "export LD_LIBRARY_PATH=\"$CUDA_PATHS:\$LD_LIBRARY_PATH\"" >> ~/.bashrc
        echo "export LD_LIBRARY_PATH=\"$CUDA_PATHS:\$LD_LIBRARY_PATH\"" > ~/.cuda_env
        echo "CUDA env written to ~/.cuda_env: $CUDA_PATHS"
    fi
fi

echo "export ENV=$ENV" >> ~/.bashrc
echo "export DEVICE=$DEVICE" >> ~/.bashrc
