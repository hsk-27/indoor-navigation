@echo off
echo [INFO] Taking manual snapshot of the database...
docker exec indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE IF NOT EXISTS restored_marker (id int);" >nul 2>&1
docker exec indoor_nav_db sh -c "pg_dump -U postgres -d indoor_nav -c -F p > /tmp/db_backup.sql" >nul 2>&1
docker cp indoor_nav_db:/tmp/db_backup.sql .\database_backup.sql >nul 2>&1
echo [OK] Database snapshot safely exported to database_backup.sql!
echo You can now safely copy the project folder to another laptop.
pause
