#!/bin/bash

# Navigate to the project directory
cd /home/nathan/kalshi

# Load environment variables from .env.prod
if [ -f .env.prod ]; then
    export $(grep -v '^#' .env.prod | xargs)
fi

rm -rf /home/nathan/kalshi/cache

# Run the discovery script using bun
# Output is logged to logs/run_discovery.log
LOG_LEVEL=debug /home/nathan/.bun/bin/bun run e2e_discovery.js >> /home/nathan/kalshi/logs/run_discovery.log 2>&1


LOG_LEVEL=debug /home/nathan/.bun/bin/bun run schedule_matches.js --lookahead 20 >> /home/nathan/kalshi/logs/schedule_matches.log 2>&1