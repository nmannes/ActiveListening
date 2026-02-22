#!/bin/bash

# 1. Update and install standard Linux build tools + Puppeteer dependencies
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libasound2 libpangocairo-1.0-0 libpango-1.0-0 libxshmfence1 \
    libxkbcommon0 libwayland-client0 git curl

# 2. Install Homebrew & CLI Tools
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install ffmpeg tesseract pyenv

# 3. Install Bun (since your package.json uses it)
curl -fsSL https://bun.sh/install | bash

# 4. Install NVM & Node LTS
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts

# 5. Setup SSH & Tailscale
mkdir -p ~/.ssh
cat > ~/.ssh/authorized_keys << EOF
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH9aEzeJLNv6ftgFtQ4tsTmwobE1N+N/9jRSJhkR2NkV nathan@nathanslaptop
EOF

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 6. Disk Expansion (LVM)
sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv || true
sudo resize2fs /dev/ubuntu-vg/ubuntu-lv || true

# 7. Final Project Setup
# cd kalshi && bun install