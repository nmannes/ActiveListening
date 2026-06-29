#!/usr/bin/env bash
# launch_windows_vm.sh — Launch an ephemeral Windows VM for DRM streaming
#
# Copies the base Windows QCOW2 image, starts QEMU/KVM with port forwarding
# for the streaming bridge, polls until the bridge is ready, and outputs
# the bridge address.
#
# Usage:
#   launch_windows_vm.sh <session-id>
#
# Prerequisites (one-time setup):
#   - Base Windows VM image at ~/windows-vm/base.qcow2
#   - Windows must have virtio drivers installed (viostor, netkvm)
#   - Windows must have auto-login enabled
#   - The Kalshi bridge must be installed as a scheduled task (setup.ps1)
#
# Output on success:
#   BRIDGE_READY ws://localhost:8095 <vm-pid>

set -euo pipefail

SESSION_ID="${1:-}"
if [ -z "$SESSION_ID" ]; then
    echo "Usage: $0 <session-id>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VM_HOME="${VM_HOME:-$HOME/windows-vm}"
BASE_IMAGE="$VM_HOME/base.qcow2"
SESSIONS_DIR="$VM_HOME/sessions"
BRIDGE_PORT="${BRIDGE_PORT:-8095}"
BRIDGE_HOST="localhost"
BRIDGE_URL="ws://${BRIDGE_HOST}:${BRIDGE_PORT}"

# VM resource limits
VM_MEMORY="${VM_MEMORY:-4G}"
VM_CPUS="${VM_CPUS:-2}"
VM_BOOT_TIMEOUT="${VM_BOOT_TIMEOUT:-180}"  # 3 minutes for Windows to boot

# ── Validate prerequisites ──────────────────────────────────────────────
if [ ! -f "$BASE_IMAGE" ]; then
    echo "ERROR: Base Windows image not found at $BASE_IMAGE" >&2
    echo "Create a Windows VM with Chrome, Node.js, ffmpeg, and the bridge autostart," >&2
    echo "then copy the QCOW2 image to $BASE_IMAGE" >&2
    exit 1
fi

if [ ! -w /dev/kvm ]; then
    echo "ERROR: /dev/kvm is not accessible. Ensure KVM is enabled and user has permissions." >&2
    exit 1
fi

mkdir -p "$SESSIONS_DIR"

# ── Check port is free ──────────────────────────────────────────────────
if ss -tln | grep -q ":${BRIDGE_PORT}\b"; then
    echo "ERROR: Port ${BRIDGE_PORT} is already in use" >&2
    exit 1
fi

# ── Copy base image ─────────────────────────────────────────────────────
SESSION_IMAGE="$SESSIONS_DIR/${SESSION_ID}.qcow2"
SESSION_PIDFILE="$SESSIONS_DIR/${SESSION_ID}.pid"

echo "[launch_vm] Copying base image (this may take a moment)..." >&2
cp "$BASE_IMAGE" "$SESSION_IMAGE"

# ── Launch QEMU ─────────────────────────────────────────────────────────
echo "[launch_vm] Starting Windows VM (${VM_MEMORY} RAM, ${VM_CPUS} CPUs)..." >&2

qemu-system-x86_64 \
    -enable-kvm \
    -m "$VM_MEMORY" \
    -smp "$VM_CPUS" \
    -drive "file=${SESSION_IMAGE},format=qcow2,if=virtio" \
    -netdev "user,id=net0,hostfwd=tcp::${BRIDGE_PORT}-:${BRIDGE_PORT}" \
    -device virtio-net,netdev=net0 \
    -vga std \
    -display none \
    -pidfile "$SESSION_PIDFILE" \
    -daemonize \
    || {
        echo "ERROR: QEMU failed to start" >&2
        rm -f "$SESSION_IMAGE"
        exit 1
    }

VM_PID=$(cat "$SESSION_PIDFILE")
echo "[launch_vm] VM started (PID: $VM_PID)" >&2

# ── Clean up stale PID file ─────────────────────────────────────────────
trap 'rm -f "$SESSION_PIDFILE"' EXIT

# ── Poll for bridge readiness ───────────────────────────────────────────
echo "[launch_vm] Waiting for bridge to be ready (timeout: ${VM_BOOT_TIMEOUT}s)..." >&2

START_TIME=$(date +%s)
BRIDGE_READY=false

while [ $(($(date +%s) - START_TIME)) -lt "$VM_BOOT_TIMEOUT" ]; do
    # Check if VM is still running
    if ! kill -0 "$VM_PID" 2>/dev/null; then
        echo "ERROR: VM process died unexpectedly" >&2
        rm -f "$SESSION_IMAGE"
        exit 1
    fi

    # Try to connect to the bridge
    if node -e "
        const ws = new (require('ws'))('${BRIDGE_URL}');
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'status' }));
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'status') {
                ws.close();
                process.exit(0);
            }
        });
        ws.on('error', () => process.exit(1));
        setTimeout(() => process.exit(1), 3000);
    " 2>/dev/null; then
        BRIDGE_READY=true
        break
    fi

    printf "." >&2
    sleep 5
done

echo >&2

if [ "$BRIDGE_READY" = false ]; then
    echo "ERROR: Bridge did not become ready within ${VM_BOOT_TIMEOUT}s" >&2
    echo "VM may still be booting. Check manually or increase VM_BOOT_TIMEOUT." >&2
    rm -f "$SESSION_PIDFILE"
    # Leave the VM running for debugging — user can destroy manually
    exit 1
fi

echo "[launch_vm] Bridge ready at ${BRIDGE_URL}" >&2
echo "BRIDGE_READY ${BRIDGE_URL} ${VM_PID}"
