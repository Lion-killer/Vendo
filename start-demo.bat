@echo off
REM Launcher only - the stand itself lives in start-demo.ps1 and runs in THIS window.
REM (A .ps1 opens in an editor on double-click, hence this wrapper.)
REM Plain if/else on purpose: "where pwsh && (A) || (B)" also runs B whenever A exits
REM non-zero (Ctrl+C included), which used to start a second stand behind your back.
where pwsh >nul 2>&1
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
)
pause
