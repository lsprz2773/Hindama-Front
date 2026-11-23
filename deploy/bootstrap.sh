#!/usr/bin/env bash
# Prepara la EC2 del frontend (Amazon Linux 2023, arm64) desde cero, como root:
# Docker, Compose y Buildx verificados por SHA-256, 4 GB de swap para construir Next.js con 2 GB de
# RAM, el código en /opt/hindama/frontend y las unidades de systemd (servicio y actualización).
#
#   HINDAMA_FRONTEND_REF=<sha completo> sudo -E deploy/bootstrap.sh
#
# Antes de arrancar faltan /etc/hindama/frontend.conf y /etc/hindama/caddy-root.crt (README, 3 y 4).
set -euo pipefail

REF="${HINDAMA_FRONTEND_REF:?SHA completo del commit a desplegar}"
REPO_URL="https://github.com/lsprz2773/Hindama-Front.git"
COMPOSE_VERSION="v5.7.0"
COMPOSE_SHA256="15861535d14e26555736b49376c95e14bfd94285366c8446bfac7156a972e76f"
BUILDX_VERSION="v0.38.2"
BUILDX_SHA256="46c0f334772de3cb0b341cc415caf7339fb5cfc8b8438ebcb5a10e7f23800d36"
PLUGINS=/usr/local/lib/docker/cli-plugins

[[ "$REF" =~ ^[0-9a-f]{40}$ ]] || { echo "HINDAMA_FRONTEND_REF debe ser un SHA completo" >&2; exit 1; }

dnf install -y docker git
systemctl enable --now docker

install -d -m 0755 "$PLUGINS"
fetch() {  # url, sha256, destino
  curl -fsSL -o /tmp/plugin "$1"
  echo "$2  /tmp/plugin" | sha256sum -c -
  install -m 0755 /tmp/plugin "$3"
  rm -f /tmp/plugin
}
[ -x "$PLUGINS/docker-compose" ] || fetch \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
  "$COMPOSE_SHA256" "$PLUGINS/docker-compose"
[ -x "$PLUGINS/docker-buildx" ] || fetch \
  "https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-arm64" \
  "$BUILDX_SHA256" "$PLUGINS/docker-buildx"
docker compose version && docker buildx version

if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo "/swapfile swap swap defaults 0 0" >>/etc/fstab
fi

install -d -m 0755 /opt/hindama /opt/hindama/bin /etc/hindama
[ -d /opt/hindama/frontend/.git ] || git clone --quiet "$REPO_URL" /opt/hindama/frontend
git -C /opt/hindama/frontend fetch --quiet origin
git -C /opt/hindama/frontend checkout --quiet --detach "$REF"

D=/opt/hindama/frontend/deploy
install -m 0755 "$D/update.sh" /opt/hindama/bin/frontend-update.sh
install -m 0644 "$D/hindama-frontend.service" "$D/hindama-frontend-update.service" \
  "$D/hindama-frontend-update.timer" /etc/systemd/system/
chmod 0755 "$D/start.sh"
systemctl daemon-reload
echo "Listo. Falta frontend.conf y caddy-root.crt; después:"
echo "  systemctl enable --now hindama-frontend hindama-frontend-update.timer"
