#!/usr/bin/env bash
# Memasang Docker Engine + plugin "docker compose" di Ubuntu (repo resmi Docker).
# Pemakaian:  bash scripts/install-docker-ubuntu.sh
set -euo pipefail

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker dan docker compose sudah terpasang:"
  docker --version
  docker compose version
  exit 0
fi

echo "==> Memasang paket pendukung"
sudo apt-get update
sudo apt-get install -y ca-certificates curl

echo "==> Menambahkan repository resmi Docker"
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

echo "==> Memasang Docker Engine dan docker compose"
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Menyalakan Docker otomatis saat komputer menyala"
sudo systemctl enable --now docker

echo "==> Mengizinkan user '$USER' memakai docker tanpa sudo"
sudo usermod -aG docker "$USER"

echo
echo "Selesai. Docker $(sudo docker --version | cut -d' ' -f3 | tr -d ',') terpasang."
echo "PENTING: logout lalu login lagi (atau restart) supaya izin grup docker aktif."
echo "Setelah itu cek dengan:  docker run hello-world"
