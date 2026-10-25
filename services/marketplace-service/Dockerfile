# @beautyspot/marketplace-service — build multi-stage desde la RAÍZ del monorepo.
# Construir con:  docker build -f services/marketplace-service/Dockerfile -t marketplace-service .
# El contexto debe ser la raíz del repo para acceder a los workspaces @beautyspot/*.

FROM node:26.12.1-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
# turbo construye el servicio y, por dependsOn ^build, sus paquetes compartidos.
RUN npx turbo run build --filter=@beautyspot/marketplace-service

FROM node:26.12.1-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
# migration:run compila src/ con ts-node, y su tsconfig extiende el de la raíz.
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=builder /app/services/marketplace-service ./services/marketplace-service
WORKDIR /app/services/marketplace-service
EXPOSE 3006

# El orquestador necesita saber si el proceso atiende, no solo si vive.
# Se usa el /health del propio servicio (node, para no depender de curl,
# que la imagen alpine no trae).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3006/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
