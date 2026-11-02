# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build
# Se usa node:24-slim (Debian) porque el build de Angular corre esbuild y el
# CLI: menos superficie de falla que musl. La salida es JS puro, asi que la
# imagen final puede ser alpine.
# ---------------------------------------------------------------------------
FROM node:24-slim AS build

WORKDIR /app

# Capa cacheable: solo se invalida si cambian las dependencias.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Produce dist/frontbondi/{browser,server} (build de produccion + prerender).
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# El bundle de servidor no tiene dependencias externas (Express y Angular SSR
# van embebidos), asi que la imagen final solo necesita node + dist/.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=4000 \
    NG_ALLOWED_HOSTS=localhost,127.0.0.1

WORKDIR /app

# Usuario sin privilegios.
RUN addgroup -S sibus && adduser -S sibus -G sibus

COPY --from=build --chown=sibus:sibus /app/dist/frontbondi ./dist/frontbondi

USER sibus

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1

CMD ["node", "dist/frontbondi/server/server.mjs"]
