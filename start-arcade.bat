@echo off
cd /d "%~dp0"
echo ==========================================================
echo   ARCADE TOURNAMENT PLATFORM & DATABASE SERVER
echo ==========================================================
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Node.js detected. Starting Express + MongoDB server...
    node server.js
) else (
    echo [WARN] Node.js not found in PATH. Starting fallback PowerShell server...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-arcade.ps1"
)
pause
