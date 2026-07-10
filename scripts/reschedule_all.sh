#!/bin/bash

redis-cli FLUSHALL
rm -rf /home/nathan/kalshi/scheduled
bun run schedule_matches.js