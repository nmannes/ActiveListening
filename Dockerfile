FROM python:3.11-slim-bookworm

# System dependencies — Node.js 20.x + ffmpeg + uv
RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && ln -sf /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /workspace

# yt-dlp for sample generation
RUN uv pip install --system --no-cache yt-dlp

# CPU-only PyTorch first, then Python deps
# (torch CPU must be installed first so nemo_toolkit doesn't pull the CUDA variant)
COPY requirements.txt ./
RUN uv pip install --system --no-cache torch --index-url https://download.pytorch.org/whl/cpu \
    && uv pip install --system --no-cache -r requirements.txt \
    && uv pip install --system --no-cache \
        python-telegram-bot \
        redis \
        scikit-learn \
        soundfile \
        pydub

# Node.js dependencies (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

# Project code (late layer — changes frequently)
COPY . .

# kalshi CLI on PATH
RUN chmod +x /workspace/kalshi && ln -sf /workspace/kalshi /usr/local/bin/kalshi

CMD ["kalshi", "--help"]
