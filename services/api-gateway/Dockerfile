# @beautyspot/api-gateway — build multi-stage desde la RAÍZ del monorepo.
# Construir con:  docker build -f services/api-gateway/Dockerfile -t api-gateway .
# El contexto debe ser la raíz del repo para acceder a los workspaces @beautyspot/*.

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
# turbo construye el servicio y, por dependsOn ^build, sus paquetes compartidos.
RUN npx turbo run build --filter=@beautyspot/api-gateway

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api-gateway ./services/api-gateway
WORKDIR /app/services/api-gateway
EXPOSE 3000
CMD ["node", "dist/main.js"]
