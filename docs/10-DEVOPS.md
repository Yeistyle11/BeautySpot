# 10. DevOps - BeautySpot SaaS

## Tabla de Contenidos

- [Infraestructura con Docker Compose](#infraestructura-con-docker-compose)
- [Estrategia de Dockerfile](#estrategia-de-dockerfile)
- [Pipeline CI/CD con GitHub Actions](#pipeline-cicd-con-github-actions)
- [Estrategia de Testing](#estrategia-de-testing)
- [Seguridad](#seguridad)
- [Observabilidad](#observabilidad)
- [Despliegue en la Nube](#despliegue-en-la-nube)
- [Gestion de Entornos](#gestion-de-entornos)
- [Migraciones de Base de Datos](#migraciones-de-base-de-datos)
- [Backup y Recuperacion ante Desastres](#backup-y-recuperacion-ante-desastres)

---

## Infraestructura con Docker Compose

### Arquitectura de Contenedores

El entorno de desarrollo local levanta **11 contenedores**: 8 microservicios NestJS, 1 PostgreSQL, 1 Redis y 1 RabbitMQ.

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ API Gateway   │  │ Auth Service  │  │ Core Service  │      │
│  │   :3000       │  │   :3001       │  │   :3002       │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐       │
│  │ Booking Svc   │  │ Payment Svc   │  │ Notif. Svc    │      │
│  │   :3003       │  │   :3004       │  │   :3005       │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                  │                  │               │
│  ┌──────┴───────┐  ┌──────┴───────┐                          │
│  │ Marketplace   │  │ Analytics Svc │                         │
│  │   :3006       │  │   :3007       │                         │
│  └──────┬───────┘  └──────┬───────┘                          │
│         │                  │                                  │
│  ┌──────┴──────────────────┴──────────────────────────┐      │
│  │              Infraestructura Compartida              │     │
│  │  PostgreSQL:5432  Redis:6379  RabbitMQ:5672/15672   │     │
│  └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Configuracion Completa de Docker Compose

El archivo `docker-compose.yml` en la raiz del monorepo define todos los servicios:

```yaml
version: "3.9"

services:
  # ─── Base de Datos ───────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: beautyspot-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: beautyspot
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - beautyspot-network

  # ─── Cache ───────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: beautyspot-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass redis123
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "redis123", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - beautyspot-network

  # ─── Message Broker ──────────────────────────────────────────
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: beautyspot-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: beautyspot
      RABBITMQ_DEFAULT_PASS: beautyspot123
    ports:
      - "5672:5672" # AMQP
      - "15672:15672" # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 15s
      timeout: 10s
      retries: 5
    networks:
      - beautyspot-network

  # ─── Microservicios (ver seccion de Dockerfile) ──────────────
  api-gateway:
    build:
      context: .
      dockerfile: services/api-gateway/Dockerfile
    container_name: beautyspot-gateway
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      AUTH_SERVICE_URL: http://auth-service:3001
      CORE_SERVICE_URL: http://core-service:3002
      BOOKING_SERVICE_URL: http://booking-service:3003
      PAYMENT_SERVICE_URL: http://payment-service:3004
      NOTIFICATION_SERVICE_URL: http://notification-service:3005
      MARKETPLACE_SERVICE_URL: http://marketplace-service:3006
      ANALYTICS_SERVICE_URL: http://analytics-service:3007
      JWT_SECRET: ${JWT_SECRET:-dev-jwt-secret-change-in-production}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - beautyspot-network

  auth-service:
    build:
      context: .
      dockerfile: services/auth-service/Dockerfile
    container_name: beautyspot-auth
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_auth
      JWT_SECRET: ${JWT_SECRET:-dev-jwt-secret-change-in-production}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-dev-refresh-secret-change-in-prod}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

  core-service:
    build:
      context: .
      dockerfile: services/core-service/Dockerfile
    container_name: beautyspot-core
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      PORT: 3002
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_core
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

  booking-service:
    build:
      context: .
      dockerfile: services/booking-service/Dockerfile
    container_name: beautyspot-booking
    restart: unless-stopped
    ports:
      - "3003:3003"
    environment:
      PORT: 3003
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_booking
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

  payment-service:
    build:
      context: .
      dockerfile: services/payment-service/Dockerfile
    container_name: beautyspot-payment
    restart: unless-stopped
    ports:
      - "3004:3004"
    environment:
      PORT: 3004
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_payment
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

  notification-service:
    build:
      context: .
      dockerfile: services/notification-service/Dockerfile
    container_name: beautyspot-notification
    restart: unless-stopped
    ports:
      - "3005:3005"
    environment:
      PORT: 3005
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_notification
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
      SMTP_HOST: ${SMTP_HOST:-smtp.gmail.com}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASS: ${SMTP_PASS:-}
      EMAIL_FROM: ${EMAIL_FROM:-noreply@beautyspot.co}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

  marketplace-service:
    build:
      context: .
      dockerfile: services/marketplace-service/Dockerfile
    container_name: beautyspot-marketplace
    restart: unless-stopped
    ports:
      - "3006:3006"
    environment:
      PORT: 3006
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_marketplace
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

  analytics-service:
    build:
      context: .
      dockerfile: services/analytics-service/Dockerfile
    container_name: beautyspot-analytics
    restart: unless-stopped
    ports:
      - "3007:3007"
    environment:
      PORT: 3007
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/beautyspot_analytics
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: redis123
      RABBITMQ_URL: amqp://beautyspot:beautyspot123@rabbitmq:5672
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - beautyspot-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  rabbitmq_data:
    driver: local

networks:
  beautyspot-network:
    driver: bridge
```

### Comandos de Docker Compose

```bash
# Levantar toda la infraestructura
docker-compose up -d

# Levantar solo infraestructura (sin microservicios)
docker-compose up -d postgres redis rabbitmq

# Levantar un servicio especifico con sus dependencias
docker-compose up -d auth-service

# Ver estado de los contenedores
docker-compose ps

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio especifico
docker-compose logs -f api-gateway

# Reconstruir despues de cambios en codigo
docker-compose up -d --build api-gateway

# Detener todos los servicios
docker-compose down

# Detener y eliminar volumenes (datos)
docker-compose down -v

# Reiniciar un servicio
docker-compose restart booking-service
```

### Script de Inicializacion de PostgreSQL

El archivo `infra/docker/postgres/init.sql` crea las 7 bases de datos automaticamente:

```sql
-- infra/docker/postgres/init.sql
-- Script ejecutado automaticamente al crear el contenedor PostgreSQL

CREATE DATABASE beautyspot_auth;
CREATE DATABASE beautyspot_core;
CREATE DATABASE beautyspot_booking;
CREATE DATABASE beautyspot_payment;
CREATE DATABASE beautyspot_notification;
CREATE DATABASE beautyspot_marketplace;
CREATE DATABASE beautyspot_analytics;
```

---

## Estrategia de Dockerfile

### Dockerfile Multi-Etapa (Template Unico)

Todos los microservicios comparten la misma estructura de Dockerfile, parametrizada por el contexto de Turborepo:

```dockerfile
# ─────────────────────────────────────────────────────────────
# services/api-gateway/Dockerfile
# Template aplicable a todos los microservicios
# ─────────────────────────────────────────────────────────────

# Etapa 1: Dependencias de produccion
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar archivos raiz del monorepo
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY turbo.json ./

# Copiar package.json de todos los paquetes y servicios
COPY packages/*/package.json ./packages/*/
COPY services/*/package.json ./services/*/

# Instalar dependencias (respetando lockfile)
RUN npm ci --legacy-peer-deps --ignore-scripts

# Copiar codigo fuente completo
COPY . .

# Etapa 2: Build
FROM deps AS builder
WORKDIR /app

# Ejecutar build con Turborepo
RUN npx turbo run build --filter=api-gateway

# Etapa 3: Produccion (imagen minima)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copiar solo archivos necesarios
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder --chown=nestjs:nodejs /app/services/api-gateway/package.json ./services/api-gateway/

# Variables de entorno de produccion
ENV NODE_ENV=production
ENV PORT=3000

USER nestjs

EXPOSE 3000

CMD ["node", "services/api-gateway/dist/main.js"]
```

### Perfiles de Docker Compose para Desarrollo vs Produccion

```yaml
# docker-compose.override.yml (desarrollo local, auto-cargado por Docker Compose)
version: "3.9"

services:
  api-gateway:
    build:
      target: deps # Usa la etapa de dependencias, no la de produccion
    volumes:
      - ./services/api-gateway/src:/app/services/api-gateway/src
      - ./packages:/app/packages
    command: npm run dev --workspace=services/api-gateway
    environment:
      NODE_ENV: development

  auth-service:
    build:
      target: deps
    volumes:
      - ./services/auth-service/src:/app/services/auth-service/src
      - ./packages:/app/packages
    command: npm run dev --workspace=services/auth-service
    environment:
      NODE_ENV: development

  # Repetir patron para los demas servicios...
```

---

## Pipeline CI/CD con GitHub Actions

### Workflow Principal

Archivo: `.github/workflows/ci.yml`

```yaml
name: BeautySpot CI/CD

on:
  push:
    branches: [main, develop, "feature/**"]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: "20"
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ─── Etapa 1: Calidad de Codigo ──────────────────────────────
  lint-and-typecheck:
    name: Lint y TypeCheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Instalar dependencias
        run: npm ci --legacy-peer-deps

      - name: Lint
        run: npx turbo run lint

      - name: Type Check
        run: npx turbo run type-check

  # ─── Etapa 2: Tests Unitarios ────────────────────────────────
  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Instalar dependencias
        run: npm ci --legacy-peer-deps

      - name: Ejecutar tests
        run: npx turbo run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/beautyspot_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379

      - name: Subir cobertura
        uses: codecov/codecov-action@v4
        if: always()

  # ─── Etapa 3: Build de Docker ────────────────────────────────
  build:
    name: Build Imagenes
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        service:
          - api-gateway
          - auth-service
          - core-service
          - booking-service
          - payment-service
          - notification-service
          - marketplace-service
          - analytics-service
    steps:
      - uses: actions/checkout@v4

      - name: Login al Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Metadata de la imagen
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch

      - name: Build y Push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: services/${{ matrix.service }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─── Etapa 4: Despliegue ─────────────────────────────────────
  deploy-staging:
    name: Despliegue a Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - name: Desplegar a staging
        run: echo "Desplegando a entorno staging via kubectl o docker-compose"

  deploy-production:
    name: Despliegue a Produccion
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Desplegar a produccion
        run: echo "Desplegando a entorno de produccion via kubectl"
```

---

## Estrategia de Testing

### Piramide de Tests

```
        ╱╲
       ╱  ╲        E2E (Testcontainers)
      ╱ 5% ╲       - Flujos completos entre servicios
     ╱──────╲      - Lentos, caros, pocos
    ╱        ╲
   ╱  15%     ╲    Integracion (Supertest)
  ╱────────────╲   - Controllers + DB + Redis
 ╱              ╲   - Velocidad media
╱    80%         ╲  Unitarios (Jest)
──────────────────  - Logica pura, rapidos, muchos
```

### Configuracion de Jest por Servicio

```typescript
// services/auth-service/jest.config.ts
import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/main.ts",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
```

### Tests Unitarios (Ejemplo)

```typescript
// services/booking-service/src/domain/availability/availability.service.spec.ts
describe("AvailabilityService", () => {
  let service: AvailabilityService;

  beforeEach(() => {
    service = new AvailabilityService();
  });

  describe("calcularSlotsDisponibles", () => {
    it("debe retornar slots de 30 minutos dentro del horario laboral", () => {
      const resultado = service.calcularSlotsDisponibles(
        "09:00",
        "18:00",
        30,
        []
      );
      expect(resultado).toHaveLength(18); // 9 horas / 30 min
    });

    it("debe excluir slots ocupados", () => {
      const citasExistentes = [{ startTime: "10:00", endTime: "11:00" }];
      const resultado = service.calcularSlotsDisponibles(
        "09:00",
        "18:00",
        60,
        citasExistentes
      );
      expect(resultado).not.toContain("10:00");
    });

    it("debe respetar buffer entre citas", () => {
      const resultado = service.calcularSlotsDisponibles(
        "09:00",
        "11:00",
        30,
        [{ startTime: "09:30", endTime: "10:00" }],
        15 // buffer de 15 min
      );
      expect(resultado).not.toContain("10:00");
    });
  });
});
```

### Tests de Integracion (Ejemplo)

```typescript
// services/auth-service/src/auth.controller.integration-spec.ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "./app.module";

describe("AuthController (integracion)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/register", () => {
    it("debe registrar un nuevo usuario", () => {
      return request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "test@beautyspot.co",
          password: "SecurePass123!",
          nombre: "Juan Test",
          role: "CLIENT",
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.access_token).toBeDefined();
          expect(res.body.user.email).toBe("test@beautyspot.co");
        });
    });

    it("debe rechazar email duplicado", () => {
      return request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "test@beautyspot.co", // ya existe
          password: "SecurePass123!",
          nombre: "Juan Test 2",
          role: "CLIENT",
        })
        .expect(409);
    });
  });
});
```

### Tests E2E con Testcontainers (Ejemplo)

```typescript
// services/booking-service/test/e2e/booking-flow.e2e-spec.ts
import { GenericContainer, StartedTestContainer } from "testcontainers";
import * as request from "supertest";

describe("Flujo de Reserva E2E", () => {
  let postgresContainer: StartedTestContainer;
  let app: INestApplication;

  beforeAll(async () => {
    postgresContainer = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({
        POSTGRES_USER: "test",
        POSTGRES_PASSWORD: "test",
        POSTGRES_DB: "beautyspot_booking_test",
      })
      .withExposedPorts(5432)
      .start();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        BookingModule.forRoot({
          databaseUrl: `postgresql://test:test@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/beautyspot_booking_test`,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await postgresContainer.stop();
  });

  it("flujo completo: crear cita, confirmar, completar", async () => {
    // 1. Crear cita
    const crearRes = await request(app.getHttpServer())
      .post("/appointments")
      .send({
        professionalId: "prof-001",
        serviceIds: ["svc-001"],
        date: "2026-05-15",
        startTime: "10:00",
      })
      .expect(201);

    const citaId = crearRes.body.id;

    // 2. Confirmar cita
    await request(app.getHttpServer())
      .post(`/appointments/${citaId}/confirm`)
      .expect(200);

    // 3. Completar cita
    await request(app.getHttpServer())
      .post(`/appointments/${citaId}/complete`)
      .expect(200);

    // 4. Verificar estado final
    const consultaRes = await request(app.getHttpServer())
      .get(`/appointments/${citaId}`)
      .expect(200);

    expect(consultaRes.body.status).toBe("COMPLETED");
  });
});
```

---

## Seguridad

### Escaneo de Contenedores

```yaml
# .github/workflows/security.yml
name: Seguridad

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: "0 6 * * 1" # Lunes a las 6 AM

jobs:
  container-scanning:
    name: Escaneo de Contenedores
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Escanear vulnerabilidades con Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: "fs"
          scan-ref: "."
          severity: "CRITICAL,HIGH"
          exit-code: "1"
          format: "sarif"
          output: "trivy-results.sarif"

      - name: Subir resultados a GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: "trivy-results.sarif"

  dependency-audit:
    name: Auditoria de Dependencias
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Auditoria npm
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Verificar licencias
        run: npx license-checker --failOn 'GPL-3.0;AGPL-3.0'
```

### Gestion de Secretos

```bash
# Variables de entorno por entorno

# ─── Desarrollo (.env.development) ─────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/beautyspot_auth
JWT_SECRET=dev-jwt-secret-change-in-production
REDIS_PASSWORD=redis123
RABBITMQ_URL=amqp://beautyspot:beautyspot123@localhost:5672

# ─── Staging (.env.staging) ───────────────────────────────────
# Inyectadas desde GitHub Secrets o AWS Secrets Manager
DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}
JWT_SECRET=${{ secrets.STAGING_JWT_SECRET }}

# ─── Produccion (.env.production) ─────────────────────────────
# Inyectadas desde AWS Secrets Manager / HashiCorp Vault
DATABASE_URL=${SM_DB_URL}
JWT_SECRET=${SM_JWT_SECRET}
```

### Checklist de Seguridad

| Aspecto                      | Implementacion                                               | Prioridad |
| ---------------------------- | ------------------------------------------------------------ | --------- |
| HTTPS en todos los endpoints | Reverse proxy (Nginx/Traefik) con certificados Let's Encrypt | Alta      |
| JWT con rotacion             | Tokens de acceso 15 min, refresh 7 dias                      | Alta      |
| Rate limiting                | Redis-based rate limiter por IP y por usuario                | Alta      |
| Validacion de entrada        | class-validator + Pipes globales en NestJS                   | Alta      |
| SQL Injection                | TypeORM parametrizado, sin queries raw                       | Alta      |
| CORS configurado             | Whitelist de dominios permitidos                             | Media     |
| Headers de seguridad         | Helmet middleware                                            | Media     |
| Secrets en variables         | Nunca en codigo, usar Vault/Secrets Manager                  | Alta      |
| Rotacion de credenciales     | Cada 90 dias para production DB passwords                    | Media     |
| Escaneo de imagenes          | Trivy en CI, renovacion semanal                              | Media     |

---

## Observabilidad

### Logging Estructurado

```typescript
// packages/shared/src/logger/logger.service.ts
import { LoggerService as NestLoggerService, LogLevel } from "@nestjs/common";

export class BeautySpotLogger implements NestLoggerService {
  private context: string;

  constructor(context?: string) {
    this.context = context || "Application";
  }

  log(message: string, meta?: Record<string, any>) {
    this.emit("info", message, meta);
  }

  error(message: string, trace?: string, meta?: Record<string, any>) {
    this.emit("error", message, { ...meta, trace });
  }

  warn(message: string, meta?: Record<string, any>) {
    this.emit("warn", message, meta);
  }

  private emit(level: string, message: string, meta?: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.context,
      message,
      traceId: meta?.traceId || null,
      tenantId: meta?.tenantId || null,
      ...meta,
    };
    console.log(JSON.stringify(logEntry));
  }
}
```

### Health Checks

```typescript
// Cada microservicio expone /health
// services/auth-service/src/health/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  RedisHealthIndicator,
} from "@nestjs/terminus";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () => this.redis.pingCheck("redis"),
    ]);
  }

  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.pingCheck("database"),
      () => this.redis.pingCheck("redis"),
      // Verificar conexion a RabbitMQ
    ]);
  }

  @Get("live")
  liveness() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}
```

### Metricas con Prometheus

```typescript
// packages/shared/src/metrics/metrics.module.ts
import { Module } from "@nestjs/common";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: "/metrics",
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}

// Metricas clave por servicio:
// - http_requests_total (contador por endpoint, metodo, status)
// - http_request_duration_seconds (histograma de latencia)
// - db_query_duration_seconds (histograma de queries)
// - rabbitmq_messages_published_total (contador de eventos)
// - rabbitmq_messages_consumed_total (contador de eventos procesados)
// - appointments_created_total (contador de negocio)
// - active_users_gauge (usuarios activos)
```

### Dashboards de Grafana

Dashboards predefinidos:

| Dashboard      | Metricas Clave                                             |
| -------------- | ---------------------------------------------------------- |
| Visión General | Requests/s, latencia P50/P95/P99, tasa de errores, CPU/RAM |
| API Gateway    | Requests por servicio, rate limiting, errores 4xx/5xx      |
| Base de Datos  | Conexiones activas, queries lentas, lock waits             |
| Redis          | Hit rate, memoria usada, conexiones, evictions             |
| RabbitMQ       | Mensajes encolados, consumo rate, dead letters             |
| Negocio        | Citas creadas, usuarios registrados, revenue diario        |

---

## Despliegue en la Nube

### Comparativa AWS vs GCP

| Criterio              | AWS                           | GCP                          |
| --------------------- | ----------------------------- | ---------------------------- |
| Contenedores          | ECS Fargate / EKS             | Cloud Run / GKE              |
| Base de datos         | RDS PostgreSQL                | Cloud SQL PostgreSQL         |
| Cache                 | ElastiCache Redis             | Memorystore Redis            |
| Mensajeria            | Amazon MQ (RabbitMQ)          | Cloud Pub/Sub (alternativa)  |
| CDN                   | CloudFront                    | Cloud CDN                    |
| Secrets               | Secrets Manager               | Secret Manager               |
| CI/CD                 | CodePipeline / GitHub Actions | Cloud Build / GitHub Actions |
| Costo estimado (dev)  | ~$150 USD/mes                 | ~$130 USD/mes                |
| Costo estimado (prod) | ~$500-800 USD/mes             | ~$450-700 USD/mes            |

**Recomendacion para MVP**: GCP Cloud Run por simplicidad y menor costo inicial.

### Esquema de Kubernetes (Production)

```yaml
# infra/k8s/api-gateway/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: beautyspot
  labels:
    app: api-gateway
    tier: gateway
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: ghcr.io/beautyspot/api-gateway:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3000"
          envFrom:
            - secretRef:
                name: api-gateway-secrets
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: beautyspot
spec:
  selector:
    app: api-gateway
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: beautyspot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Gestion de Entornos

### Estructura de Entornos

```
Entorno         Branch          URL                          Proposito
──────────────  ──────────────  ───────────────────────────  ──────────────────────
Desarrollo      feature/*       localhost                    Desarrollo local
Staging         develop         staging.beautyspot.co        Pruebas antes de prod
Produccion      main            app.beautyspot.co            Servicios para clientes
```

### Variables por Entorno

| Variable         | Desarrollo     | Staging                  | Produccion            |
| ---------------- | -------------- | ------------------------ | --------------------- |
| `NODE_ENV`       | development    | staging                  | production            |
| `DATABASE_URL`   | localhost:5432 | stg-db.internal:5432     | prod-db.internal:5432 |
| `JWT_SECRET`     | valor dev      | GitHub Secret            | Vault/Secret Manager  |
| `LOG_LEVEL`      | debug          | info                     | warn                  |
| `CORS_ORIGIN`    | localhost:\*   | \*.staging.beautyspot.co | \*.beautyspot.co      |
| `RATE_LIMIT_MAX` | 1000           | 500                      | 100                   |

---

## Migraciones de Base de Datos

### Convencion con TypeORM

```bash
# Generar una migracion
npx typeorm migration:generate -d src/data-source.ts src/migrations/AgregarCampoTelefono

# Ejecutar migraciones pendientes
npx typeorm migration:run -d src/data-source.ts

# Revertir ultima migracion
npx typeorm migration:revert -d src/data-source.ts
```

### Nomenclatura de Migraciones

```
src/migrations/
├── 00000000000000-InicialCrearTablas.ts
├── 20260510000000-AgregarCampoTelefonoUsuario.ts
├── 20260510000001-CrearTablaNotificaciones.ts
└── 20260510000002-AgregarIndiceBusquedaMarketplace.ts
```

Formato: `{timestamp}-{DescripcionEnPascalCase}.ts`

### Ejemplo de Migracion

```typescript
// services/auth-service/src/migrations/20260510000000-InicialCrearTablas.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class InicialCrearTablas1700000000000 implements MigrationInterface {
  name = "InicialCrearTablas1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "nombre" VARCHAR(255) NOT NULL,
        "role" VARCHAR(20) NOT NULL DEFAULT 'CLIENT',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "email_verified" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_role ON users(role);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
```

### Estrategia de Ejecucion en CI/CD

```yaml
# Paso dentro del pipeline de despliegue
- name: Ejecutar migraciones
  run: |
    npx typeorm migration:run -d services/auth-service/src/data-source.ts
    npx typeorm migration:run -d services/core-service/src/data-source.ts
    npx typeorm migration:run -d services/booking-service/src/data-source.ts
    npx typeorm migration:run -d services/payment-service/src/data-source.ts
    npx typeorm migration:run -d services/notification-service/src/data-source.ts
    npx typeorm migration:run -d services/marketplace-service/src/data-source.ts
    npx typeorm migration:run -d services/analytics-service/src/data-source.ts
```

---

## Backup y Recuperacion ante Desastres

### Estrategia de Backup

| Componente         | Frecuencia                        | Retencion        | Herramienta      |
| ------------------ | --------------------------------- | ---------------- | ---------------- |
| PostgreSQL (7 DBs) | Cada 6 horas                      | 30 dias          | pg_dump + S3/GCS |
| Redis              | Snapshot diario                   | 7 dias           | BGSAVE nativo    |
| RabbitMQ           | No aplica (mensajes transitorios) | -                | -                |
| Configuracion K8s  | En cada deploy                    | Git (versionado) | GitOps           |
| Secrets            | En cada rotacion                  | Vault audit log  | Vault            |

### Script de Backup

```bash
#!/bin/bash
# infra/scripts/backup.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/beautyspot-backups/$TIMESTAMP"
S3_BUCKET="s3://beautyspot-backups"

mkdir -p "$BACKUP_DIR"

# Lista de bases de datos
DATABASES=(
  "beautyspot_auth"
  "beautyspot_core"
  "beautyspot_booking"
  "beautyspot_payment"
  "beautyspot_notification"
  "beautyspot_marketplace"
  "beautyspot_analytics"
)

# Backup de cada base de datos
for DB in "${DATABASES[@]}"; do
  echo "Backup de $DB..."
  pg_dump \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB" \
    --format=custom \
    --compress=9 \
    > "$BACKUP_DIR/${DB}_${TIMESTAMP}.dump"
done

# Subir a S3/GCS
aws s3 sync "$BACKUP_DIR" "$S3_BUCKET/$TIMESTAMP/"

# Limpiar backups locales
rm -rf "$BACKUP_DIR"

echo "Backup completado: $TIMESTAMP"
```

### Plan de Recuperacion ante Desastres

| Escenario                       | RTO     | RPO      | Procedimiento                                          |
| ------------------------------- | ------- | -------- | ------------------------------------------------------ |
| Caida de un servicio            | 5 min   | 0        | Reiniciar contenedor/pod, health check automatico      |
| Caida de base de datos          | 15 min  | 6 horas  | Promover replica, restaurar ultimo backup si necesario |
| Caida de Redis                  | 2 min   | 1 dia    | Reiniciar, datos se reconstruyen desde DB              |
| Caida de zona completa          | 30 min  | 6 horas  | Activar DR en zona secundaria, restaurar backups       |
| Perdida de datos (error humano) | 1 hora  | Variable | Restaurar backup punto-en-tiempo (PITR)                |
| Caida total de la region        | 2 horas | 6 horas  | Desplegar infraestructura en region alternativa        |

**RTO** (Recovery Time Objective): Tiempo maximo para restaurar el servicio.
**RPO** (Recovery Point Objective): Maxima perdida de datos aceptable.

### Procedimiento de Restauracion

```bash
#!/bin/bash
# infra/scripts/restore.sh

DB_NAME=$1  # Ej: beautyspot_auth
BACKUP_FILE=$2  # Ej: s3://beautyspot-backups/20260510/beautyspot_auth_20260510.dump

# Descargar backup de S3
aws s3 cp "$BACKUP_FILE" /tmp/restore.dump

# Restaurar
pg_restore \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  /tmp/restore.dump

echo "Restauracion de $DB_NAME completada"
```
