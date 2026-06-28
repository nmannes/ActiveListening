#!/bin/bash


export PATH="$HOME/.bun/bin:$PATH"

cd /home/nathan/kalshi
git pull
bun run /home/nathan/kalshi/main_loop.js >> /home/nathan/kalshi/main_loop.log 2>&1
