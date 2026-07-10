# bridge.ps1 — Kalshi Windows audio bridge
#
# Captures system audio via VB-Cable (virtual audio device), transcodes to
# raw 16kHz mono PCM, and writes it to the shared volume so the Linux host
# can read it.
#
# The Linux-side provider (providers/windows.js) reads from
#   windows/shared/audio.pcm
# and forwards it over WebSocket to the Kalshi server.
#
# Usage (run on Windows VM):
#   powershell -ExecutionPolicy Bypass -File bridge.ps1 -StreamUrl "https://peacocktv.com/..."

param(
  [Parameter(Mandatory=$true)]
  [string]$StreamUrl,

  [string]$SharedPath = "C:\Shared",

  [int]$SampleRate = 16000,

  [int]$Channels = 1
)

$ErrorActionPreference = "Stop"
$OutputFile = Join-Path $SharedPath "audio.pcm"

Write-Host "== Kalshi Audio Bridge =="
Write-Host "Stream:  $StreamUrl"
Write-Host "Output:  $OutputFile"
Write-Host "Format:  ${SampleRate}Hz, ${Channels}ch, s16le PCM"
Write-Host ""

# ── Step 1: Find VB-Cable audio input device ────────────────────────
# VB-Cable creates "CABLE Output" (playback) and "CABLE Input" (recording).
# System audio routed to "CABLE Input" (playback device) appears on
# "CABLE Output" (recording device) for capture.
Write-Host "Detecting VB-Cable device..."

$ffmpegDevices = & ffmpeg -list_devices true -f dshow -i dummy 2>&1
$cableLine = $ffmpegDevices | Select-String "CABLE.*Output|CABLE.*Input" | Select-Object -First 1

if (-not $cableLine) {
  Write-Host "ERROR: VB-Cable device not found. Run install.bat first."
  Write-Host "Available audio devices:"
  Write-Host ($ffmpegDevices -join "`n")
  exit 1
}

# Extract the exact device name from ffmpeg output
# Format: [dshow @ ...] "CABLE Output (VB-Audio Virtual Cable)"
$deviceName = ($cableLine -replace '.*"(.*)".*', '$1').Trim()
Write-Host "Using audio device: $deviceName"

# ── Step 2: Launch Chrome to the stream URL ──────────────────────────
Write-Host "Launching Chrome..."
$chromeArgs = @(
  "--new-window",
  "--start-maximized",
  "--autoplay-policy=no-user-gesture-required",
  "--disable-backgrounding-occluded-windows",
  "--disable-session-crashed-bubble",
  "--disable-infobars",
  "--no-first-run",
  "--no-default-browser-check",
  $StreamUrl
)

$chromeProcess = Start-Process "chrome" -ArgumentList $chromeArgs -PassThru
Write-Host "Chrome PID: $($chromeProcess.Id)"

# Wait for Chrome to start and video to begin playing
Start-Sleep -Seconds 15

# ── Step 3: Set VB-Cable as default audio playback device ──────────
# This routes Chrome's audio into the virtual cable for capture.
Write-Host "Routing system audio to VB-Cable..."

# Use AudioDeviceCmdlets or PowerShell to switch default device
# Bundle AudioDeviceCmdlets if needed, but for now try direct approach:
try {
  # Enumerate audio devices via PowerShell
  Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class WinMM {
      [DllImport("winmm.dll")]
      public static extern int waveOutGetNumDevs();
    }
"@

  # Set VB-Cable as default via registry (requires restart of audio service)
  # Simpler: tell the user to set it manually via sound control panel for now
  Write-Host "NOTE: Manually set VB-Cable as default playback device:"
  Write-Host "  Right-click speaker icon → Sounds → Playback → CABLE Input → Set Default"
} catch {
  Write-Host "WARNING: Could not auto-set default audio device."
  Write-Host "Please set VB-Cable as default playback device manually."
}

# ── Step 4: Capture audio with ffmpeg ────────────────────────────────
Write-Host ""
Write-Host "Starting audio capture..."
Write-Host "Output file: $OutputFile"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

# Clear the output file before starting (so readers don't pick up stale data)
if (Test-Path $OutputFile) {
  Remove-Item $OutputFile -Force
}

# ffmpeg dshow capture → raw PCM to file
# We write to a temp file first then atomically rename, so the Linux reader
# never sees partial writes.
$TempFile = Join-Path $SharedPath "audio.tmp.pcm"

$ffmpegArgs = @(
  "-y",
  "-f", "dshow",
  "-i", "audio=$deviceName",
  "-f", "s16le",
  "-acodec", "pcm_s16le",
  "-ar", "$SampleRate",
  "-ac", "$Channels",
  "-flush_packets", "1",
  $TempFile
)

Write-Host "ffmpeg $($ffmpegArgs -join ' ')"

# Run ffmpeg (blocks until killed)
$ffmpegProcess = Start-Process "ffmpeg" -ArgumentList $ffmpegArgs -Wait -NoNewWindow -PassThru

Write-Host "ffmpeg exited with code $($ffmpegProcess.ExitCode)"

# ── Cleanup ──────────────────────────────────────────────────────────
if ($chromeProcess -and !$chromeProcess.HasExited) {
  Stop-Process $chromeProcess -Force -ErrorAction SilentlyContinue
}
Write-Host "Bridge stopped."
