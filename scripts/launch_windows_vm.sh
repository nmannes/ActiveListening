#!/usr/bin/env bash
# launch_windows_vm.sh — Start the dockur/windows VM for DRM-protected streams
#
# Usage:
#   ./launch_windows_vm.sh
#
# Starts the Windows VM via docker compose. On first run, Windows installs
# from the local ISO (~15-20 min). The OEM install.bat script sets up Chrome,
# VB-Cable, and ffmpeg automatically post-install.
#
# Once the VM is running, connect via RDP to start the audio bridge:
#   xfreerdp /v:localhost:3389 /u:Docker /p:admin
#   # On Windows: run Desktop\bridge.ps1 or
#   #   powershell -File C:\Shared\bridge.ps1 -StreamUrl "https://..."
#
# Prerequisites:
#   - Docker installed
#   - KVM available (/dev/kvm)
#   - windows/win11x64.iso (Windows 11 ISO, pre-downloaded)
#
# See also: destroy_windows_vm.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WINDOWS_DIR="$REPO_ROOT/windows"

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

# Note: dockur/windows downloads the ISO automatically from Microsoft
# if no /custom.iso is mounted, so no local ISO check is needed.

echo "== Starting Windows VM =="
docker compose -f docker-compose.yml up
