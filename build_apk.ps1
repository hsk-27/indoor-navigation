param(
    [string]$ServerUrl
)

$ErrorActionPreference = 'Continue'
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Indoor Navigation - APK Rebuild Tool    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Resolve Target Backend URL
if (-not $ServerUrl) {
    Write-Host "[1/5] Auto-detecting Wi-Fi IP..." -ForegroundColor Yellow
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress -First 1)
    if (-not $ip) {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|Tailscale|Hyper-V' -and $_.IPAddress -ne '127.0.0.1' } | Select-Object -ExpandProperty IPAddress -First 1)
    }
    if (-not $ip) {
        $ip = "localhost"
    }
    $targetUrl = "http://${ip}:8080"
} else {
    $targetUrl = $ServerUrl.TrimEnd('/')
    if ($targetUrl -notmatch '^https?://') {
        $targetUrl = "http://${targetUrl}"
    }
}

Write-Host "  Target Backend URL: $targetUrl" -ForegroundColor Green

# 2. Inject URL into Frontend Build
Write-Host "`n[2/5] Injecting VITE_BACKEND_URL into frontend/.env..." -ForegroundColor Yellow
Set-Content -Path ".\frontend\.env" -Value "VITE_BACKEND_URL=$targetUrl"

# 3. Compile Web Assets via Docker
Write-Host "`n[3/5] Compiling Production Web Assets via Docker..." -ForegroundColor Yellow
docker run --rm -v "${PWD}/frontend:/app" -w /app node:20-alpine sh -c "npm install && npm audit fix || true && npm run build"
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAIL  Vite build failed." -ForegroundColor Red
    if (Test-Path ".\frontend\.env") { Remove-Item ".\frontend\.env" -Force }
    exit 1
}

# 4. Sync Assets to Android Project
Write-Host "`n[4/5] Syncing Assets to Android Project..." -ForegroundColor Yellow
$assetDest = ".\frontend\android\app\src\main\assets\public"
if (Test-Path $assetDest) {
    Remove-Item -Recurse -Force $assetDest
}
New-Item -ItemType Directory -Force -Path $assetDest | Out-Null
Copy-Item -Path ".\frontend\dist\*" -Destination $assetDest -Recurse -Force

# 5. Assemble Android APK via Gradle
Write-Host "`n[5/5] Compiling APK via Gradle assembleDebug..." -ForegroundColor Yellow
Push-Location ".\frontend\android"
.\gradlew assembleDebug
$gradleExit = $LASTEXITCODE
Pop-Location

if ($gradleExit -eq 0) {
    $apkSource = ".\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
    $apkTarget = ".\backend\uploads\ghrce-nav.apk"
    Copy-Item -Path $apkSource -Destination $apkTarget -Force
    $apkItem = Get-Item $apkTarget
    $apkSizeMB = [math]::Round($apkItem.Length / 1MB, 2)
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  SUCCESS: APK Rebuilt Successfully!" -ForegroundColor Green
    Write-Host "  Baked Target:  $targetUrl" -ForegroundColor White
    Write-Host "  APK Location:  $apkTarget ($apkSizeMB MB)" -ForegroundColor White
    Write-Host "  Last Modified: $($apkItem.LastWriteTime)" -ForegroundColor White
    Write-Host "==========================================" -ForegroundColor Cyan
} else {
    Write-Host "  FAIL  Gradle assembly failed." -ForegroundColor Red
}

# Cleanup temporary .env
if (Test-Path ".\frontend\.env") {
    Remove-Item ".\frontend\.env" -Force
}
