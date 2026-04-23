#!/bin/bash

if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

PROD_DIR="/opt/kalshi"

if [ ! -d "$PROD_DIR" ]; then
    echo "Creating directory and cloning remote repository to $PROD_DIR..."
    mkdir -p $PROD_DIR
    chown nathan:nathan $PROD_DIR
    sudo -u nathan git clone git@gitlab.com:nmannes/kalshi.git $PROD_DIR
else
    echo "Updating existing repository at $PROD_DIR..."
    cd $PROD_DIR
    sudo -u nathan git pull origin main
fi

echo "Installing node modules..."
cd $PROD_DIR
sudo -u nathan /home/nathan/.bun/bin/bun install

echo "Installing systemd files..."
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
sudo cp $DIR/kalshi-scheduler.service /etc/systemd/system/
sudo cp $DIR/kalshi-updater.service /etc/systemd/system/
sudo cp $DIR/kalshi-updater.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now kalshi-scheduler
sudo systemctl enable --now kalshi-updater.timer

echo "kalshi-scheduler.service installed and enabled"
echo "kalshi-updater.timer installed and enabled"
echo "Deploy complete! kalshi-updater will check for updates automatically."

exit 0