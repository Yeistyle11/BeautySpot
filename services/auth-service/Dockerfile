# @beautyspot/auth-service — build multi-stage desde la RAÍZ del monorepo.
# Construir con:  docker build -f services/auth-service/Dockerfile -t auth-service .
# El contexto debe ser la raíz del repo para acceder a los workspaces @beautyspot/*.

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install --legacy-peer-deps
# turbo construye el servicio y, por dependsOn ^build, sus paquetes compartidos.
RUN npx turbo run build --filter=@beautyspot/auth-service

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/auth-service ./services/auth-service
WORKDIR /app/services/auth-service
EXPOSE 3001

# El orquestador necesita saber si el proceso atiende, no solo si vive.
# Se usa el /health del propio servicio (node, para no depender de curl,
# que la imagen alpine no trae).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
