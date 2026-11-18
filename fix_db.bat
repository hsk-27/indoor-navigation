@echo off
echo =========================================
echo   Database Restore Script
echo =========================================
echo.
echo [INFO] Restoring database from database_backup.sql...

docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -c "DROP TABLE IF EXISTS restored_marker;" >nul 2>&1
docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -q < database_backup.sql
docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE restored_marker (id int);" >nul 2>&1

echo [OK] Database successfully restored!
echo [INFO] Restarting backend to load the restored graph metadata...
docker restart indoor_nav_backend >nul 2>&1
echo [OK] Done!
pause
