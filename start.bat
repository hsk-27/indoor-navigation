@echo off
echo =========================================
echo   GHRCE.NAV Startup Script
echo =========================================
echo.
echo Launching Smart Startup Sequence...
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Startup sequence failed or was interrupted.
)
echo.
pause
