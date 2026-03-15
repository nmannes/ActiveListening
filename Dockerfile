# Multi-stage Dockerfile for Kalshi GPU Processing on ECS
FROM nvidia/cuda:12.1-devel-ubuntu22.04 as base

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=$PATH:$CUDA_HOME/bin
ENV LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$CUDA_HOME/lib64

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    ffmpeg \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheel
RUN pip3 install --no-cache-dir --upgrade pip setuptools wheel

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Install additional CUDA libraries for PyTorch
RUN pip3 install --no-cache-dir nvidia-cublas-cu12 nvidia-cudnn-cu12

# Pre-download and cache models to speed up container startup
RUN python3 -c "import open_clip; open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')" && \
    python3 -c "from faster_whisper import WhisperModel; WhisperModel('base.en', device='cpu', compute_type='int8')"

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs debug

# Set permissions
RUN chmod +x *.sh 2>/dev/null || true

# Environment configuration
ENV DEVICE=cuda
ENV ENV=prod
ENV PORT=8090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8090/health || exit 1

# Expose ports
EXPOSE 8090 8092

# Default command - will be overridden by ECS task definition
CMD ["python3", "server.py", "--env", "prod", "--port", "8090", "--device", "cuda"]
