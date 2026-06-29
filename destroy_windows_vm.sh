#!/usr/bin/env bash
# destroy_windows_vm.sh — Stop and clean up an ephemeral Windows VM
#
# Sends stop command to the bridge, kills the QEMU process,
# and deletes the session QCOW2 image.
#
# Usage:
#   destroy_windows_vm.sh <session-id>

set -euo pipefail

SESSION_ID="${1:-}"
if [ -z "$SESSION_ID" ]; then
    echo "Usage: $0 <session-id>" >&2
    exit 1
fi

VM_HOME="${VM_HOME:-$HOME/windows-vm}"
SESSIONS_DIR="$VM_HOME/sessions"
BRIDGE_PORT="${BRIDGE_PORT:-8095}"
BRIDGE_URL="ws://localhost:${BRIDGE_PORT}"
FORCE_TIMEOUT="${FORCE_TIMEOUT:-10}"

SESSION_IMAGE="$SESSIONS_DIR/${SESSION_ID}.qcow2"
SESSION_PIDFILE="$SESSIONS_DIR/${SESSION_ID}.pid"

# ── Send stop command to bridge ─────────────────────────────────────────
echo "[destroy_vm] Sending stop command to bridge..." >&2
node -e "
    const ws = new (require('ws'))('${BRIDGE_URL}');
    ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'stop' }));
    });
    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'stopped') {
            console.error('[destroy_vm] Bridge confirmed stop');
            ws.close();
            process.exit(0);
        }
    });
    ws.on('error', () => process.exit(1));
    setTimeout(() => process.exit(1), 5000);
" 2>/dev/null || echo "[destroy_vm] Could not reach bridge (VM may already be down)" >&2

# ── Kill QEMU process ───────────────────────────────────────────────────
if [ -f "$SESSION_PIDFILE" ]; then
    VM_PID=$(cat "$SESSION_PIDFILE")
    if kill -0 "$VM_PID" 2>/dev/null; then
        echo "[destroy_vm] Terminating VM (PID: $VM_PID)..." >&2
        kill "$VM_PID" 2>/dev/null || true

        # Wait for graceful shutdown, then force-kill
        for i in $(seq 1 "$FORCE_TIMEOUT"); do
            if ! kill -0 "$VM_PID" 2>/dev/null; then
                echo "[destroy_vm] VM process exited" >&2
                break
            fi
            sleep 1
        done

        if kill -0 "$VM_PID" 2>/dev/null; then
            echo "[destroy_vm] Force-killing VM..." >&2
            kill -9 "$VM_PID" 2>/dev/null || true
            sleep 1
        fi
    fi
    rm -f "$SESSION_PIDFILE"
fi

# ── Remove session image ────────────────────────────────────────────────
if [ -f "$SESSION_IMAGE" ]; then
    echo "[destroy_vm] Removing session image: ${SESSION_IMAGE}" >&2
    rm -f "$SESSION_IMAGE"
fi

# ── Clean up any leftover lockfiles ─────────────────────────────────────
rm -f "$SESSIONS_DIR/${SESSION_ID}.lock"

echo "[destroy_vm] Session ${SESSION_ID} destroyed" >&2
