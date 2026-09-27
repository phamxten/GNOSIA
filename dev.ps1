# GNOSIA — run the backend (FastAPI :8000) and the frontend (Vite :5173) together for development.
#   .\dev.ps1            start both (Ctrl+C stops both)
#   .\dev.ps1 -Setup     first run: create the Python venv, install packages, prepare PostgreSQL and seed demo data
#   .\dev.ps1 -Reseed    wipe the database and seed the demo data again
param([switch]$Setup, [switch]$Reseed)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$py = Join-Path $backend '.venv\Scripts\python.exe'
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

if ($Setup) {
  if (-not (Test-Path $py)) { python -m venv (Join-Path $backend '.venv') }
  & $py -m pip install --quiet --upgrade pip
  & $py -m pip install --quiet -r (Join-Path $backend 'requirements.txt')
  if (-not (Test-Path (Join-Path $backend '.env'))) { Write-Warning 'backend\.env belum ada. Salin backend\.env.example lalu isi GNOSIA_DATABASE_URL.'; exit 1 }
  Push-Location $backend; & $py scripts/setup_postgres.py; & $py -m app.seed; Pop-Location
  Push-Location $frontend; npm install --no-audit --no-fund; Pop-Location
}
if ($Reseed) { Push-Location $backend; & $py -m app.seed --reset; Pop-Location }

$api = Start-Process -FilePath $py -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8000') -WorkingDirectory $backend -PassThru -NoNewWindow
try {
  Push-Location $frontend
  npx vite --port 5173
} finally {
  Pop-Location
  if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
