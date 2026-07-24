# @beautyspot/analytics-service — build multi-stage desde la RAÍZ del monorepo.
# Construir con:  docker build -f services/analytics-service/Dockerfile -t analytics-service .
# El contexto debe ser la raíz del repo para acceder a los workspaces @beautyspot/*.

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
# turbo construye el servicio y, por dependsOn ^build, sus paquetes compartidos.
RUN npx turbo run build --filter=@beautyspot/analytics-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/analytics-service ./services/analytics-service
WORKDIR /app/services/analytics-service
EXPOSE 3007
CMD ["node", "dist/main.js"]
