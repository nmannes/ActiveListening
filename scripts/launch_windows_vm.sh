#!/usr/bin/env bash
# launch_windows_vm.sh — Start the dockur/windows VM for DRM-protected streams
#
# Usage:
#   ./launch_windows_vm.sh <market.json>
#
# The market JSON file (from scheduled/<slug>.json) is parsed and written to
# the Windows shared folder so the VM has access to market details.
#
# On first run, Windows installs from the local ISO (~15-20 min). The OEM
# install.bat script sets up Chrome, VB-Cable, and ffmpeg automatically.
#
# Once the VM is running, the watchdog.ps1 scheduled task picks up the job
# automatically. Or connect via RDP for manual control:
#   xfreerdp /v:localhost:3389 /u:Docker /p:admin
#
# Prerequisites:
#   - Docker installed
#   - KVM available (/dev/kvm)
#   - windows/win11x64.iso (Windows 11 ISO, pre-downloaded)
#   - jq (JSON processor)
#
# See also: destroy_windows_vm.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WINDOWS_DIR="$REPO_ROOT/windows"
SHARED_DIR="$WINDOWS_DIR/shared"

# ── Parse arguments ──────────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: $0 <market.json>"
  echo "  market.json — path to a market JSON file (e.g. scheduled/kxearningsmentiondal-26jul10.json)"
  exit 1
fi

MARKET_JSON="$1"
if [ ! -f "$MARKET_JSON" ]; then
  echo "ERROR: Market JSON file not found: $MARKET_JSON"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install it: sudo apt install jq"
  exit 1
fi

cd "$WINDOWS_DIR"

# Force root daemon socket — rootless can't access /dev/kvm
export DOCKER_HOST=unix:///var/run/docker.sock

# Ensure required directories exist
mkdir -p shared oem

# Check KVM
if [ ! -e /dev/kvm ]; then
  echo "ERROR: /dev/kvm not found. KVM acceleration is required."
  exit 1
fi

# ── Write market info to shared folder ───────────────────────────────

echo "== Writing market info to shared folder =="

# Write full market object for VM access
cp "$MARKET_JSON" "$SHARED_DIR/market.json"
echo "  → market.json"

# Write stream.json for watchdog.ps1
jq '{
  url: .mediaStreamURL,
  title: .title,
  slug: .slug,
  keywords: .keywords,
  speakerEntities: .speakerEntities,
  clipProfile: .clipProfile,
  eventStartTime: .eventStartTime
}' "$MARKET_JSON" > "$SHARED_DIR/stream.json"
echo "  → stream.json"

# Clean up stale stop/pcm files from previous runs
rm -f "$SHARED_DIR/stop.txt" "$SHARED_DIR/audio.pcm" "$SHARED_DIR/audio.tmp.pcm" "$SHARED_DIR/status.txt"

echo "== Market: $(jq -r .title "$MARKET_JSON") =="
echo "== Stream URL: $(jq -r .mediaStreamURL "$MARKET_JSON") =="

# ── Start the VM ─────────────────────────────────────────────────────

echo "== Starting Windows VM =="
docker compose -f docker-compose.yml up
