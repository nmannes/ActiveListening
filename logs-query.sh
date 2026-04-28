#!/bin/bash

# Configuration
LOG_GROUP="/kalshi/worker"
QUERY_STRING="fields @timestamp, @message | filter @message =~ /(?i)\[signal\]/ or @message =~ /(?i)\[trade\]/ | sort @timestamp desc"
HOURS_AGO=${1:-1}

# Calculate start and end times in seconds since epoch
END_TIME=$(date +%s)
START_TIME=$(date -d "$HOURS_AGO hours ago" +%s)

echo "Starting query on $LOG_GROUP for logs containing '[SIGNAL]' or '[TRADE]' from the last $HOURS_AGO hour(s)..."

QUERY_ID=$(aws logs start-query \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --query-string "$QUERY_STRING" \
    --query 'queryId' \
    --output text)

if [ -z "$QUERY_ID" ]; then
    echo "Failed to start query."
    exit 1
fi

echo "Query started with ID: $QUERY_ID"
echo "Waiting for results..."

while true; do
    RESULT=$(aws logs get-query-results --query-id "$QUERY_ID")
    STATUS=$(echo "$RESULT" | jq -r '.status')
    
    if [ "$STATUS" == "Complete" ]; then
        echo "Query complete!"
        echo "$RESULT" > query_results.json
        echo "Results saved to query_results.json"
        
        # Display summary
        MATCH_COUNT=$(echo "$RESULT" | jq '.results | length')
        echo "Found $MATCH_COUNT matches."
        break
    elif [ "$STATUS" == "Failed" ] || [ "$STATUS" == "Cancelled" ]; then
        echo "Query $STATUS."
        exit 1
    fi
    
    sleep 2
done