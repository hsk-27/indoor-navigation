@echo off
echo =========================================
echo   Rebuilding and Restarting Containers
echo =========================================
echo.
echo [INFO] Rebuilding the frontend container to apply the latest React changes...
docker compose up -d --build
echo.
echo [OK] Containers successfully rebuilt and started!
echo [INFO] Please refresh your browser tab (Ctrl + F5).
pause
