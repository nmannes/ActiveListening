#!/usr/bin/env bash
# shutdown_windows_vm.sh — Stop the dockur/windows VM
#
# Usage:
#   ./shutdown_windows_vm.sh
#
# Stops the Docker container but preserves the VM disk (data.img) and all
# state. To completely wipe the VM, delete windows/data.img and the firmware
# files (windows.*).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WINDOWS_DIR="$REPO_ROOT/windows"
TMP_DIR="$WINDOWS_DIR/shared/tmp"

cd "$WINDOWS_DIR"

# ── Archive session files before stopping ─────────────────────────────
if [ -d "$TMP_DIR" ]; then
  ARCHIVE_DIR="$HOME/vm-archive/$(date +%Y-%m-%d_%H%M%S)"
  mkdir -p "$ARCHIVE_DIR"
  for f in "$TMP_DIR"/market.json "$TMP_DIR"/stream.json "$TMP_DIR"/status.txt "$TMP_DIR"/stop.txt "$TMP_DIR"/audio.tmp.pcm "$TMP_DIR"/audio.pcm; do
    [ -f "$f" ] && mv "$f" "$ARCHIVE_DIR/"
  done
  echo "Archived session to $ARCHIVE_DIR"
fi

echo "== Stopping Windows VM =="
docker compose -f docker-compose.yml down

echo ""
echo "VM stopped. Disk image preserved at: $WINDOWS_DIR/data.img"
echo "To start again:  ./launch_windows_vm.sh"
echo "To wipe the VM:  rm -f $WINDOWS_DIR/data.img $WINDOWS_DIR/windows.*"
