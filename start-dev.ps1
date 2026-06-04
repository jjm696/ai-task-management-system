# Opens backend and frontend development servers in separate PowerShell windows.

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backend ".env"))) {
    Write-Host "[ERROR] backend\.env not found." -ForegroundColor Red
    Write-Host "Copy backend\.env.example to backend\.env and configure DATABASE_URL first." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $backend "node_modules"))) {
    Write-Host "[ERROR] backend dependencies not installed. Run: cd backend; npm ci" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "[ERROR] frontend dependencies not installed. Run: cd frontend; npm ci" -ForegroundColor Red
    exit 1
}

Start-Process cmd.exe -WorkingDirectory $backend -ArgumentList "/k", "npm run dev"
Start-Process cmd.exe -WorkingDirectory $frontend -ArgumentList "/k", "npm run dev"

Write-Host "Development servers are starting." -ForegroundColor Green
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
