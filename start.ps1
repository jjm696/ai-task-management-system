# =====================================================
# TaskFlow One-Click Start Script (Windows PowerShell)
# Usage: Run .\start.ps1 in project root directory
# =====================================================

$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

# 1. Check docker
try {
    docker --version | Out-Null
} catch {
    Write-Host "[ERROR] Docker not installed or Docker Desktop not started" -ForegroundColor Red
    exit 1
}

# 2. Check .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[INFO] .env generated. Please edit MYSQL_ROOT_PASSWORD / JWT_SECRET / AI_API_KEY then run this script again." -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "[ERROR] .env.example not found" -ForegroundColor Red
        exit 1
    }
}

$envContent = Get-Content .env -Raw
if ($envContent -match "please_change_this") {
    Write-Host "[WARN] .env still contains default template values." -ForegroundColor Yellow
    $ans = Read-Host "Continue anyway? [y/N]"
    if ($ans -notmatch "^[yY]") {
        Write-Host "Aborted."
        exit 1
    }
}

# 3. Build and start
Write-Host "[INFO] Building and starting TaskFlow services..." -ForegroundColor Cyan
docker compose up -d --build

# 4. Print info
$port = (Select-String -Path .env -Pattern "^FRONTEND_PORT=" | Select-Object -First 1).Line -replace "^FRONTEND_PORT=", ""
if (-not $port) { $port = "80" }

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  TaskFlow started successfully" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:$port" -ForegroundColor Green
Write-Host "  View logs: docker compose logs -f"
Write-Host "  Stop: docker compose down"
Write-Host "============================================" -ForegroundColor Green
