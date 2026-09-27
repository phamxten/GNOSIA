<#
  GNOSIA · Cloudflare quick tunnel (Docker) — Windows PowerShell 5.1+ / PowerShell 7

  Menjalankan aplikasi (FastAPI + React + PostgreSQL) di Docker lalu membuka URL publik sementara
  https://<acak>.trycloudflare.com lewat Cloudflare. Tidak perlu akun Cloudflare.

  Pemakaian (dari folder proyek):
    powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1            # start + tampilkan URL
    powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1 url        # tampilkan URL yang sedang aktif
    powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1 logs       # lihat log (Ctrl+C untuk keluar)
    powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1 stop       # matikan (data tetap disimpan)
    powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1 reset      # matikan dan HAPUS semua data
#>
param([ValidateSet('start', 'url', 'logs', 'stop', 'reset')][string]$Command = 'start')

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$EnvFile = Join-Path $Root '.env'
$UrlPattern = 'https://[a-z0-9-]+\.trycloudflare\.com'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }

function New-Secret([int]$length) {
  $chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
  $bytes = New-Object byte[] $length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Invoke-Compose([string[]]$Arguments) {
  # docker writes progress to stderr; don't let PowerShell 5.1 treat that as an error
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  & docker compose --profile tunnel @Arguments
  $code = $LASTEXITCODE
  $ErrorActionPreference = $old
  if ($code -ne 0) { throw "docker compose $($Arguments -join ' ') gagal (exit $code)" }
}

function Get-TunnelUrl {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $log = (& docker compose --profile tunnel logs --no-color tunnel 2>&1 | Out-String)
  $ErrorActionPreference = $old
  $found = [regex]::Matches($log, $UrlPattern)
  if ($found.Count) { return $found[$found.Count - 1].Value }
  return $null
}

function Get-EnvValue([string]$name) {
  if (-not (Test-Path $EnvFile)) { return '' }
  $line = Get-Content $EnvFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if ($line) { return ($line -replace "^$name=", '').Trim() }
  return ''
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Say 'Docker belum terpasang. Pasang Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/' Red
    exit 1
  }
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  & docker info *> $null
  $ok = ($LASTEXITCODE -eq 0)
  & docker compose version *> $null
  $compose = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $old
  if (-not $ok) { Say 'Docker belum berjalan. Buka Docker Desktop dulu, tunggu sampai statusnya "running", lalu ulangi.' Red; exit 1 }
  if (-not $compose) { Say 'Perintah "docker compose" tidak ditemukan. Perbarui Docker Desktop.' Red; exit 1 }
}

function Initialize-EnvFile {
  if (Test-Path $EnvFile) { return }
  $content = @(
    '# Dibuat otomatis oleh scripts/tunnel.ps1. Jangan dibagikan.',
    "POSTGRES_PASSWORD=$(New-Secret 24)",
    "SECRET_KEY=$(New-Secret 48)",
    "DEMO_PASSWORD=$(New-Secret 12)",
    'APP_PORT=8000',
    'TUNNEL_PROTOCOL=auto',
    'COOKIE_SECURE=true'
  ) -join "`n"
  [System.IO.File]::WriteAllText($EnvFile, $content + "`n")   # LF line endings for docker compose
  Say 'File .env dibuat dengan password acak.' DarkGray
}

function Show-Info([string]$url) {
  $port = Get-EnvValue 'APP_PORT'; if (-not $port) { $port = '8000' }
  $demo = Get-EnvValue 'DEMO_PASSWORD'
  Say ''
  Say 'GNOSIA sudah online' Green
  Say "  Publik : $url" Cyan
  Say "  Lokal  : http://localhost:$port"
  Say ''
  Say '  Akun demo (siapa pun yang punya URL bisa mencoba masuk, jadi jaga password ini):'
  Say '    admin  sekar@smksig.sch.id'
  Say '    mentor dimas@smksig.sch.id'
  Say '    siswa  nadia@smksig.sch.id   (atau daftar akun baru di /daftar)'
  if ($demo) { Say "    kata sandi: $demo" Yellow }
  Say ''
  Say '  URL berubah setiap kali tunnel dinyalakan ulang. Matikan: .\scripts\tunnel.ps1 stop' DarkGray
}

Assert-Docker

switch ($Command) {
  'start' {
    Initialize-EnvFile
    Say 'Membangun dan menjalankan container (pertama kali bisa beberapa menit)...' DarkGray
    Invoke-Compose @('up', '-d', '--build')
    Say 'Menunggu URL dari Cloudflare...' DarkGray
    $url = $null
    for ($i = 0; $i -lt 90 -and -not $url; $i++) { Start-Sleep -Seconds 2; $url = Get-TunnelUrl }
    if (-not $url) {
      Say 'URL belum muncul. Cek log: .\scripts\tunnel.ps1 logs' Red
      Say 'Kalau jaringanmu memblokir UDP/QUIC, ubah TUNNEL_PROTOCOL=http2 di file .env lalu jalankan start lagi.' Yellow
      exit 1
    }
    Show-Info $url
  }
  'url' {
    $url = Get-TunnelUrl
    if ($url) { Show-Info $url } else { Say 'Tunnel belum berjalan. Jalankan: .\scripts\tunnel.ps1' Yellow }
  }
  'logs' { Invoke-Compose @('logs', '-f', '--tail', '100') }
  'stop' { Invoke-Compose @('down'); Say 'Dimatikan. Data tetap tersimpan di volume Docker.' Green }
  'reset' {
    $answer = Read-Host 'Ini akan menghapus SEMUA data GNOSIA di Docker (akun, progres, konten). Ketik HAPUS untuk lanjut'
    if ($answer -ne 'HAPUS') { Say 'Dibatalkan.'; exit 0 }
    Invoke-Compose @('down', '-v')
    Say 'Semua container dan data dihapus. Jalankan start untuk mulai dari data demo baru.' Green
  }
}
