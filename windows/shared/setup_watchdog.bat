@echo off
schtasks /Delete /TN "KalshiWatchdog" /F 2>nul
schtasks /Create /TN "KalshiWatchdog" /SC ONSTART /DELAY 0000:30 /TR "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File 'C:\Users\Docker\Desktop\Shared\on_windows_start.ps1'" /RU "Docker" /RP "admin" /F /RL HIGHEST
if %ERRORLEVEL%==0 (
  echo Watchdog scheduled task created successfully.
  schtasks /Run /TN "KalshiWatchdog"
) else (
  echo Failed to create scheduled task.
)
pause
