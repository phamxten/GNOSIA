#!/usr/bin/env bash
# GNOSIA · Cloudflare quick tunnel (Docker) — Linux / macOS / WSL / Git Bash
#
# Menjalankan aplikasi (FastAPI + React + PostgreSQL) di Docker lalu membuka URL publik sementara
# https://<acak>.trycloudflare.com lewat Cloudflare. Tidak perlu akun Cloudflare.
#
# Pemakaian (dari folder proyek):
#   ./scripts/tunnel.sh          # start + tampilkan URL
#   ./scripts/tunnel.sh url      # tampilkan URL yang sedang aktif
#   ./scripts/tunnel.sh logs     # lihat log (Ctrl+C untuk keluar)
#   ./scripts/tunnel.sh stop     # matikan (data tetap disimpan)
#   ./scripts/tunnel.sh reset    # matikan dan HAPUS semua data
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".env"
URL_PATTERN='https://[a-z0-9-]+\.trycloudflare\.com'
CMD="${1:-start}"

if [ -t 1 ]; then G=$'\e[32m'; C=$'\e[36m'; Y=$'\e[33m'; R=$'\e[31m'; D=$'\e[2m'; N=$'\e[0m'; else G= C= Y= R= D= N=; fi

compose() { docker compose --profile tunnel "$@"; }

secret() { LC_ALL=C tr -dc 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' </dev/urandom | head -c "$1"; }

env_value() { [ -f "$ENV_FILE" ] && grep -E "^$1=" "$ENV_FILE" | head -n1 | cut -d= -f2- || true; }

tunnel_url() { compose logs --no-color tunnel 2>&1 | grep -Eo "$URL_PATTERN" | tail -n1 || true; }

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "${R}Docker belum terpasang.${N} Ubuntu/Debian: curl -fsSL https://get.docker.com | sh" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "${R}Tidak bisa terhubung ke Docker.${N} Jalankan daemon-nya (sudo systemctl start docker)," >&2
    echo "atau tambahkan user ke grup docker: sudo usermod -aG docker \$USER (lalu logout/login)." >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "${R}Plugin 'docker compose' belum ada.${N} Ubuntu/Debian: sudo apt install docker-compose-plugin" >&2
    exit 1
  fi
}

init_env() {
  [ -f "$ENV_FILE" ] && return
  umask 077
  cat >"$ENV_FILE" <<EOF
# Dibuat otomatis oleh scripts/tunnel.sh. Jangan dibagikan.
POSTGRES_PASSWORD=$(secret 24)
SECRET_KEY=$(secret 48)
DEMO_PASSWORD=$(secret 12)
APP_PORT=8000
TUNNEL_PROTOCOL=auto
COOKIE_SECURE=true
EOF
  echo "${D}File .env dibuat dengan password acak.${N}"
}

show_info() {
  local port demo
  port="$(env_value APP_PORT)"; port="${port:-8000}"
  demo="$(env_value DEMO_PASSWORD)"
  echo
  echo "${G}GNOSIA sudah online${N}"
  echo "  Publik : ${C}$1${N}"
  echo "  Lokal  : http://localhost:$port"
  echo
  echo "  Akun demo (siapa pun yang punya URL bisa mencoba masuk, jadi jaga password ini):"
  echo "    admin  sekar@smksig.sch.id"
  echo "    mentor dimas@smksig.sch.id"
  echo "    siswa  nadia@smksig.sch.id   (atau daftar akun baru di /daftar)"
  [ -n "$demo" ] && echo "    kata sandi: ${Y}$demo${N}"
  echo
  echo "${D}  URL berubah setiap kali tunnel dinyalakan ulang. Matikan: ./scripts/tunnel.sh stop${N}"
}

require_docker

case "$CMD" in
  start)
    init_env
    echo "${D}Membangun dan menjalankan container (pertama kali bisa beberapa menit)...${N}"
    compose up -d --build
    echo "${D}Menunggu URL dari Cloudflare...${N}"
    url=""
    for _ in $(seq 1 90); do
      sleep 2
      url="$(tunnel_url)"
      [ -n "$url" ] && break
    done
    if [ -z "$url" ]; then
      echo "${R}URL belum muncul.${N} Cek log: ./scripts/tunnel.sh logs" >&2
      echo "${Y}Kalau jaringanmu memblokir UDP/QUIC, ubah TUNNEL_PROTOCOL=http2 di .env lalu jalankan start lagi.${N}" >&2
      exit 1
    fi
    show_info "$url"
    ;;
  url)
    url="$(tunnel_url)"
    if [ -n "$url" ]; then show_info "$url"; else echo "${Y}Tunnel belum berjalan. Jalankan: ./scripts/tunnel.sh${N}"; fi
    ;;
  logs) compose logs -f --tail 100 ;;
  stop) compose down; echo "${G}Dimatikan. Data tetap tersimpan di volume Docker.${N}" ;;
  reset)
    read -r -p "Ini akan menghapus SEMUA data GNOSIA di Docker (akun, progres, konten). Ketik HAPUS untuk lanjut: " answer
    [ "$answer" = "HAPUS" ] || { echo "Dibatalkan."; exit 0; }
    compose down -v
    echo "${G}Semua container dan data dihapus. Jalankan start untuk mulai dari data demo baru.${N}"
    ;;
  *) echo "Perintah tidak dikenal: $CMD (pilih: start | url | logs | stop | reset)" >&2; exit 2 ;;
esac
