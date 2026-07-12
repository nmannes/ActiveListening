#!/usr/bin/env bash
# launch_windows_vm.sh — Start the dockur/windows VM for DRM-protected streams
#
# Usage:
#   ./scripts/launch_windows_vm.sh [market.json]
#
# On first run, dockur downloads Windows 11 and installs it unattended
# (~15-20 min). The OEM install.bat sets up Chrome, VB-Cable, ffmpeg, and
# a watchdog scheduled task that runs on every Windows boot.
#
# Subsequent runs boot directly into Windows in ~60s — the watchdog starts
# automatically via the ONSTART scheduled task.
#
# If a market.json file is provided, it is written to the shared folder so
# the watchdog picks it up automatically once Windows is ready.
#
# Prerequisites:
#   - Docker installed (root daemon at /var/run/docker.sock)
#   - KVM available (/dev/kvm)
#   - jq (JSON processor)
#
# See also: shutdown_windows_vm.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WINDOWS_DIR="$REPO_ROOT/windows"
SHARED_DIR="$WINDOWS_DIR/shared"
TMP_DIR="$SHARED_DIR/tmp"
HEARTBEAT_FILE="$SHARED_DIR/watchdog.heartbeat"
CONTAINER="kalshi-windows"

# dockur exposes a web viewer on 8006 once Windows is booted
WEB_PORT=8006
# Max wait for first-time Windows install (30 min)
FIRST_INSTALL_TIMEOUT=$((30 * 60))
# Max wait for subsequent boot (3 min)
BOOT_TIMEOUT=$((3 * 60))
# Polling interval
POLL=10

export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

# ── Archive helper ────────────────────────────────────────────────────────

archive_session() {
  local dir="$1"
  local archive="$HOME/vm-archive/$(date +%Y-%m-%d_%H%M%S)"
  mkdir -p "$archive"
  for f in "$dir"/market.json "$dir"/stream.json "$dir"/status.txt "$dir"/stop.txt "$dir"/audio.tmp.pcm "$dir"/audio.pcm; do
    [ -f "$f" ] && mv "$f" "$archive/"
  done
  log "Archived session to $archive"
}
trap 'archive_session "$TMP_DIR"' EXIT

# ── Prerequisites ─────────────────────────────────────────────────────────

cd "$WINDOWS_DIR"

if ! command -v docker &>/dev/null; then
  die "Docker is not installed."
fi
if ! docker ps &>/dev/null; then
  die "Cannot connect to Docker. Check DOCKER_HOST ($DOCKER_HOST) or permissions."
fi
if [ ! -e /dev/kvm ]; then
  die "/dev/kvm not found. KVM acceleration is required."
fi
if ! command -v jq &>/dev/null; then
  die "jq is required. Install it: sudo apt install jq"
fi

mkdir -p oem "$SHARED_DIR" "$TMP_DIR"

# ── Detect first boot vs subsequent ───────────────────────────────────────

IS_FIRST_BOOT=false
if [ -f data.img ] && [ -f windows.ver ]; then
  log "Existing VM disk found — this is a subsequent boot (~60s)."
else
  log "No VM disk found — first-time creation."
  log "dockur will download Windows 11 and install it unattended."
  log "This may take 15-20 minutes."

  # Clean up stale firmware so dockur starts fresh
  rm -f windows.{base,boot,mac,rom,vars,ver}
  IS_FIRST_BOOT=true
fi

# Clean stale session files
rm -f "$TMP_DIR/stop.txt" "$TMP_DIR/audio.pcm" "$TMP_DIR/audio.tmp.pcm" "$TMP_DIR/status.txt"
rm -f "$TMP_DIR/stream.json" "$TMP_DIR/market.json"

# ── Write market info (if provided) ───────────────────────────────────────

if [ $# -ge 1 ] && [ -f "$1" ]; then
  MARKET_JSON="$1"
  [[ "$MARKET_JSON" != /* ]] && MARKET_JSON="$REPO_ROOT/$MARKET_JSON"

  if [ ! -f "$MARKET_JSON" ]; then
    die "Market JSON file not found: $MARKET_JSON"
  fi

  log "Writing market info to shared folder..."
  cp "$MARKET_JSON" "$TMP_DIR/market.json"

  jq '{
    url: .mediaStreamURL,
    title: .title,
    slug: .slug,
    keywords: .keywords,
    speakerEntities: .speakerEntities,
    clipProfile: .clipProfile,
    eventStartTime: .eventStartTime
  }' "$MARKET_JSON" > "$TMP_DIR/stream.json"

  log "Market: $(jq -r .title "$MARKET_JSON")"
  log "Stream: $(jq -r .mediaStreamURL "$MARKET_JSON")"
fi

# ── Start the container ───────────────────────────────────────────────────

if docker ps --filter "name=$CONTAINER" --format '{{.Status}}' 2>/dev/null | grep -q .; then
  log "Container $CONTAINER is already running."
else
  log "Starting container..."
  docker compose -f docker-compose.yml up -d
  log "Container started."
fi

# ── Wait for Windows to be ready ──────────────────────────────────────────

if $IS_FIRST_BOOT; then
  TIMEOUT=$FIRST_INSTALL_TIMEOUT
  log "First-time install — up to $((TIMEOUT / 60)) minutes."
  log "Progress can be watched at http://localhost:$WEB_PORT"
else
  TIMEOUT=$BOOT_TIMEOUT
  log "Waiting for Windows to boot..."
fi

DEADLINE=$((SECONDS + TIMEOUT))
READY=false
while [ $SECONDS -lt $DEADLINE ]; do
  if curl -s -o /dev/null --max-time 2 "http://localhost:$WEB_PORT" 2>/dev/null; then
    READY=true
    break
  fi
  log "  not ready yet, retrying in ${POLL}s..."
  sleep $POLL
done

if ! $READY; then
  die "Timed out waiting for Windows. Check: docker compose -f $WINDOWS_DIR/docker-compose.yml logs"
fi

log "Windows is running."

# ── Wait for watchdog heartbeat ───────────────────────────────────────────

# On first boot, the OEM install.bat installs Chrome, VB-Cable, ffmpeg, then
# creates the ONSTART scheduled task. The task fires on next boot or can be
# triggered manually. Wait for the heartbeat file to confirm readiness.

if $IS_FIRST_BOOT; then
  log "First boot — waiting for OEM setup + watchdog (~5-10 min for deps)..."
  HB_TIMEOUT=$((15 * 60))
else
  HB_TIMEOUT=120
fi

HB_DEADLINE=$((SECONDS + HB_TIMEOUT))
HB_READY=false
while [ $SECONDS -lt $HB_DEADLINE ]; do
  if [ -f "$HEARTBEAT_FILE" ]; then
    HB_READY=true
    break
  fi
  sleep $POLL
done

if $HB_READY; then
  log "Watchdog is running."
  cat "$HEARTBEAT_FILE"
else
  log "WARNING: Watchdog heartbeat not detected within timeout."
  if $IS_FIRST_BOOT; then
    log "The VM may need a reboot for the ONSTART scheduled task to fire."
  fi
  log "To set up manually, RDP in and run:"
  log "  C:\\Users\\Docker\\Desktop\\Shared\\setup_watchdog.bat"
fi

# ── Done ──────────────────────────────────────────────────────────────────

echo ""
log "===== Windows VM is ready ====="
log "Web viewer:  http://localhost:$WEB_PORT"
log "RDP:         xfreerdp /v:localhost:3389 /u:Docker /p:admin"
log "Shared dir:  $SHARED_DIR"
log "Heartbeat:   $([ -f "$HEARTBEAT_FILE" ] && echo "present" || echo "MISSING")"
log ""
log "To watch logs:  docker compose -f $WINDOWS_DIR/docker-compose.yml logs -f"
log "To stop:        $SCRIPT_DIR/shutdown_windows_vm.sh"
