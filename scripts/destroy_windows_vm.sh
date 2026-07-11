#!/usr/bin/env bash
# destroy_windows_vm.sh — Stop the dockur/windows VM
#
# Usage:
#   ./destroy_windows_vm.sh
#
# Stops the Docker container but preserves the VM disk (data.img) and all
# state. To completely wipe the VM, delete windows/data.img and the firmware
# files (windows.*).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WINDOWS_DIR="$REPO_ROOT/windows"

cd "$WINDOWS_DIR"

echo "== Stopping Windows VM =="
docker compose -f docker-compose.yml down

echo ""
echo "VM stopped. Disk image preserved at: $WINDOWS_DIR/data.img"
echo "To start again:  ./launch_windows_vm.sh"
echo "To wipe the VM:  rm -f $WINDOWS_DIR/data.img $WINDOWS_DIR/windows.*"
