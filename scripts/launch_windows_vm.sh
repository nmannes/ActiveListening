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
WINDOWS_DIR="$SCRIPT_DIR/windows"

cd "$WINDOWS_DIR"

# Ensure required directories exist
mkdir -p shared oem

# Check KVM
if [ ! -e /dev/kvm ]; then
  echo "ERROR: /dev/kvm not found. KVM acceleration is required."
  exit 1
fi

# Check local ISO
if [ ! -f "win11x64.iso" ]; then
  echo "ERROR: win11x64.iso not found in $WINDOWS_DIR"
  echo "Download a Windows 11 ISO and place it there, or let dockur download it"
  echo "by removing the /custom.iso volume mount from docker-compose.yml."
  exit 1
fi

echo "== Starting Windows VM =="
docker compose -f docker-compose.yml up -d

echo ""
echo "VM is starting. Monitor installation at: http://localhost:8006"
echo "Once installed, connect via RDP:"
echo "  xfreerdp /v:localhost:3389 /u:Docker /p:admin +fonts +clipboard"
echo ""
echo "To start the audio bridge on Windows:"
echo "  powershell -File C:\\Shared\\bridge.ps1 -StreamUrl \"https://...\""
echo ""
echo "To stop the VM:"
echo "  ./destroy_windows_vm.sh"
