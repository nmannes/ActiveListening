#!/bin/bash


source ~/.bashrc

cd /home/nathan/kalshi

/home/nathan/.bun/bin/bun run /home/nathan/kalshi/main_loop.js >> /home/nathan/kalshi/main_loop.log 2>&1
