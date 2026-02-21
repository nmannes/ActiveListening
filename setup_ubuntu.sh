#!/bin/bash


/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install ffmpeg tesseract pyenv
pyenv global 3.14.2


sudo snap install tvheadend

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash

export NVM_DIR="$HOME/.nvm"

mkdir -p "$NVM_DIR"

mkdir -p ~/.ssh



cat > ~/.ssh/authorized_keys << EOF
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH9aEzeJLNv6ftgFtQ4tsTmwobE1N+N/9jRSJhkR2NkV nathan@nathanslaptop
EOF