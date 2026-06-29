# Windows VM Base Image Setup

This creates the base QCOW2 image that `launch_windows_vm.sh` copies for each DRM session.

## Overview

1. Download Windows ISO + virtio drivers
2. Install Windows in QEMU/KVM
3. Configure auto-login
4. Install Chrome, Node.js, ffmpeg
5. Set up the streaming bridge as auto-start
6. Shut down and save the base image

Total time: ~30-45 minutes, almost entirely waiting for installs.

## Step 1: Download required files

```bash
mkdir -p ~/windows-vm
cd ~/windows-vm

# Windows 10/11 ISO — download from Microsoft
# https://www.microsoft.com/software-download/windows11
# Place it as ~/windows-vm/Win11.iso

# VirtIO drivers (for disk and network in KVM)
wget https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso
```

## Step 2: Create empty disk and install Windows

```bash
cd ~/windows-vm

# Create a 60GB disk image
qemu-img create -f qcow2 base.qcow2 60G

# Start the installer
qemu-system-x86_64 \
  -enable-kvm \
  -m 4G \
  -smp 4 \
  -cdrom Win11.iso \
  -drive file=virtio-win.iso,media=cdrom \
  -drive file=base.qcow2,format=qcow2,if=virtio \
  -netdev user,id=net0 \
  -device virtio-net,netdev=net0 \
  -vga std \
  -vnc :0 \
  -boot order=d
```

Connect via VNC to follow the installer: `vncviewer localhost:0`

**During Windows install:**
- When it asks "Where do you want to install Windows?" the disk will be empty. Click "Load driver" → browse the virtio-win CD → `viostor/w10/amd64` → select the driver → the disk appears.
- Complete the install. When it reboots, the VM will stop (no `-boot order=d` on the next launch). That's fine — see Step 3.

**Bypass Microsoft account requirement (Windows 11):**
- When prompted for a network connection, press `Shift+F10` to open cmd
- Run `oobe\bypassnro` — the system reboots
- On next boot, you'll get an "I don't have internet" option that lets you create a local account
- Use username `kalshi` with no password

## Step 3: First boot and configure

```bash
qemu-system-x86_64 \
  -enable-kvm \
  -m 4G \
  -smp 4 \
  -drive file=base.qcow2,format=qcow2,if=virtio \
  -netdev user,id=net0 \
  -device virtio-net,netdev=net0 \
  -vga std \
  -vnc :0
```

**Enable auto-login:**
1. Press `Win+R`, type `netplwiz`, press Enter
2. Uncheck "Users must enter a user name and password to use this computer"
3. Click Apply, enter the username and (blank) password
4. Also disable the lock screen: `Win+R` → `gpedit.msc` → Computer Configuration → Administrative Templates → Control Panel → Personalization → "Do not display the lock screen" → Enabled

**Install virtio network driver (if not already done):**
1. Open Device Manager
2. Find the Ethernet controller with a yellow warning
3. Update driver → Browse → virtio-win CD → `NetKVM/w10/amd64`
4. Network should come up

## Step 4: Install required software

From within the VM, open Edge and install:

### Chrome
- Download from https://www.google.com/chrome/
- Chrome on Windows has full Widevine CDM support — no extra steps needed

### Node.js 20.x LTS
- Download from https://nodejs.org/ (20.x LTS)
- Install with default options (includes npm)

### ffmpeg
- Download the Windows build from https://www.gyan.dev/ffmpeg/builds/
- Get the "release essentials" build
- Extract to `C:\ffmpeg`
- Add `C:\ffmpeg\bin` to PATH:
  1. `Win+R` → `sysdm.cpl` → Advanced → Environment Variables
  2. Edit `Path` → Add `C:\ffmpeg\bin`

### Git (optional, for cloning)
- Download from https://git-scm.com/download/win
- Or just copy the bridge files manually

## Step 5: Install the streaming bridge

```powershell
# In PowerShell (as Administrator):
mkdir C:\kalshi-bridge
```

Copy these files from `~/kalshi/windows-bridge/` to `C:\kalshi-bridge\` on the VM (use a USB drive, SCP, or a shared folder):
- `package.json`
- `bridge.js`
- `setup.ps1`

```powershell
cd C:\kalshi-bridge
npm install

# Run the setup script to create the scheduled task
powershell -ExecutionPolicy Bypass -File setup.ps1
```

**Test the bridge manually:**
```powershell
node bridge.js
# Should print: [bridge] Windows streaming bridge listening on ws://0.0.0.0:8095
```

Then from the Linux host, once the VM has networking:
```bash
node -e "
const ws = new (require('ws'))('ws://localhost:8095');
ws.on('open', () => { ws.send(JSON.stringify({type:'status'})); });
ws.on('message', d => console.log(d.toString()));
"
# Should print: {"type":"status","running":false,"url":null}
```

## Step 6: Finalize the base image

1. Inside the VM, shut down Windows: `Start → Power → Shut down`
2. Wait for the QEMU process to exit
3. Your base image is ready at `~/windows-vm/base.qcow2`
4. Make a backup copy: `cp base.qcow2 base.qcow2.backup`

## Step 7: Test the full pipeline

```bash
cd ~/kalshi

# Launch a test VM
./launch_windows_vm.sh test-session

# Should output: BRIDGE_READY ws://localhost:8095 <pid>

# Clean up
./destroy_windows_vm.sh test-session
```

## Troubleshooting

**VM boots to recovery screen:** Your disk image may be corrupted. Restore from backup: `cp base.qcow2.backup base.qcow2`

**Bridge doesn't start:** Check Windows Event Viewer for scheduled task failures. Try running `node C:\kalshi-bridge\bridge.js` manually to see errors.

**Port 8095 already in use:** Something else is on that port. Kill the old QEMU process or change `BRIDGE_PORT`.

**Chrome can't play DRM content:** Verify Widevine is present — in Chrome, go to `chrome://components/` and check "Widevine Content Decryption Module" is installed and up to date.
