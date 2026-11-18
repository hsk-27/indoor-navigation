@echo off
setlocal EnableDelayedExpansion

:menu
cls
echo ========================================
echo         INDOOR NAVIGATION
echo         ADMIN MANAGER
echo ========================================
echo.

rem Read deployment URL dynamically using PowerShell
for /f "delims=" %%i in ('powershell -Command "$ErrorActionPreference = 'SilentlyContinue'; $p = 'backend\config\deployment.json'; if (-not (Test-Path $p)) { Write-Output 'ERROR_NO_URL'; exit 0 }; $j = Get-Content $p -Raw | ConvertFrom-Json; if (-not $j.deploymentUrl) { Write-Output 'ERROR_NO_URL'; exit 0 }; $u = [System.Uri]$j.deploymentUrl; if ($u.HostNameType -eq 'Dns' -and $u.Host -ne 'localhost') { Write-Output 'ERROR_PUBLIC_DOMAIN'; exit 0 }; Write-Output $j.deploymentUrl"') do set "deploymentUrl=%%i"

if "%deploymentUrl%"=="ERROR_NO_URL" (
    echo [ERROR] Deployment configuration is unavailable or missing.
    echo Please configure the deployment URL in the application first.
    echo.
    pause
    exit /b
)

if "%deploymentUrl%"=="ERROR_PUBLIC_DOMAIN" (
    echo [ERROR] Public domain routing is unsupported for local administration.
    echo Local administrator provisioning requires a direct backend/server LAN endpoint.
    echo Please temporarily change your Deployment Settings to a local IP to provision an admin.
    echo.
    pause
    exit /b
)

if "%deploymentUrl%"=="" (
    echo [ERROR] Deployment configuration could not be read.
    pause
    exit /b
)

echo Active Deployment URL: %deploymentUrl%
echo.
echo 1. Create Admin
echo 2. Delete Admin
echo 3. Exit
echo.
set /p choice="Select an option: "

if "%choice%"=="1" goto create_admin
if "%choice%"=="2" goto delete_admin
if "%choice%"=="3" exit /b
goto menu

:create_admin
cls
set /p username="Username: "
if "%username%"=="" (
    echo Username cannot be empty.
    pause
    goto menu
)

for /f "delims=" %%i in ('powershell -Command "$p=Read-Host 'Password' -AsSecureString; [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"') do set "password=%%i"

if "!password!"=="" (
    echo Password cannot be empty.
    pause
    goto menu
)

for /f "delims=" %%i in ('powershell -Command "$p=Read-Host 'Confirm Password' -AsSecureString; [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"') do set "confirm=%%i"

if "!password!" neq "!confirm!" (
    echo Passwords do not match.
    pause
    goto menu
)

echo.
echo Creating administrator...
curl -s -X POST http://localhost:8080/api/local-admin/create -H "Content-Type: application/json" -d "{\"username\":\"%username%\", \"password\":\"!password!\"}"
echo.
pause
goto menu

:delete_admin
cls
set /p username="Enter administrator username: "
echo.
echo Administrator will be deleted: %username%
set /p confirm="Type DELETE to confirm: "

if not "%confirm%"=="DELETE" (
    echo Operation cancelled.
    pause
    goto menu
)

echo.
echo Deleting administrator...
curl -s -X DELETE http://localhost:8080/api/local-admin/delete/%username%
echo.
pause
goto menu
