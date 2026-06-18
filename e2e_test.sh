#!/bin/bash
# e2e_test.sh — End-to-end test runner for Kalshi
#
# Launches an EC2 instance, runs a client with a test market for a
# configurable duration, collects results, and optionally tears down.
#
# Usage:
#   ./e2e_test.sh --provider youtube --duration 5
#   ./e2e_test.sh --provider browser --duration 3 --skip-launch
#   ./e2e_test.sh --provider youtube --duration 5 --skip-teardown
#   ./e2e_test.sh --list
#
# Exit codes:
#   0 - All checks passed
#   1 - Setup failure (EC2 launch, server not ready)
#   2 - Client failure (client didn't connect or stream)
#   3 - Prerequisite check failure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_MARKETS_DIR="$SCRIPT_DIR/test-markets"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/us-east-1.pem}"
REGION="${REGION:-us-east-1}"
REMOTE_USER="${REMOTE_USER:-ubuntu}"
PYTHON="${PYTHON:-/home/nathan/.pyenv/shims/python}"
BUN="${BUN:-bun}"

# ── Defaults ────────────────────────────────────────────────────────────
PROVIDER="youtube"
DURATION=5
MARKET_FILE=""
SKIP_LAUNCH=false
SKIP_TEARDOWN=false
SKIP_SYNC=false
LIST_ONLY=false

SERVER_IP=""
INSTANCE_ID=""
STACK_NAME=""
LOG_FILE=""

# ── Color helpers ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass_msg()  { echo -e "${GREEN}[PASS]${NC} $*"; }
fail_msg()  { echo -e "${RED}[FAIL]${NC} $*"; }
warn_msg()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
info_msg()  { echo -e "${CYAN}[INFO]${NC} $*"; }

# ── Usage ────────────────────────────────────────────────────────────────
usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  --provider <name>      Provider to test (default: youtube)
                         Choices: youtube, browser, tv, yttv, espn, amazon
  --duration <minutes>   Client run duration in minutes (default: 5)
  --market-file <path>   Override the test market JSON file
  --skip-launch          Use an existing EC2 instance
  --skip-teardown        Leave instance running after test
  --skip-sync            Skip deploying local code changes to instance
  --list                 List available providers and their status
  --help                 Show this message
EOF
    exit 0
}

# ── Provider metadata ────────────────────────────────────────────────────
declare -A PROVIDER_READY PROVIDER_REQUIRES PROVIDER_MARKET

PROVIDER_READY[youtube]="ready"
PROVIDER_REQUIRES[youtube]="yt-dlp + ffmpeg"
PROVIDER_MARKET[youtube]="$TEST_MARKETS_DIR/youtube.json"

PROVIDER_READY[browser]="ready"
PROVIDER_REQUIRES[browser]="Chrome + ffmpeg"
PROVIDER_MARKET[browser]="$TEST_MARKETS_DIR/browser.json"

PROVIDER_READY[tv]="needs-tvheadend"
PROVIDER_REQUIRES[tv]="TVHeadend at localhost:9981 + ffmpeg"
PROVIDER_MARKET[tv]="$TEST_MARKETS_DIR/tv.json"

PROVIDER_READY[yttv]="needs-auth"
PROVIDER_REQUIRES[yttv]="cookies/yttv.json + YouTube TV subscription + Chrome"
PROVIDER_MARKET[yttv]="$TEST_MARKETS_DIR/yttv.json"

PROVIDER_READY[espn]="needs-auth"
PROVIDER_REQUIRES[espn]="ESPN account credentials + Chrome"
PROVIDER_MARKET[espn]="$TEST_MARKETS_DIR/espn.json"

PROVIDER_READY[amazon]="needs-auth"
PROVIDER_REQUIRES[amazon]="Amazon Prime credentials + PipeWire + Chrome"
PROVIDER_MARKET[amazon]="$TEST_MARKETS_DIR/amazon.json"

list_providers() {
    printf "%-12s %-18s %s\n" "PROVIDER" "STATUS" "REQUIREMENTS"
    printf "%-12s %-18s %s\n" "--------" "------------------" "------------------------------"
    for p in youtube browser tv yttv espn amazon; do
        printf "%-12s %-18s %s\n" "$p" "${PROVIDER_READY[$p]}" "${PROVIDER_REQUIRES[$p]}"
    done
    exit 0
}

# ── Parse args ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --provider)     PROVIDER="$2"; shift 2 ;;
        --duration)     DURATION="$2"; shift 2 ;;
        --market-file)  MARKET_FILE="$2"; shift 2 ;;
        --skip-launch)  SKIP_LAUNCH=true; shift ;;
        --skip-teardown) SKIP_TEARDOWN=true; shift ;;
        --skip-sync)    SKIP_SYNC=true; shift ;;
        --list)         LIST_ONLY=true; shift ;;
        --help)         usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

# ── List mode ────────────────────────────────────────────────────────────
if $LIST_ONLY; then
    list_providers
fi

# ── Validate ─────────────────────────────────────────────────────────────
if [[ -z "${PROVIDER_MARKET[$PROVIDER]:-}" ]]; then
    echo "Error: unknown provider '$PROVIDER'. Valid: youtube, browser, tv, yttv, espn, amazon"
    exit 3
fi

if [[ ! "$DURATION" =~ ^[0-9]+$ ]] || [[ "$DURATION" -lt 1 ]]; then
    echo "Error: --duration must be a positive integer (got: $DURATION)"
    exit 3
fi

MARKET_FILE="${MARKET_FILE:-${PROVIDER_MARKET[$PROVIDER]}}"
if [[ ! -f "$MARKET_FILE" ]]; then
    echo "Error: market file not found: $MARKET_FILE"
    exit 3
fi

# ── Prerequisite checks ──────────────────────────────────────────────────
check_cmd() {
    command -v "$1" >/dev/null 2>&1 || { fail_msg "Missing required command: $1"; return 1; }
}

info_msg "Checking prerequisites..."
ALL_PREREQS_OK=true

check_cmd aws    || ALL_PREREQS_OK=false
check_cmd jq     || ALL_PREREQS_OK=false
check_cmd node   || ALL_PREREQS_OK=false
check_cmd bun    || ALL_PREREQS_OK=false
check_cmd ssh    || ALL_PREREQS_OK=false
check_cmd ffmpeg || ALL_PREREQS_OK=false

# Provider-specific checks
case "$PROVIDER" in
    youtube)
        # Check yt-dlp at known paths
        YTDLP=""
        if command -v yt-dlp >/dev/null 2>&1; then
            YTDLP="yt-dlp"
        elif [[ -x /home/linuxbrew/.linuxbrew/bin/yt-dlp ]]; then
            YTDLP="/home/linuxbrew/.linuxbrew/bin/yt-dlp"
        fi
        if [[ -z "$YTDLP" ]]; then
            fail_msg "yt-dlp not found (provider=youtube requires it)"
            ALL_PREREQS_OK=false
        else
            pass_msg "yt-dlp: $YTDLP"
        fi
        ;;
    browser|yttv)
        if ! command -v google-chrome >/dev/null 2>&1 && \
           ! command -v google-chrome-stable >/dev/null 2>&1 && \
           ! command -v chromium-browser >/dev/null 2>&1 && \
           ! command -v chromium >/dev/null 2>&1; then
            fail_msg "Chrome/Chromium not found (provider=$PROVIDER requires it)"
            ALL_PREREQS_OK=false
        else
            pass_msg "Chrome found"
        fi
        ;;
    tv)
        if ! curl -s -o /dev/null -w "%{http_code}" "http://localhost:9981" 2>/dev/null | grep -q "200\|401\|302"; then
            warn_msg "TVHeadend not reachable at localhost:9981 (provider=tv requires it)"
        else
            pass_msg "TVHeadend reachable"
        fi
        ;;
esac

if ! $ALL_PREREQS_OK; then
    echo ""
    fail_msg "Prerequisite checks failed. Install missing tools and retry."
    exit 3
fi
pass_msg "All prerequisites met"

# ── Launch EC2 ───────────────────────────────────────────────────────────
cleanup_stack() {
    if $SKIP_TEARDOWN; then
        info_msg "Skipping teardown. Stack $STACK_NAME left running."
        return
    fi
    if [[ -n "$STACK_NAME" ]]; then
        info_msg "Tearing down stack: $STACK_NAME"
        aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK_NAME" || true
    fi
}

if $SKIP_LAUNCH; then
    info_msg "Skipping EC2 launch. Discovering existing instance..."
    SERVER_IP=$("$SCRIPT_DIR/discover_instance.sh" 2>/dev/null) || {
        fail_msg "No running Kalshi worker instance found. Use --skip-launch=false to launch one."
        exit 1
    }
    info_msg "Found existing instance at $SERVER_IP"
else
    info_msg "Launching EC2 instance (demo environment)..."
    info_msg "This will take 5-10 minutes for CloudFormation + setup..."

    LAUNCH_OUTPUT=$(bash "$SCRIPT_DIR/launch_gpu_server.sh" demo 2>&1)
    LAUNCH_EXIT=$?

    echo "$LAUNCH_OUTPUT"

    if [[ $LAUNCH_EXIT -ne 0 ]]; then
        fail_msg "EC2 launch failed (exit code: $LAUNCH_EXIT)"
        exit 1
    fi

    # Parse DEPLOY_RESULT from launch output
    DEPLOY_LINE=$(echo "$LAUNCH_OUTPUT" | grep "^DEPLOY_RESULT=" | tail -1)
    if [[ -z "$DEPLOY_LINE" ]]; then
        fail_msg "Could not parse DEPLOY_RESULT from launch output"
        exit 1
    fi

    SERVER_IP=$(echo "$DEPLOY_LINE" | sed 's/.*"ip":"\([^"]*\)".*/\1/')
    INSTANCE_ID=$(echo "$DEPLOY_LINE" | sed 's/.*"instanceId":"\([^"]*\)".*/\1/')
    STACK_NAME=$(echo "$DEPLOY_LINE" | sed 's/.*"stackName":"\([^"]*\)".*/\1/')

    if [[ -z "$SERVER_IP" || "$SERVER_IP" == "null" ]]; then
        fail_msg "Could not extract server IP from launch output"
        exit 1
    fi

    info_msg "Instance: $INSTANCE_ID"
    info_msg "IP: $SERVER_IP"
    info_msg "Stack: $STACK_NAME"

    # Register cleanup trap (runs on EXIT or INT/TERM)
    trap cleanup_stack EXIT INT TERM
fi

# ── Wait for server readiness ────────────────────────────────────────────
SSH_OPTS="-i $SSH_KEY_PATH -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes"

info_msg "Waiting for server to be ready (polling via SSH)..."
MAX_WAIT_SECS=1200  # 20 minutes
POLL_INTERVAL=15
ELAPSED=0

while true; do
    if ssh $SSH_OPTS "$REMOTE_USER@$SERVER_IP" 'systemctl is-active kalshi' 2>/dev/null | grep -q "active"; then
        pass_msg "kalshi service is active"
        break
    fi
    if [[ $ELAPSED -ge $MAX_WAIT_SECS ]]; then
        fail_msg "Timed out waiting for kalshi service after ${MAX_WAIT_SECS}s"
        exit 1
    fi
    info_msg "  ... waiting for service (${ELAPSED}s elapsed)"
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

info_msg "Waiting for model loading to complete..."
ELAPSED=0
while true; do
    LOG_CHECK=$(ssh $SSH_OPTS "$REMOTE_USER@$SERVER_IP" \
        'journalctl -u kalshi --no-pager -n 100 2>/dev/null | grep "Background resource initialization complete" || echo "NOT_READY"' \
        2>/dev/null)
    if [[ "$LOG_CHECK" != "NOT_READY" ]]; then
        pass_msg "Models loaded"
        break
    fi
    if [[ $ELAPSED -ge $MAX_WAIT_SECS ]]; then
        fail_msg "Timed out waiting for model initialization after ${MAX_WAIT_SECS}s"
        exit 1
    fi
    info_msg "  ... waiting for models (${ELAPSED}s elapsed)"
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

# Verify port 8090 is listening
if ssh $SSH_OPTS "$REMOTE_USER@$SERVER_IP" 'ss -tlnp | grep -q 8090' 2>/dev/null; then
    pass_msg "Port 8090 is listening"
else
    fail_msg "Port 8090 is not listening"
    exit 1
fi

pass_msg "Server is ready at $SERVER_IP:8090"

# ── Code sync ────────────────────────────────────────────────────────────
if $SKIP_SYNC; then
    info_msg "Skipping code sync"
else
    info_msg "Syncing local code to instance..."
    bash "$SCRIPT_DIR/sync_code.sh" demo 2>&1 | tail -5

    # Wait for server restart after sync
    info_msg "Waiting for server restart after code sync..."
    sleep 10
    ELAPSED=0
    while true; do
        if ssh $SSH_OPTS "$REMOTE_USER@$SERVER_IP" 'ss -tlnp | grep -q 8090' 2>/dev/null; then
            pass_msg "Server back online after sync"
            break
        fi
        if [[ $ELAPSED -ge 120 ]]; then
            fail_msg "Timed out waiting for server restart after sync"
            exit 1
        fi
        sleep 5
        ELAPSED=$((ELAPSED + 5))
    done
    # Give models time to reload
    sleep 15
fi

# ── Run client ────────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SCRIPT_DIR/e2e_results/${PROVIDER}_${TIMESTAMP}.log"
mkdir -p "$SCRIPT_DIR/e2e_results"

info_msg "Running client for ${DURATION} minutes..."
info_msg "Provider: $PROVIDER"
info_msg "Market file: $MARKET_FILE"
info_msg "Server: $SERVER_IP:8090"
info_msg "Log: $LOG_FILE"
echo ""

# Run client with timeout (duration + 5 min grace for setup/teardown)
CLIENT_TIMEOUT=$(( (DURATION + 5) * 60 ))
set +e
timeout $CLIENT_TIMEOUT node "$SCRIPT_DIR/client.js" \
    --ip "$SERVER_IP" \
    --provider "$PROVIDER" \
    --fromFile "$MARKET_FILE" \
    --duration "$DURATION" \
    2>&1 | tee "$LOG_FILE"
CLIENT_EXIT=$?
set -e

# ── Collect results ──────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  E2E TEST RESULTS"
echo "========================================"

PASS=true

# Check client log for key milestones
check_log() {
    local pattern="$1"
    local label="$2"
    if grep -q "$pattern" "$LOG_FILE" 2>/dev/null; then
        pass_msg "$label"
    else
        fail_msg "$label"
        PASS=false
    fi
}

info_msg "Client log analysis:"
check_log "Connected to remote server"    "WebSocket connected"
check_log "Session ready"                "Server accepted session"
check_log "Spawning:"                   "Audio capture started"

# These are "best effort" — may not appear for all providers/streams
if grep -q "TRANSCRIPT:" "$LOG_FILE" 2>/dev/null; then
    COUNT=$(grep -c "TRANSCRIPT:" "$LOG_FILE" 2>/dev/null || echo 0)
    pass_msg "Transcripts received ($COUNT messages)"
else
    warn_msg "No transcripts received (may be OK for short/noisy streams)"
fi

if grep -q "SIGNAL:" "$LOG_FILE" 2>/dev/null; then
    COUNT=$(grep -c "SIGNAL:" "$LOG_FILE" 2>/dev/null || echo 0)
    pass_msg "Keyword signals ($COUNT detected)"
fi

if grep -qi "ERROR\|FATAL" "$LOG_FILE" 2>/dev/null; then
    warn_msg "Errors found in client log:"
    grep -i "ERROR\|FATAL" "$LOG_FILE" 2>/dev/null | head -5 | while read line; do
        echo "       $line"
    done
fi

# Check server log for session activity
info_msg "Server log check:"
SERVER_CHECK=$(ssh $SSH_OPTS "$REMOTE_USER@$SERVER_IP" \
    'journalctl -u kalshi --no-pager -n 200 --since "5 minutes ago" 2>/dev/null | grep -c "Session ready\|Client identified\|signal\|order" || echo 0' \
    2>/dev/null)
if [[ "$SERVER_CHECK" -gt 0 ]]; then
    pass_msg "Server processed session activity ($SERVER_CHECK relevant log lines)"
else
    warn_msg "No session activity found in server log"
fi

# ── Report ────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  SUMMARY"
echo "========================================"
printf "%-20s %s\n" "Provider:" "$PROVIDER"
printf "%-20s %s\n" "Duration:" "${DURATION}m"
printf "%-20s %s\n" "Server IP:" "$SERVER_IP"
printf "%-20s %s\n" "Log file:" "$LOG_FILE"
if [[ -n "$STACK_NAME" ]]; then
    printf "%-20s %s\n" "Stack:" "$STACK_NAME"
fi
echo "========================================"

if $PASS; then
    pass_msg "E2E test passed"
    exit 0
else
    fail_msg "E2E test had failures (see log: $LOG_FILE)"
    exit 2
fi
