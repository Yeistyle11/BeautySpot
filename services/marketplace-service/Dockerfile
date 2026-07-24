# @beautyspot/marketplace-service — build multi-stage desde la RAÍZ del monorepo.
# Construir con:  docker build -f services/marketplace-service/Dockerfile -t marketplace-service .
# El contexto debe ser la raíz del repo para acceder a los workspaces @beautyspot/*.

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
# turbo construye el servicio y, por dependsOn ^build, sus paquetes compartidos.
RUN npx turbo run build --filter=@beautyspot/marketplace-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/marketplace-service ./services/marketplace-service
WORKDIR /app/services/marketplace-service
EXPOSE 3006
CMD ["node", "dist/main.js"]
