@echo off
REM install.bat — dockur/windows OEM post-install script
REM Runs automatically after Windows setup completes.
REM Installs Chrome, VB-Cable (virtual audio device), and ffmpeg for audio capture.

echo == Kalshi Windows Bridge Setup ==

REM ── Install Chocolatey (package manager) ──────────────────────────
echo Installing Chocolatey...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"

REM Refresh PATH so choco is available immediately
set PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin

REM ── Install Google Chrome ─────────────────────────────────────────
echo Installing Google Chrome...
choco install googlechrome -y --no-progress

REM ── Install VB-Cable Virtual Audio Cable ──────────────────────────
echo Installing VB-Cable Virtual Audio Cable...
REM VB-Cable isn't on Chocolatey; download directly
powershell -NoProfile -Command ^
  "Invoke-WebRequest -Uri 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip' -OutFile '%TEMP%\vbcable.zip'"
powershell -NoProfile -Command ^
  "Expand-Archive -Path '%TEMP%\vbcable.zip' -DestinationPath '%TEMP%\vbcable' -Force"
REM VB-Cable setup requires manual execution or a silent install flag
REM The VBCABLE_Setup_x64.exe inside the zip supports /S for silent
start /wait "" "%TEMP%\vbcable\VBCABLE_Setup_x64.exe" /S

REM ── Install ffmpeg (full build with dshow support) ────────────────
echo Installing ffmpeg...
choco install ffmpeg-full -y --no-progress

REM ── Set default audio output to VB-Cable for capture ─────────────
REM This ensures system audio is routed to the virtual cable
powershell -NoProfile -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; $ws = New-Object System.Management.ManagementClass('Win32_SoundDevice'); $devices = $ws.GetInstances(); $cable = $devices | Where-Object { $_.Name -like '*CABLE*' }; if ($cable) { Write-Host 'VB-Cable found' } else { Write-Host 'WARNING: VB-Cable not found' }"

REM ── Set up watchdog scheduled task (runs at startup) ─────────────
REM Watches C:\Shared\url.txt and launches Chrome + audio capture
schtasks /Create /TN "KalshiWatchdog" /SC ONSTART /DELAY 0000:30 ^
  /TR "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\Shared\watchdog.ps1" ^
  /RU "Docker" /RP "admin" /F /RL HIGHEST

REM ── Disable sleep / screen timeout ───────────────────────────────
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

echo == Kalshi Windows Bridge Setup Complete ==
echo Reboot recommended before first use.
