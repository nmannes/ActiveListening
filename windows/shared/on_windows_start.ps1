# on_windows_start.ps1 — Watches for stream.json, logs in if needed, captures audio
#
# Runs at startup via scheduled task. Linux host drops a JSON file:
#   windows/shared/stream.json
#
# JSON format:
#   { "url": "https://...", "email": "...", "password": "..." }
#
# Or with a separate login page:
#   { "url": "https://...", "email": "...", "password": "...",
#     "loginUrl": "https://example.com/login" }
#
# Stop capture:   touch windows/shared/stop.txt

$ErrorActionPreference = "Continue"
Add-Type -AssemblyName System.Windows.Forms

$JobFile    = "C:\Users\Docker\Desktop\Shared\tmp\stream.json"
$MarketFile = "C:\Users\Docker\Desktop\Shared\tmp\market.json"
$PcmFile    = "C:\Users\Docker\Desktop\Shared\tmp\audio.tmp.pcm"
$StopFile   = "C:\Users\Docker\Desktop\Shared\tmp\stop.txt"
$StatusFile = "C:\Users\Docker\Desktop\Shared\tmp\status.txt"

function Write-Status($msg) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "$timestamp  $msg"
  Write-Host $line
  $line | Out-File $StatusFile -Encoding utf8
}

function Do-Login($email, $password) {
  Write-Status "Logging in as $email ..."
  Start-Sleep -Seconds 3  # let the page settle

  # Type email, tab to password, type password, press Enter
  [System.Windows.Forms.SendKeys]::SendWait($email)
  Start-Sleep -Milliseconds 500
  [System.Windows.Forms.SendKeys]::SendWait("{TAB}")
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait($password)
  Start-Sleep -Milliseconds 300
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Write-Status "Login submitted, waiting for redirect..."
  Start-Sleep -Seconds 8
}

Write-Status "== Kalshi Watchdog started =="

# Touch a heartbeat file at shared root so the host knows we started
$HeartbeatFile = "C:\Users\Docker\Desktop\Shared\watchdog.heartbeat"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"$timestamp  Watchdog process started (PID $pid)" | Out-File $HeartbeatFile -Encoding utf8

# Ensure tmp directory exists
New-Item -ItemType Directory -Force -Path "C:\Users\Docker\Desktop\Shared\tmp" | Out-Null

# ── Ensure dependencies ────────────────────────────────────────────────
function Ensure-Deps {
  # Chocolatey
  $choco = Get-Command choco -ErrorAction SilentlyContinue
  if (-not $choco) {
    Write-Status "Installing Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine")
  }

  # Google Chrome
  $chrome = Get-Command chrome -ErrorAction SilentlyContinue
  if (-not $chrome) { $chrome = Test-Path "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe" }
  if (-not $chrome) { $chrome = Test-Path "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
  if (-not $chrome) {
    Write-Status "Installing Google Chrome..."
    choco install googlechrome -y --no-progress --limit-output
  }

  # VB-Cable Virtual Audio Cable
  $cable = Get-Command "CABLE Output (VB-Audio Virtual Cable)" -ErrorAction SilentlyContinue
  if (-not $cable) {
    Write-Status "Installing VB-Cable..."
    $zip = "$env:TEMP\vbcable.zip"
    $dir = "$env:TEMP\vbcable"
    Invoke-WebRequest -Uri 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip' -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $dir -Force
    Start-Process -Wait -FilePath "$dir\VBCABLE_Setup_x64.exe" -ArgumentList "/S"
    Write-Status "VB-Cable installed (reboot recommended)"
  }

  # ffmpeg
  $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if (-not $ffmpeg) {
    Write-Status "Installing ffmpeg..."
    choco install ffmpeg-full -y --no-progress --limit-output
  }

  Write-Status "Dependencies ready."
}

Ensure-Deps

# Clean up stale files
Remove-Item $JobFile   -Force -ErrorAction SilentlyContinue
Remove-Item $StopFile  -Force -ErrorAction SilentlyContinue
Remove-Item $PcmFile   -Force -ErrorAction SilentlyContinue

while ($true) {
  Write-Status "Watching for $JobFile ..."

  # Wait for job file
  while (-not (Test-Path $JobFile)) {
    Start-Sleep -Seconds 2
  }

  # Parse job
  try {
    $job = Get-Content $JobFile -Raw | ConvertFrom-Json
  } catch {
    Write-Status "ERROR: Invalid JSON in $JobFile"
    Remove-Item $JobFile -Force
    continue
  }

  $url      = $job.url
  $email    = $job.email
  $password = $job.password
  $loginUrl = $job.loginUrl
  $waitSec  = if ($job.waitSeconds) { [int]$job.waitSeconds } else { 15 }

  if (-not $url) {
    Write-Status "ERROR: 'url' is required"
    Remove-Item $JobFile -Force
    continue
  }

  Write-Status "Job: url=$url email=$email loginUrl=$loginUrl wait=${waitSec}s"

  # Log market info if available
  if (Test-Path $MarketFile) {
    try {
      $market = Get-Content $MarketFile -Raw | ConvertFrom-Json
      Write-Status "Market: slug=$($market.slug) title=$($market.title)"
    } catch {
      Write-Status "WARNING: Could not parse market.json"
    }
  }

  # Clean stop signal from previous run
  Remove-Item $StopFile -Force -ErrorAction SilentlyContinue
  Remove-Item $PcmFile -Force -ErrorAction SilentlyContinue

  $chromeArgs = @(
    "--new-window",
    "--start-maximized",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-backgrounding-occluded-windows",
    "--disable-session-crashed-bubble",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check"
  )

  # ── Step 1: Login (if credentials provided) ──────────────────────
  if ($email -and $password) {
    $firstUrl = if ($loginUrl) { $loginUrl } else { $url }
    Write-Status "Launching Chrome to login: $firstUrl"
    $chrome = Start-Process "chrome" -ArgumentList ($chromeArgs + $firstUrl) -PassThru
    Start-Sleep -Seconds 5
    Do-Login $email $password

    # If login page is separate, now navigate to the actual stream URL
    if ($loginUrl -and $url -ne $loginUrl) {
      Write-Status "Navigating to stream: $url"
      Start-Sleep -Seconds 2
      [System.Windows.Forms.SendKeys]::SendWait("^l")  # Ctrl+L → address bar
      Start-Sleep -Milliseconds 500
      [System.Windows.Forms.SendKeys]::SendWait($url + "{ENTER}")
      Start-Sleep -Seconds 5
    }
  } else {
    # No credentials — just open the URL
    Write-Status "Launching Chrome to: $url"
    $chrome = Start-Process "chrome" -ArgumentList ($chromeArgs + $url) -PassThru
  }

  Write-Status "Chrome PID: $($chrome.Id)"
  Write-Status "Waiting ${waitSec}s for page to load..."
  Start-Sleep -Seconds $waitSec

  # ── Step 2: Start audio capture ──────────────────────────────────
  Write-Status "Starting audio capture..."
  $ffmpeg = Start-Process "ffmpeg" -ArgumentList @(
    "-y",
    "-f", "dshow",
    "-i", "audio=CABLE Output (VB-Audio Virtual Cable)",
    "-f", "s16le",
    "-acodec", "pcm_s16le",
    "-ar", "16000",
    "-ac", "1",
    "-flush_packets", "1",
    $PcmFile
  ) -PassThru -NoNewWindow

  Write-Status "Audio capturing. PID: $($ffmpeg.Id)"

  # ── Step 3: Wait for stop signal ─────────────────────────────────
  while (-not (Test-Path $StopFile)) {
    Start-Sleep -Seconds 2
    if ($chrome.HasExited) {
      Write-Status "Chrome closed, stopping capture."
      break
    }
    # Heartbeat: update status file so host knows we're alive
    Write-Status "Capturing..." > $null
  }

  # ── Cleanup ──────────────────────────────────────────────────────
  Write-Status "Stopping..."
  if ($ffmpeg -and -not $ffmpeg.HasExited) { Stop-Process $ffmpeg -Force -ErrorAction SilentlyContinue }
  if ($chrome -and -not $chrome.HasExited) { Stop-Process $chrome -Force -ErrorAction SilentlyContinue }
  Remove-Item $PcmFile  -Force -ErrorAction SilentlyContinue
  Remove-Item $JobFile  -Force -ErrorAction SilentlyContinue
  Remove-Item $StopFile -Force -ErrorAction SilentlyContinue
  Write-Status "Done. Watching for next job..."
}
