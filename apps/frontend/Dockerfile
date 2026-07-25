# @beautyspot/frontend (Next.js 14) — build multi-stage desde la RAÍZ del monorepo.
# Construir con:  docker build -f apps/frontend/Dockerfile -t frontend .

FROM node:20-alpine AS builder
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
CMD ["npx", "next", "start", "-p", "8080"]
