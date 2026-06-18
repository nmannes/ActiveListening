#!/bin/bash


export PATH="$HOME/.bun/bin:$PATH"

cd /home/nathan/kalshi

bun run /home/nathan/kalshi/src/js/main_loop.js >> /home/nathan/kalshi/main_loop.log 2>&1
