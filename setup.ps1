$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Indoor Navigation - Full Setup Script   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Run this on ANY new laptop to go live.  " -ForegroundColor DarkGray
Write-Host ""

# ── Step 1: Prerequisite Checks ──────────────────────────────────────
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

# Docker
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "  OK  Docker: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  FAIL  Docker is not installed or not in PATH." -ForegroundColor Red
    Write-Host "        Install Docker Desktop from https://docker.com/products/docker-desktop" -ForegroundColor Red
    exit 1
}

# Docker running?
try {
    docker info *> $null
    Write-Host "  OK  Docker engine is running." -ForegroundColor Green
} catch {
    Write-Host "  FAIL  Docker engine is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Java (needed for Gradle/APK build)
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "  OK  Java: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "  WARN  Java not found. APK build will be skipped." -ForegroundColor DarkYellow
    Write-Host "        Install JDK 17+ to enable APK builds." -ForegroundColor DarkYellow
    $skipApk = $true
}

# ── Step 2: Detect Network IP ────────────────────────────────────────
Write-Host ""
Write-Host "[2/6] Detecting local network IP..." -ForegroundColor Yellow

$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue |
       Select-Object -ExpandProperty IPAddress -First 1)
if (-not $ip) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
           Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Tailscale|Hyper-V' } |
           Select-Object -ExpandProperty IPAddress -First 1)
}
if (-not $ip) {
    Write-Host "  WARN  Could not detect Wi-Fi IP. Using localhost." -ForegroundColor DarkYellow
    $ip = "localhost"
}
Write-Host "  OK  Server IP: $ip" -ForegroundColor Green

# ── Step 3: Clean stale .env ──────────────────────────────────────────
Write-Host ""
Write-Host "[3/6] Cleaning stale frontend .env..." -ForegroundColor Yellow

if (Test-Path ".\frontend\.env") {
    Remove-Item ".\frontend\.env" -Force
    Write-Host "  OK  Removed stale frontend/.env" -ForegroundColor Green
} else {
    Write-Host "  OK  No stale .env found." -ForegroundColor Green
}

# ── Step 4: Build & Start Docker Containers ──────────────────────────
Write-Host ""
Write-Host "[4/6] Building and starting Docker containers (this may take a few minutes on first run)..." -ForegroundColor Yellow

docker compose build --no-cache
docker compose up -d

# Wait for backend health
Write-Host "  Waiting for backend to become healthy..." -ForegroundColor DarkGray
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:8080/api/v1/localization/buildings" 2>$null
        if ($response -eq "200") {
            Write-Host "  OK  Backend is healthy and responding." -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 3
    $waited += 3
    Write-Host "  ...waiting ($waited s)" -ForegroundColor DarkGray
}
if ($waited -ge $maxWait) {
    Write-Host "  WARN  Backend did not respond within ${maxWait}s. It may still be starting." -ForegroundColor DarkYellow
}

# ── Step 5: Build APK ────────────────────────────────────────────────
Write-Host ""
if ($skipApk) {
    Write-Host "[5/6] Skipping APK build (Java not found)." -ForegroundColor DarkYellow
} else {
    Write-Host "[5/6] Building Android APK with IP $ip ..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\build_apk.ps1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK  APK built and deployed to backend/uploads/ghrce-nav.apk" -ForegroundColor Green
    } else {
        Write-Host "  WARN  APK build failed. Web dashboard will still work." -ForegroundColor DarkYellow
    }
}

# ── Step 6: Summary ──────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "           SETUP COMPLETE                 " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Web Dashboard (this laptop):" -ForegroundColor White
Write-Host "    http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Web Dashboard (other devices on same Wi-Fi):" -ForegroundColor White
Write-Host "    http://${ip}:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend API:" -ForegroundColor White
Write-Host "    http://${ip}:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Admin Panel:" -ForegroundColor White
Write-Host "    http://localhost:5173/admin/login" -ForegroundColor Cyan
Write-Host "    Username: admin  |  Password: admin123" -ForegroundColor DarkGray
Write-Host ""
if (-not $skipApk) {
    Write-Host "  APK Download (scan QR on homepage or visit):" -ForegroundColor White
    Write-Host "    http://${ip}:5173  (tap Download on phone)" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  To rebuild APK after changing Wi-Fi:" -ForegroundColor DarkGray
Write-Host "    powershell -ExecutionPolicy Bypass -File .\build_apk.ps1" -ForegroundColor DarkGray
Write-Host ""
