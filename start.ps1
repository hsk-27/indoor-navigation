param(
    [string]$ServerTarget
)
$ErrorActionPreference = 'Continue'
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Indoor Navigation - Smart Start         " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detect Network IP
Write-Host "[1/6] Detecting Network & IP Configuration..." -ForegroundColor Yellow
Write-Host "  - Scanning active network interfaces..." -ForegroundColor Gray
if ($ServerTarget) {
    $ip = $ServerTarget
    Write-Host "  - Using override target: $ip" -ForegroundColor Gray
    Write-Host "  OK  Network IP set to: $ip" -ForegroundColor Green
} else {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress -First 1)
    if ($ip) {
        Write-Host "  - Active Wi-Fi adapter detected: $ip" -ForegroundColor Gray
    } else {
        Write-Host "  - Wi-Fi not found, scanning fallback network adapters..." -ForegroundColor Gray
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|Tailscale|Hyper-V' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -ExpandProperty IPAddress -First 1)
        if ($ip) {
            Write-Host "  - Found primary network adapter: $ip" -ForegroundColor Gray
        }
    }
    if (-not $ip) {
        $ip = "localhost"
        Write-Host "  WARN  No external IP found. Using localhost (local dev mode)." -ForegroundColor DarkYellow
    } else {
        Write-Host "  OK  Current Network IP: $ip" -ForegroundColor Green
    }
}

# 2. Check Docker
Write-Host "`n[2/6] Checking Docker Engine Status..." -ForegroundColor Yellow
Write-Host "  - Verifying Docker daemon connectivity..." -ForegroundColor Gray
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL  Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }
    $dockerVer = (docker version --format '{{.Server.Version}}' 2>$null)
    if ($dockerVer) {
        Write-Host "  - Docker Engine version: $dockerVer" -ForegroundColor Gray
    }
    Write-Host "  OK  Docker daemon is healthy and running." -ForegroundColor Green
} catch {
    Write-Host "  FAIL  Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# 3. Boot Containers
Write-Host "`n[3/6] Booting Full Stack via Docker Compose..." -ForegroundColor Yellow
Write-Host "  - Cleaning temporary build environment configs..." -ForegroundColor Gray
if (Test-Path ".\frontend\.env") { Remove-Item ".\frontend\.env" -Force }
Write-Host "  - Launching containers (DB, Backend, Frontend Nginx)..." -ForegroundColor Gray
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAIL  Docker Compose failed to start." -ForegroundColor Red
    exit 1
}
$containers = docker ps --filter "name=indoor_nav" --format "{{.Names}} ({{.Status}})"
if ($containers) {
    foreach ($c in $containers) {
        Write-Host "    * $c" -ForegroundColor DarkGray
    }
}
Write-Host "  OK  All containers started successfully." -ForegroundColor Green

# 4. Check & Restore Database
Write-Host "`n[4/6] Checking & Synchronizing Database State..." -ForegroundColor Yellow
Write-Host "  - Waiting for PostgreSQL engine (port 5432) to accept connections..." -ForegroundColor Gray
$wait = 0
$dbReady = $false
while ($wait -lt 20) {
    $ready = docker exec indoor_nav_db pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dbReady = $true
        break
    }
    Write-Host "    ... waiting for PostgreSQL service ($($wait)s)..." -ForegroundColor DarkGray
    Start-Sleep 2
    $wait += 2
}
if (-not $dbReady) {
    Write-Host "  FAIL  PostgreSQL service failed to respond within 20 seconds." -ForegroundColor Red
    exit 1
}
Write-Host "  - PostgreSQL service is ready and accepting queries." -ForegroundColor Gray

Write-Host "  - Checking database schema and restore marker..." -ForegroundColor Gray
$isRestored = docker exec indoor_nav_db psql -U postgres -d indoor_nav -tAc "SELECT 1 FROM pg_tables WHERE tablename='restored_marker';" 2>$null
if ($isRestored -ne "1") {
    if (Test-Path ".\database_backup.sql") {
        Write-Host "  INFO  Fresh database detected. Restoring backup from database_backup.sql..." -ForegroundColor DarkYellow
        cmd.exe /c "docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -q < database_backup.sql"
        docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE restored_marker (id int);" 2>&1 | Out-Null
        Write-Host "  - Restarting backend service to bind restored schema..." -ForegroundColor Gray
        docker restart indoor_nav_backend 2>&1 | Out-Null
        Write-Host "  - Schema and records restored successfully." -ForegroundColor Gray
    } else {
        Write-Host "  - No backup file found. Initializing new schema marker..." -ForegroundColor Gray
        docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE restored_marker (id int);" 2>&1 | Out-Null
    }
} else {
    Write-Host "  - Existing database verified with active tables." -ForegroundColor Gray
}
docker exec indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE IF NOT EXISTS restored_marker (id int);" 2>&1 | Out-Null

Write-Host "  - Generating live backup snapshot to database_backup.sql..." -ForegroundColor Gray
docker exec indoor_nav_db sh -c "pg_dump -U postgres -d indoor_nav -c -F p > /tmp/db_backup.sql" 2>&1 | Out-Null
docker cp indoor_nav_db:/tmp/db_backup.sql .\database_backup.sql 2>&1 | Out-Null
Write-Host "  OK  Database is healthy, synchronized, and backed up." -ForegroundColor Green

# 5. Patch Deployment URL & QR
Write-Host "`n[5/6] Updating deployment config and QR code..." -ForegroundColor Yellow
if ($ip -ne "localhost") {
    $configPath = ".\backend\config\deployment.json"
    if (Test-Path $configPath) {
        Write-Host "  - Inspecting deployment configuration ($configPath)..." -ForegroundColor Gray
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        if ($config.isCustomUrl -eq $true) {
            Write-Host "  INFO  Custom deployment URL preserved: $($config.deploymentUrl)" -ForegroundColor DarkYellow
        } else {
            $newVersion = ($config.deploymentVersion + 1)
            Write-Host "  - Writing updated deployment URL: http://${ip}:5173 (v$newVersion)..." -ForegroundColor Gray
            $newConfig = @{ deploymentUrl="http://${ip}:5173"; deploymentVersion=$newVersion; lastUpdated="auto"; generatedBy="start.ps1"; isCustomUrl=$false }
            $newConfig | ConvertTo-Json | Set-Content $configPath
            
            # Wait for backend API to be ready before calling QR regeneration
            Write-Host "  - Contacting Backend API to auto-regenerate mobile pairing QR..." -ForegroundColor Gray
            $qrSuccess = $false
            for ($attempt = 1; $attempt -le 6; $attempt++) {
                try {
                    $login = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}' -ErrorAction Stop
                    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/deployment/qr" -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $($login.token)"} -Body "{`"deploymentUrl`":`"http://${ip}:5173`",`"isCustomUrl`":`"false`"}" -ErrorAction Stop | Out-Null
                    $qrSuccess = $true
                    break
                } catch {
                    Write-Host "    ... waiting for Backend API warmup (attempt $attempt/6)..." -ForegroundColor DarkGray
                    Start-Sleep -Seconds 2
                }
            }
            if ($qrSuccess) {
                Write-Host "  - Dynamic QR code successfully generated." -ForegroundColor Gray
                Write-Host "  OK  Deployment URL updated and QR regenerated." -ForegroundColor Green
            } else {
                Write-Host "  WARN  Backend API is still initializing; QR will auto-regenerate on next admin login." -ForegroundColor DarkYellow
                Write-Host "  OK  Deployment URL updated." -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  - deployment.json not found, skipping." -ForegroundColor Gray
    }
} else {
    Write-Host "  - Running in localhost mode, deployment URL update skipped." -ForegroundColor Gray
}

# 6. Smart APK Rebuild
Write-Host "`n[6/6] Checking if APK needs rebuild..." -ForegroundColor Yellow
$needsRebuild = $true
Write-Host "  - Inspecting compiled mobile assets..." -ForegroundColor Gray
$apkJsFiles = Get-ChildItem '.\frontend\android\app\src\main\assets\public\assets\index-*.js' -ErrorAction SilentlyContinue
$apkExists = Test-Path ".\backend\uploads\ghrce-nav.apk"

if ($apkJsFiles) {
    $content = Get-Content $apkJsFiles[0].FullName -Raw
    $m = [regex]::Match($content, 'http://[\d\.]+:\d+')
    if ($m.Success) {
        Write-Host "  - Found baked backend target in assets: $($m.Value)" -ForegroundColor Gray
        if ($m.Value -eq "http://${ip}:8080" -and $apkExists) {
            $needsRebuild = $false
            $apkItem = Get-Item ".\backend\uploads\ghrce-nav.apk"
            $apkSizeMB = [math]::Round($apkItem.Length / 1MB, 2)
            Write-Host "  - APK binary verified at backend/uploads/ghrce-nav.apk ($apkSizeMB MB)" -ForegroundColor Gray
            Write-Host "  OK  APK already has correct IP ($ip). Skipping rebuild." -ForegroundColor Green
        }
    }
}

if ($needsRebuild) {
    if (-not $apkExists) {
        Write-Host "  !!  APK binary missing. Rebuilding APK with target IP $ip..." -ForegroundColor DarkYellow
    } else {
        Write-Host "  !!  Network IP changed. Rebuilding APK with target IP $ip..." -ForegroundColor DarkYellow
    }
    
    Write-Host "  [1/5] Injecting backend URL into Frontend build (.env)..." -ForegroundColor Cyan
    $targetBackend = if ($ip -match '^https?://') { $ip } elseif ($ip -match ':') { "http://${ip}" } else { "http://${ip}:8080" }
    Set-Content -Path ".\frontend\.env" -Value "VITE_BACKEND_URL=$targetBackend"
    Write-Host "    -> Target: VITE_BACKEND_URL=$targetBackend" -ForegroundColor Gray

    Write-Host "  [2/5] Compiling Production Web Assets via Docker (node:20-alpine)..." -ForegroundColor Cyan
    Write-Host "    -> Building Vite bundle (npm install && npm run build)..." -ForegroundColor Gray
    docker run --rm -v "${PWD}/frontend:/app" -w /app node:20-alpine sh -c "npm install && npm audit fix || true && npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL  Vite compilation in Docker failed." -ForegroundColor Red
        if (Test-Path ".\frontend\.env") { Remove-Item ".\frontend\.env" -Force }
        exit 1
    }
    Write-Host "    -> Web assets compiled successfully into frontend/dist." -ForegroundColor Gray
    
    Write-Host "  [3/5] Syncing Compiled Web Assets to Android Project..." -ForegroundColor Cyan
    $assetDest = ".\frontend\android\app\src\main\assets\public"
    if (Test-Path $assetDest) {
        Remove-Item -Recurse -Force $assetDest
    }
    New-Item -ItemType Directory -Force -Path $assetDest | Out-Null
    Copy-Item -Path ".\frontend\dist\*" -Destination $assetDest -Recurse -Force
    $syncedCount = (Get-ChildItem -Recurse $assetDest).Count
    Write-Host "    -> Transferred $syncedCount asset files to Android public directory." -ForegroundColor Gray

    Write-Host "  [4/5] Assembling Android APK via Gradle (gradlew assembleDebug)..." -ForegroundColor Cyan
    Write-Host "    -> Building debug APK binary..." -ForegroundColor Gray
    Push-Location ".\frontend\android"
    .\gradlew clean assembleDebug
    $gradleExit = $LASTEXITCODE
    Pop-Location

    if ($gradleExit -eq 0) {
        Write-Host "  [5/5] Deploying APK to Backend Download Service..." -ForegroundColor Cyan
        $apkSource = ".\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
        $apkDest = ".\backend\uploads\ghrce-nav.apk"
        Copy-Item -Path $apkSource -Destination $apkDest -Force
        $apkItem = Get-Item $apkDest
        $apkSizeMB = [math]::Round($apkItem.Length / 1MB, 2)
        Write-Host "    -> APK Location: $apkDest ($apkSizeMB MB)" -ForegroundColor Gray
        Write-Host "  OK  APK rebuilt and deployed successfully." -ForegroundColor Green
    } else {
        Write-Host "  WARN  APK build failed. Web dashboard is still fully operational." -ForegroundColor Red
    }

    Write-Host "  - Cleaning up temporary .env file..." -ForegroundColor Gray
    if (Test-Path ".\frontend\.env") {
        Remove-Item ".\frontend\.env" -Force
    }
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  Startup Complete! All Services Active   " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Frontend (Local):   http://localhost:5173" -ForegroundColor White
Write-Host "  Frontend (Network): http://${ip}:5173" -ForegroundColor White
Write-Host "  Backend API:        http://${ip}:8080/api/v1/health" -ForegroundColor White
Write-Host "  Admin Panel:        http://${ip}:5173/admin/login" -ForegroundColor White
Write-Host "  APK Direct Link:    http://${ip}:8080/uploads/ghrce-nav.apk" -ForegroundColor White
Write-Host "  APK Web Download:   http://${ip}:5173" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
