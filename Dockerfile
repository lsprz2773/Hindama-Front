# syntax=docker/dockerfile:1
# Imagen del frontend de Hindama (Next.js como BFF). Se construye en la propia EC2 o en CI:
#   docker build -t hindama-frontend .
# La imagen no lleva secretos: las variables se pasan al arrancar (deploy/README.md).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Usuario sin privilegios; `node` ya existe en la imagen oficial (uid 1000).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Next escribe sus cachés en tiempo de ejecución (`cache` y `server/route-cache`): son del usuario
# `node` y en producción se montan como volúmenes, para que el resto del sistema de archivos quede
# de solo lectura.
RUN mkdir -p /app/.next/cache /app/.next/server/route-cache     && chown node:node /app/.next/cache /app/.next/server/route-cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
