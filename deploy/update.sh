#!/usr/bin/env bash
# Despliega solo el último commit de la rama (dev por omisión) cuando cambia. Lo corre el timer
# hindama-frontend-update cada 3 minutos (deploy/README.md, «Actualización automática»).
#
# 1. Si origin/<rama> no cambió, no hace nada.
# 2. Construye la imagen del commit nuevo mientras la anterior sigue sirviendo.
# 3. Si no compila, se queda la versión anterior y ese commit no se reintenta.
# 4. Reinicia y comprueba /api/health por Caddy con el dominio real; si no responde en 2 minutos,
#    regresa al commit y la imagen anteriores.
#
# Cada cambio de imagen borra las cachés de Next (volúmenes next-cache y next-route-cache): Docker
# solo copia el contenido de la imagen a un volumen vacío, así que sin borrarlas Next seguiría
# sirviendo páginas prerenderizadas de la build anterior, que piden scripts que ya no existen
# (ChunkLoadError y página 500).
set -euo pipefail

REPO="${HINDAMA_FRONTEND_REPO:-/opt/hindama/frontend}"
CONF="${HINDAMA_FRONTEND_CONF:-/etc/hindama/frontend.conf}"
STATE=/var/lib/hindama
mkdir -p "$STATE"

# shellcheck disable=SC1090
. "$CONF"
: "${HINDAMA_DOMAIN:?}" "${HINDAMA_BACKEND_IP:?}"
BRANCH="${HINDAMA_FRONTEND_BRANCH:-dev}"
export HINDAMA_DOMAIN HINDAMA_BACKEND_IP

exec 9>/run/hindama-frontend-update.lock
flock -n 9 || exit 0  # otra actualización sigue en curso

log() { echo "[update] $*"; }

healthy() {
  for _ in $(seq 1 24); do
    if curl -fsS --max-time 5 --resolve "${HINDAMA_DOMAIN}:443:127.0.0.1" \
      "https://${HINDAMA_DOMAIN}/api/health" | grep -q '"ok"'; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# Reinicia con las cachés de Next vacías, para que se llenen con la imagen nueva.
restart_clean() {
  systemctl stop hindama-frontend
  docker compose -f "$REPO/deploy/compose.yaml" down --remove-orphans >/dev/null 2>&1 || true
  docker volume rm -f hindama-frontend_next-cache hindama-frontend_next-route-cache >/dev/null
  systemctl start hindama-frontend
}

cd "$REPO"
git fetch --quiet origin "$BRANCH"
current="$(git rev-parse HEAD)"
target="$(git rev-parse "origin/${BRANCH}")"
[ "$current" = "$target" ] && exit 0
if [ "$(cat "$STATE/frontend-failed" 2>/dev/null)" = "$target" ]; then
  exit 0  # ya falló: se espera el siguiente commit
fi

log "commit nuevo ${target} (desplegado: ${current})"
docker image tag hindama-frontend:latest hindama-frontend:previous 2>/dev/null || true
git checkout --quiet --detach "$target"

if ! docker compose -f deploy/compose.yaml build frontend; then
  log "la imagen de ${target} no compila: sigue ${current}"
  echo "$target" >"$STATE/frontend-failed"
  git checkout --quiet --detach "$current"
  exit 1
fi

restart_clean
if healthy; then
  log "desplegado ${target}"
  echo "$target" >"$STATE/frontend-deployed"
  rm -f "$STATE/frontend-failed"
  docker image prune -f >/dev/null
  exit 0
fi

log "${target} no responde: regreso a ${current}"
echo "$target" >"$STATE/frontend-failed"
git checkout --quiet --detach "$current"
docker image tag hindama-frontend:previous hindama-frontend:latest
restart_clean
healthy && log "de vuelta en ${current}" || log "ATENCIÓN: ${current} tampoco responde"
exit 1
