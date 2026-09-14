@echo off
REM Launcher only - the work is in start.ps1: mock backend + frontend + HTTPS tunnel,
REM all in THIS window with live logs ([api] / [web] / [tun]).
REM
REM Comments are ASCII on purpose: cmd mis-parses UTF-8 Cyrillic and would try to
REM execute the fragments as commands.
REM
REM Plain if/else, not "where pwsh && (A) || (B)": with && || the fallback branch also
REM runs whenever A exits non-zero (Ctrl+C, port busy) and would start a SECOND instance.
where pwsh >nul 2>&1
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
)
pause
