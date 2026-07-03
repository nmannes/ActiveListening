#!/usr/bin/env bash
# setup_windows_vm_base.sh — Guided setup for the Windows VM base image
#
# Walks through creating a Windows QCOW2 image with Chrome, Node.js, ffmpeg,
# and the Kalshi streaming bridge. Automates host-side steps and pauses with
# clear instructions for manual (Windows GUI) steps.
#
# Usage:
#   ./setup.sh
#
# Output:
#   ~/windows-vm/base.qcow2 — ready to use with launch_windows_vm.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VM_HOME="${VM_HOME:-$HOME/windows-vm}"
WIN_ISO="$VM_HOME/Win11.iso"
VIRTIO_ISO="$VM_HOME/virtio-win.iso"
BASE_IMAGE="$VM_HOME/base.qcow2"
BRIDGE_SRC="$REPO_DIR/windows-bridge"
BRIDGE_ISO="$VM_HOME/bridge-files.iso"
DISK_SIZE="${DISK_SIZE:-60G}"
VM_MEMORY="${VM_MEMORY:-4G}"
VM_CPUS="${VM_CPUS:-4}"
VNC_PORT="${VNC_PORT:-0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

section()  { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1" >&2; }
info()    { echo -e "  $1"; }
prompt()  { echo -ne "${YELLOW}→${NC} $1"; read -r; }

require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Missing required command: $1"
    info "  Install with: $2"
    exit 1
  fi
}

# ── Banner ──────────────────────────────────────────────────────────────────

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Windows VM Base Image Setup                       ║"
echo "║   For DRM-protected streaming (Peacock, Netflix)    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Estimated time: 30-45 minutes (mostly waiting for installs)"
echo "This script automates host-side steps and guides manual ones."
echo ""

# ── Step 0: Check prerequisites ─────────────────────────────────────────────

section "Step 0: Check prerequisites"

require_cmd qemu-system-x86_64 "sudo apt install qemu-system-x86 qemu-utils (Debian/Ubuntu) or sudo dnf install qemu-kvm qemu-img (Fedora)"
require_cmd qemu-img             "sudo apt install qemu-utils"
require_cmd wget                 "sudo apt install wget"

if [ ! -w /dev/kvm ]; then
  error "/dev/kvm is not accessible."
  info "  Add your user to the kvm group: sudo usermod -aG kvm \$USER"
  info "  Then log out and back in."
  exit 1
fi
success "KVM is available"

# Check for VNC viewer (warn only — user can install later)
if ! command -v vncviewer &>/dev/null; then
  warn "vncviewer not found — you'll need a VNC client to interact with the VM"
  info "  Install: sudo apt install tigervnc-viewer"
fi

mkdir -p "$VM_HOME"

# ── Step 1: Download required files ─────────────────────────────────────────

section "Step 1: Download required files"

# --- virtio-win.iso ---
if [ -f "$VIRTIO_ISO" ]; then
  success "virtio-win.iso already downloaded"
else
  info "Downloading virtio-win.iso (required for disk/network drivers)..."
  wget -q --show-progress \
    "https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso" \
    -O "$VIRTIO_ISO"
  success "Downloaded virtio-win.iso"
fi

# --- Windows ISO ---
if [ -f "$WIN_ISO" ]; then
  success "Windows ISO found at $WIN_ISO"
else
  echo ""
  warn "Windows 10/11 ISO not found at $WIN_ISO"
  echo ""
  echo "  Download from: https://www.microsoft.com/software-download/windows11"
  echo "  Save it as:    $WIN_ISO"
  echo ""
  echo "  If you're on a headless machine, download it elsewhere and scp it here."
  echo ""
  prompt "Press Enter after you've downloaded the ISO (or Ctrl-C to quit)"

  if [ ! -f "$WIN_ISO" ]; then
    error "Still can't find $WIN_ISO — please download it and re-run this script."
    exit 1
  fi
  success "Windows ISO found"
fi

# ── Step 2: Build bridge-files.iso ──────────────────────────────────────────

section "Step 2: Build bridge-files.iso"

if [ -f "$BRIDGE_ISO" ]; then
  success "bridge-files.iso already exists"
else
  info "Creating an ISO with the bridge files so you can copy them into the VM..."
  info "  Files included: package.json, bridge.js, setup.ps1"

  TMPDIR=$(mktemp -d)
  cp "$BRIDGE_SRC/package.json" "$BRIDGE_SRC/bridge.js" "$BRIDGE_SRC/setup.ps1" "$TMPDIR/"

  if command -v genisoimage &>/dev/null; then
    genisoimage -quiet -o "$BRIDGE_ISO" -J "$TMPDIR" 2>/dev/null
  elif command -v mkisofs &>/dev/null; then
    mkisofs -quiet -o "$BRIDGE_ISO" -J "$TMPDIR" 2>/dev/null
  else
    error "Need genisoimage or mkisofs to create the bridge ISO"
    info "  Install: sudo apt install genisoimage"
    info "  Alternatively, copy bridge files into the VM manually later."
    rm -rf "$TMPDIR"
    exit 1
  fi

  rm -rf "$TMPDIR"
  success "Created bridge-files.iso ($(du -h "$BRIDGE_ISO" | cut -f1))"
fi

# ── Step 3: Create disk image ───────────────────────────────────────────────

section "Step 3: Create disk image"

if [ -f "$BASE_IMAGE" ]; then
  warn "Base image already exists at $BASE_IMAGE"
  prompt "Overwrite it? [y/N]: "
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Keeping existing image. Remove it manually if you want a fresh start."
  else
    rm -f "$BASE_IMAGE"
    info "Removed old image"
  fi
fi

if [ ! -f "$BASE_IMAGE" ]; then
  info "Creating ${DISK_SIZE} disk image..."
  qemu-img create -f qcow2 "$BASE_IMAGE" "$DISK_SIZE"
  success "Created $BASE_IMAGE ($DISK_SIZE)"
fi

# ── Step 4: Install Windows ─────────────────────────────────────────────────

section "Step 4: Install Windows (interactive)"

echo ""
echo "  A QEMU VM will start. Connect via VNC to follow the installer:"
echo ""
echo -e "    ${GREEN}vncviewer localhost:${VNC_PORT}${NC}"
echo ""
echo "  ─── Windows install checklist ───"
echo ""
echo "  1. When asked 'Where do you want to install Windows?':"
echo "     → Click 'Load driver'"
echo "     → Browse to the virtio-win CD → viostor/w10/amd64"
echo "     → Select the driver → the 60GB disk should appear"
echo ""
echo "  2. Bypass Microsoft account (Windows 11):"
echo "     → At the network screen, press Shift+F10"
echo "     → Run: oobe\\bypassnro"
echo "     → System reboots, then 'I don't have internet' appears"
echo ""
echo "  3. Create local account:"
echo "     → Username: kalshi"
echo "     → No password (leave blank)"
echo ""
echo "  4. Complete OOBE, get to the desktop."
echo ""
echo "  5. Inside the VM: Start → Shut down"
echo "     (The QEMU process will exit when Windows shuts down)"
echo ""
echo "  ─────────────────────────────"
echo ""
prompt "Press Enter to launch the Windows installer VM..."

info "Launching installer VM..."
qemu-system-x86_64 \
  -enable-kvm \
  -m "$VM_MEMORY" \
  -smp "$VM_CPUS" \
  -cdrom "$WIN_ISO" \
  -drive "file=${VIRTIO_ISO},media=cdrom" \
  -drive "file=${BASE_IMAGE},format=qcow2,if=virtio" \
  -netdev user,id=net0 \
  -device virtio-net,netdev=net0 \
  -vga std \
  -vnc ":$VNC_PORT" \
  -boot order=d || {
    error "QEMU exited with an error"
    exit 1
  }

success "Installer VM exited (Windows installed and shut down)"

# ── Step 5: First boot and configure ────────────────────────────────────────

section "Step 5: First boot — configure Windows"

echo ""
echo "  Launching Windows for configuration. Connect via VNC:"
echo ""
echo -e "    ${GREEN}vncviewer localhost:${VNC_PORT}${NC}"
echo ""
echo "  ─── Configuration checklist ───"
echo ""
echo "  1. Install virtio network driver (if no internet):"
echo "     → Open Device Manager (Win+X → Device Manager)"
echo "     → Find Ethernet controller with yellow warning"
echo "     → Update driver → Browse → virtio-win CD → NetKVM/w10/amd64"
echo ""
echo "  2. Enable auto-login:"
echo "     → Win+R → netplwiz → Enter"
echo "     → Uncheck 'Users must enter a user name and password...'"
echo "     → Apply → enter username 'kalshi' and leave password blank"
echo ""
echo "  3. Disable lock screen (Pro/Enterprise only):"
echo "     → Win+R → gpedit.msc → Enter"
echo "     → Computer Config → Admin Templates → Control Panel → Personalization"
echo "     → 'Do not display the lock screen' → Enabled"
echo "     (Skip if you have Windows Home — gpedit.msc isn't available)"
echo ""
echo "  4. Configure power settings:"
echo "     → Settings → System → Power & sleep"
echo "     → Screen: Never, Sleep: Never"
echo ""
echo "  5. Install software (keep this VM running):"
echo ""
echo "     Chrome:     https://www.google.com/chrome/"
echo "     Node.js:    https://nodejs.org/ (20.x LTS, default options)"
echo ""
echo "     ffmpeg:"
echo "       → Download: https://www.gyan.dev/ffmpeg/builds/ (release essentials)"
echo "       → Extract to C:\\ffmpeg"
echo "       → Add C:\\ffmpeg\\bin to PATH:"
echo "         Win+R → sysdm.cpl → Advanced → Environment Variables"
echo "         → Edit Path → Add C:\\ffmpeg\\bin"
echo ""
echo "  6. Install the bridge:"
echo "     → Mount the bridge ISO (this script will add it as a second CDROM)"
echo "     → In PowerShell (as Administrator):"
echo ""
echo "       mkdir C:\\kalshi-bridge"
echo "       copy D:\\* C:\\kalshi-bridge\\"
echo "       cd C:\\kalshi-bridge"
echo "       npm install"
echo "       powershell -ExecutionPolicy Bypass -File setup.ps1"
echo ""
echo "     → Verify it works:"
echo "       node bridge.js"
echo "       # Should print: [bridge] Windows streaming bridge listening..."
echo ""
echo "  ─────────────────────────────────────"
echo ""
echo "  After completing all steps, shut down Windows."
echo "  Then come back here and press Enter."
echo ""
prompt "Press Enter to launch Windows for configuration..."

info "Launching configuration VM with bridge ISO attached..."
qemu-system-x86_64 \
  -enable-kvm \
  -m "$VM_MEMORY" \
  -smp "$VM_CPUS" \
  -drive "file=${BASE_IMAGE},format=qcow2,if=virtio" \
  -drive "file=${VIRTIO_ISO},media=cdrom" \
  -drive "file=${BRIDGE_ISO},media=cdrom" \
  -netdev user,id=net0 \
  -device virtio-net,netdev=net0 \
  -vga std \
  -vnc ":$VNC_PORT" || {
    error "QEMU exited with an error"
    exit 1
  }

success "VM exited. Configuration should be complete."

# ── Step 6: Verify ──────────────────────────────────────────────────────────

section "Step 6: Verify the base image"

if [ ! -f "$BASE_IMAGE" ]; then
  error "Base image missing at $BASE_IMAGE"
  exit 1
fi

echo ""
info "  Base image: $BASE_IMAGE ($(du -h "$BASE_IMAGE" | cut -f1))"
echo ""
echo "  ─── Next steps ───"
echo ""
echo "  1. Make a backup:"
echo "     cp $BASE_IMAGE ${BASE_IMAGE}.backup"
echo ""
echo "  2. Test the full pipeline:"
echo "     cd $REPO_DIR"
echo "     ./launch_windows_vm.sh test-session"
echo "     # Should output: BRIDGE_READY ws://localhost:8095 <pid>"
echo ""
echo "     ./destroy_windows_vm.sh test-session"
echo ""
echo "  3. If the bridge doesn't start:"
echo "     Re-launch the VM with VNC, check Windows Event Viewer,"
echo "     and run 'node C:\\kalshi-bridge\\bridge.js' manually to see errors."
echo ""

success "Setup complete! Base image is ready at $BASE_IMAGE"
