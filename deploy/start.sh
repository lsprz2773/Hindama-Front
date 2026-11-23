#!/usr/bin/env bash
# Arranca el frontend en su EC2. Lee los secretos de SSM con el rol de la instancia y los deja en
# /run/hindama/frontend.env (tmpfs, modo 600): no se escriben en disco ni en el repositorio.
#
# Uso:  sudo deploy/start.sh            (usa /etc/hindama/frontend.conf)
set -euo pipefail

CONF="${HINDAMA_FRONTEND_CONF:-/etc/hindama/frontend.conf}"
[ -r "$CONF" ] || { echo "Falta $CONF (ver deploy/README.md, paso 4)." >&2; exit 1; }
# shellcheck disable=SC1090
. "$CONF"

: "${HINDAMA_ENV:?}" "${COGNITO_REGION:?}" "${COGNITO_CLIENT_ID:?}" "${HINDAMA_DOMAIN:?}" "${HINDAMA_BACKEND_IP:?}"

ssm() {
  aws ssm get-parameter --region "$COGNITO_REGION" --with-decryption \
    --name "/hindama/${HINDAMA_ENV}/frontend/$1" --query Parameter.Value --output text
}

umask 077
mkdir -p /run/hindama
ENV_FILE=/run/hindama/frontend.env
{
  echo "COGNITO_REGION=${COGNITO_REGION}"
  echo "COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}"
  echo "COGNITO_CLIENT_SECRET=$(ssm cognito-client-secret)"
  echo "HINDAMA_SESSION_KEY=$(ssm session-key)"
  echo "HINDAMA_API_URL=https://backend.internal:8443"
  echo "HINDAMA_PUBLIC_ORIGIN=https://${HINDAMA_DOMAIN}"
} > "$ENV_FILE"

cd "$(dirname "$0")"
export HINDAMA_DOMAIN HINDAMA_BACKEND_IP
docker compose up -d --build
docker compose ps
