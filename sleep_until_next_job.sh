#!/usr/bin/env bash
# sleep_until_next_job.sh
# Suspends the machine (to RAM) and wakes up shortly before the next atq job.
#
# Usage:
#   sudo ./sleep_until_next_job.sh [MINUTES_BEFORE]
#
# MINUTES_BEFORE: how many minutes before the job to wake up (default: 2)
# Requires: rtcwake, atq, date, sort

set -euo pipefail

MINUTES_BEFORE="${1:-2}"

# ── Parse the earliest atq job ───────────────────────────────────────────────
NEXT_JOB_LINE=$(atq | sort -k6,6 -k3,3M -k4,4n -k5,5 | head -n1)

if [[ -z "$NEXT_JOB_LINE" ]]; then
  echo "No jobs in the atq queue. Nothing to do."
  exit 0
fi

# atq output format: ID  DAY MONTH DATE TIME YEAR QUEUE USER
# Example:           14  Wed Feb   25   02:05:00 2026 a nathan
JOB_ID=$(echo "$NEXT_JOB_LINE" | awk '{print $1}')
DAY_OF_WEEK=$(echo "$NEXT_JOB_LINE" | awk '{print $2}')
MONTH=$(echo "$NEXT_JOB_LINE" | awk '{print $3}')
DATE=$(echo "$NEXT_JOB_LINE" | awk '{print $4}')
TIME=$(echo "$NEXT_JOB_LINE" | awk '{print $5}')
YEAR=$(echo "$NEXT_JOB_LINE" | awk '{print $6}')

JOB_DATETIME="$MONTH $DATE $YEAR $TIME"
JOB_EPOCH=$(date -d "$JOB_DATETIME" +%s)

# ── Calculate wake time ──────────────────────────────────────────────────────
WAKE_EPOCH=$(( JOB_EPOCH - MINUTES_BEFORE * 60 ))
NOW_EPOCH=$(date +%s)

WAKE_HUMAN=$(date -d "@$WAKE_EPOCH" '+%Y-%m-%d %H:%M:%S')
JOB_HUMAN=$(date -d "@$JOB_EPOCH" '+%Y-%m-%d %H:%M:%S')
SECONDS_UNTIL=$((WAKE_EPOCH - NOW_EPOCH))

if (( WAKE_EPOCH <= NOW_EPOCH )); then
  echo "⚠  Wake time ($WAKE_HUMAN) is in the past — the next job fires too soon to sleep."
  echo "   Next job (ID $JOB_ID): $JOB_HUMAN"
  exit 1
fi

# ── Confirm & suspend ────────────────────────────────────────────────────────
echo "Next atq job:   #$JOB_ID at $JOB_HUMAN"
echo "Wake-up time:   $WAKE_HUMAN ($MINUTES_BEFORE min before job)"
echo "Sleeping for:   ~$(( SECONDS_UNTIL / 3600 ))h $(( (SECONDS_UNTIL % 3600) / 60 ))m"
echo ""
echo "Suspending to RAM now..."

rtcwake -m mem -t "$WAKE_EPOCH"

echo "☀  Awake! Next job (#$JOB_ID) fires at $JOB_HUMAN."
