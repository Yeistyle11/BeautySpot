# BeautySpot

Plataforma SaaS multi-tenant para gestión de barberías, salones de belleza, spas y centros estéticos en Latinoamérica. Arquitectura de microservicios con NestJS, PostgreSQL, Redis, RabbitMQ y Docker.

## Arquitectura

**Stack Tecnológico:**

- **Backend**: NestJS 10 + TypeORM + TypeScript (8 microservicios)
- **Frontend**: Next.js 14 (App Router) + TypeScript + TailwindCSS
- **Base de Datos**: PostgreSQL 16 (8 bases de datos, una por servicio)
- **Caché**: Redis 7
- **Message Broker**: RabbitMQ 3
- **Monorepo**: Turborepo + npm workspaces
- **Contenedores**: Docker + Docker Compose

**Microservicios:**
| Servicio | Puerto | Responsabilidad |
|---------|--------|----------------|
| API Gateway | 3000 | Routing, JWT validation, tenant resolution, rate limiting |
| Auth Service | 3001 | Registro, login, JWT, memberships, password reset |
| Core Service | 3002 | Negocios, sucursales, profesionales, servicios, clientes |
| Booking Service | 3003 | Citas, disponibilidad, agenda, bloqueos |
| Payment Service | 3004 | Pagos manuales, facturas, caja |
| Notification Service | 3005 | Notificaciones in-app, preferencias |
| Marketplace Service | 3006 | Búsqueda pública, perfiles, reseñas |
| Analytics Service | 3007 | Dashboard KPIs, reportes, métricas |

## Funcionalidades

**Gestión de Negocio:**

- Multi-tenancy por subdominio ({slug}.beautyspot.co)
- Gestión de negocios y sucursales
- Perfiles profesionales y asignación de servicios
- Categorías de servicios y catálogo completo
- Gestión de clientes y base de datos

**Reservas y Agenda:**

- Sistema de citas con disponibilidad por horario
- Gestión de disponibilidad y bloqueos
- Flow de reserva pública con confirmación
- Notificaciones automáticas y recordatorios
- Sistema de reseñas y calificaciones

**Pagos y Facturación:**

- Pagos manuales (efectivo, transferencia)
- Gestión de caja y sesiones de efectivo
- Facturación automática con PDF
- Registro de pagos y tracking

**Análisis y Reportes:**

- Dashboard con KPIs en tiempo real
- Reportes de rendimiento de profesionales
- Métricas de negocios y tendencias
- Análisis de ocupación y revenue

**Marketplace:**

- Perfiles públicos de negocios y profesionales
- Búsqueda y filtrado avanzado
- Sistema de reseñas y valoraciones
- Feed de actividad social

## Instalación

### Requisitos

- Node.js 18+ (npm 10+)
- PostgreSQL 16+
- Docker y Docker Compose
- Redis 7+
- RabbitMQ 3+

### Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/Yeistyle11/BeautySpot.git
cd BeautySpot

# 2. Instalar dependencias
npm install --legacy-peer-deps

# 3. Iniciar infraestructura
docker compose up -d postgres redis rabbitmq

# 4. Configurar bases de datos
# Las bases de datos se crean automáticamente al iniciar PostgreSQL

# 5. Iniciar microservicios (modo desarrollo)
turbo dev

# 6. Iniciar frontend (en otra terminal)
cd apps/frontend && npm run dev
```

La aplicación corre en:

- **Frontend**: http://localhost:3001
- **API Gateway**: http://localhost:3000

### Instalación con Docker completo

```bash
# Iniciar todos los servicios
docker compose up -d

# Iniciar infraestructura + microservicios
docker compose up -d postgres redis rabbitmq \
  api-gateway auth-service core-service booking-service \
  payment-service notification-service marketplace-service analytics-service
```

## Scripts

```bash
# Desarrollo
turbo dev                # Inicia todos los servicios en modo watch
npm run dev              # Inicia servidor de desarrollo

# Build
turbo build              # Build de todos los servicios y packages

# Tests
npm test                 # Ejecuta todos los tests Jest
npm run test:coverage     # Tests con coverage
npm run verify-coverage   # Verifica % de cobertura

# Calidad de código
turbo lint               # ESLint en todo el monorepo
turbo type-check         # TypeScript check en todo el monorepo

# Base de datos
docker compose up -d postgres redis rabbitmq  # Infraestructura
npm run db:push          # Crear tablas en desarrollo
npm run db:seed          # Cargar datos de demostración
npm run db:studio        # Prisma Studio GUI

# Docker
docker compose up -d      # Inicia todos los servicios
docker compose down        # Detiene todos los servicios
docker compose logs        # Ver logs de todos los servicios
```

## Estructura del Proyecto

```
BeautySpot/
├── services/               # 8 microservicios NestJS
│   ├── api-gateway/         # API Gateway (puerto 3000)
│   ├── auth-service/        # Auth Service (puerto 3001)
│   ├── core-service/        # Core Service (puerto 3002)
│   ├── booking-service/     # Booking Service (puerto 3003)
│   ├── payment-service/     # Payment Service (puerto 3004)
│   ├── notification-service/ # Notification Service (puerto 3005)
│   ├── marketplace-service/  # Marketplace Service (puerto 3006)
│   └── analytics-service/   # Analytics Service (puerto 3007)
├── apps/                   # Aplicaciones frontend
│   └── frontend/            # Next.js 14 frontend (puerto 3001)
├── packages/               # Paquetes compartidos
│   ├── database/            # TypeORM entities, pagination
│   ├── event-types/         # Contratos de eventos RabbitMQ
│   ├── nest-common/         # Decorators, guards, filters comunes
│   ├── shared-constants/   # Constantes y enums
│   ├── shared-types/        # Interfaces TypeScript compartidas
│   └── shared-utils/        # Utilidades comunes
├── scripts/                # Scripts de utilidad
├── docs/                   # Documentación técnica
└── infra/                  # Infraestructura Docker
    └── docker/postgres/     # Scripts de inicialización
```

## Roles del Sistema

| Rol          | Descripción                               | Dashboard                    |
| ------------ | ----------------------------------------- | ---------------------------- |
| SUPER_ADMIN  | Administrador de la plataforma completa   | Acceso a todos los servicios |
| OWNER        | Propietario del negocio (incluye billing) | Gestión completa del negocio |
| ADMIN        | Administrador del negocio (sin billing)   | Operaciones diarias          |
| PROFESSIONAL | Profesional del negocio                   | Su agenda y perfil           |
| RECEPTIONIST | Recepcionista                             | Citas, pagos, clientes       |
| CLIENT       | Cliente final                             | Marketplace y sus citas      |

## Configuración de Entorno

Cada servicio requiere su archivo `.env`:

```bash
# Ejemplo para payment-service
NODE_ENV=development
PORT=3004
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/beautyspot_payment
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://beautyspot:beautyspot123@localhost:5672
```

## Desarrollo

### Código Limpio

- **Prettier**: Formateo automático con Prettier
- **ESLint**: Linting con reglas personalizadas
- **Husky**: Git hooks para pre-commit (ESLint + Prettier)

### Tests

- **Framework**: Jest con ts-jest
- **Cobertura actual**: 259 tests passing, 83% coverage
- **Infraestructura**: 8 setup.ts files con mocking completo
- **Ejecución**: `npm test` en cada servicio

### Base de Datos

- **Sincronización**: TypeORM con modo synchronize en desarrollo
- **Migraciones**: Usar migraciones en producción
- **Tooling**: Prisma Studio para gestión visual

## Deployment

Ver [DEPLOY.md](DEPLOY.md) para guía completa de despliegue en producción.

## Soporte

Para issues, preguntas o contribuciones, por favor abre un issue en el repositorio.

## Licencia

Propiedad privada - Todos los derechos reservados.
