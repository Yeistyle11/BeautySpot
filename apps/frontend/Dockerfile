# @beautyspot/frontend (Next.js 16) — build multi-stage desde la RAÍZ del monorepo.
# Construir con:
#   docker build -f apps/frontend/Dockerfile #     --build-arg NEXT_PUBLIC_SITE_URL=https://appbeautyspot.com -t frontend .

FROM node:20-alpine AS builder
# Next las escribe en el build: el rewrite de /api hacia GATEWAY_URL queda en el
# manifiesto de rutas y las NEXT_PUBLIC_* en el JavaScript del navegador, así
# que el env_file del contenedor llega tarde para ellas.
ARG GATEWAY_URL=http://api-gateway:3000
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_IMAGE_HOSTS=
ENV GATEWAY_URL=$GATEWAY_URL     NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL     NEXT_PUBLIC_IMAGE_HOSTS=$NEXT_PUBLIC_IMAGE_HOSTS
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
RUN npx turbo run build --filter=@beautyspot/frontend

FROM node:20-alpine
WORKDIR /app/apps/frontend
ENV NODE_ENV=production
ENV PORT=8080
# node_modules en la raíz (workspaces con hoisting) + artefactos de Next.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/frontend/.next ./.next
COPY --from=builder /app/apps/frontend/package.json ./package.json
COPY --from=builder /app/apps/frontend/next.config.js ./next.config.js
EXPOSE 8080

# El frontend no expone /health: basta con que Next sirva la portada.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "-p", "8080"]
