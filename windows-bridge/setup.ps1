# setup.ps1 — Install the Kalshi streaming bridge as a Windows scheduled task
# that runs on user login. Run once after cloning the repo onto the Windows VM.
#
# Usage (run as Administrator from windows-bridge/ directory):
#   powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"

$taskName = "KalshiWindowsBridge"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = (Get-Command node.exe).Source
$bridgeScript = Join-Path $scriptDir "bridge.js"

# Install npm dependencies if needed
if (-not (Test-Path (Join-Path $scriptDir "node_modules"))) {
    Write-Host "Installing npm dependencies..."
    Set-Location $scriptDir
    npm install --production
}

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the scheduled task action
$action = New-ScheduledTaskAction -Execute $nodePath `
    -Argument "`"$bridgeScript`"" `
    -WorkingDirectory $scriptDir

# Trigger on user login
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Run with highest privileges, hidden window
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBattery `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

# Register the task to run as the current user
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

Register-ScheduledTask -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Kalshi Windows streaming bridge — receives commands from Linux host and streams DRM audio"

Write-Host "Scheduled task '$taskName' installed. Bridge will auto-start on login."
Write-Host ""
Write-Host "To start now without logging out:"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "To verify it's running:"
Write-Host "  node -e `"const w=new (require('ws'))('ws://localhost:8095'); w.on('open',()=>{w.send(JSON.stringify({type:'status'}))}); w.on('message',d=>console.log(d.toString()))`""
