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

# El frontend no expone /health: basta con que Next sirva la portada.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "-p", "8080"]
