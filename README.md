# BeautySpot

Plataforma SaaS multi-tenant para gestión de barberías, salones de belleza, spas y
centros estéticos en Latinoamérica. Monorepo con microservicios NestJS, frontend
Next.js, PostgreSQL, Redis, RabbitMQ y Docker.

## Arquitectura

**Stack**

| Capa           | Tecnología                                            |
| -------------- | ----------------------------------------------------- |
| Backend        | NestJS 11 + TypeORM + TypeScript (8 servicios)        |
| Frontend       | Next.js 16 (App Router) + TailwindCSS + Zustand + SWR |
| Base de datos  | PostgreSQL 16 — 7 bases, una por servicio             |
| Caché/sesiones | Redis 7                                               |
| Bus de eventos | RabbitMQ 3                                            |
| Monorepo       | Turborepo + npm workspaces                            |
| Contenedores   | Docker + Docker Compose                               |

**Microservicios**

| Servicio             | Puerto | Base de datos             | Responsabilidad                                                     |
| -------------------- | ------ | ------------------------- | ------------------------------------------------------------------- |
| api-gateway          | 3000   | — (sin base propia)       | Enrutado, validación de JWT, tenant, rate limiting, circuit breaker |
| auth-service         | 3001   | `beautyspot_auth`         | Registro, login, JWT, personal, membresías                          |
| core-service         | 3002   | `beautyspot_core`         | Negocios, sucursales, profesionales, servicios, clientes, imágenes  |
| booking-service      | 3003   | `beautyspot_booking`      | Citas, disponibilidad, bloqueos, reserva pública                    |
| payment-service      | 3004   | `beautyspot_payment`      | Pagos manuales, facturas, caja                                      |
| notification-service | 3005   | `beautyspot_notification` | Notificaciones in-app, preferencias, correo                         |
| marketplace-service  | 3006   | `beautyspot_marketplace`  | Perfiles públicos, búsqueda, feed, reseñas                          |
| analytics-service    | 3007   | `beautyspot_analytics`    | KPIs, métricas, reportes                                            |

En total **48 controladores y 216 rutas**, todas accesibles a través del gateway.
Referencia completa en [docs/API.md](docs/API.md).

**Decisiones de arquitectura destacadas**

- **Multi-tenancy lógica** (ADR-002): columna `businessId` en las tablas de negocio.
  El gateway inyecta el tenant en la cabecera `x-business-id` a partir del JWT, así
  que el cliente no puede falsificarlo.
- **Base de datos por servicio**: ningún servicio lee las tablas de otro.
- **Transactional Outbox** en auth, core, booking, marketplace y payment: el evento
  se escribe en la misma transacción que el cambio, y un worker lo publica después.
  Nunca hay un cambio sin evento ni un evento sin cambio.
- **Circuit breaker** por servicio en el gateway, que abre ante 5xx, timeout o
  error de red.
- **Invalidación de sesión cross-service**: el `tokenVersion` vive en Redis como
  fuente de verdad, así que un logout invalida los tokens ya emitidos.
- **Las invariantes viven en la base**: caja única por sede, cobro único por cita,
  reseña única por cita y número de factura por negocio son índices únicos
  parciales, no solo comprobaciones en código.

Detalle en [docs/04-ARQUITECTURA.md](docs/04-ARQUITECTURA.md).

## Instalación

### Requisitos

| Herramienta | Versión            |
| ----------- | ------------------ |
| Node.js     | 20.x               |
| npm         | 10.x               |
| Docker      | 24+ con Compose v2 |

Docker sólo aporta la **infraestructura**; los servicios corren en el host con
Turborepo.

### Pasos

```bash
# 1. Clonar
git clone https://github.com/Yeistyle11/BeautySpot.git
cd BeautySpot

# 2. Instalar (el flag es obligatorio en este monorepo)
npm install --legacy-peer-deps

# 3. Infraestructura: Postgres 16 + Redis 7 + RabbitMQ 3
npm run docker:up

# 4. Copiar los .env (los valores por defecto ya coinciden con el compose)
for s in services/*/; do
  [ -f "$s.env.example" ] && cp -n "$s.env.example" "$s.env"
done

# 5. Arrancar los 8 servicios y el frontend
npm run dev
```

Las 7 bases de datos se crean solas en el primer arranque del volumen de Postgres
(`infra/docker/postgres/init.sh`). No hay que ejecutar migraciones en desarrollo:
TypeORM arranca con `synchronize` activado y crea el esquema desde las entidades.

La aplicación queda en:

- **Frontend**: <http://localhost:8080>
- **API Gateway**: <http://localhost:3000>
- **Panel de RabbitMQ**: <http://localhost:15672> (`beautyspot` / `beautyspot123`)

> **Postgres se publica en el puerto 5433**, no en 5432, para no chocar con una
> instalación local. Todos los `.env.example` apuntan ya a 5433.

Guía detallada y solución de problemas en [docs/SETUP.md](docs/SETUP.md).

## Scripts

```bash
# Desarrollo
npm run dev                       # turbo dev: 8 servicios + frontend
cd apps/frontend && npm run dev   # sólo frontend (8080)

# Build
npm run build                     # turbo build de servicios y paquetes

# Tests
npm test                          # 1870 tests unitarios (13 proyectos Jest)
npm run test:watch
npm run test:coverage             # con cobertura y gate

# Calidad
npm run lint
npm run type-check
npm run format
npm run format:check

# Infraestructura
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:restart
```

Tests de un solo servicio: hay que entrar en su carpeta. Sólo el frontend declara
`displayName`, así que `--selectProjects` desde la raíz únicamente sirve para él.

```bash
cd services/booking-service && npx jest appointments.service
npx jest --selectProjects frontend   # esto sí, desde la raíz
```

## Estructura

```
BeautySpot/
├── services/                  # 8 microservicios NestJS
│   ├── api-gateway/            # 3000 — enrutado y seguridad de borde
│   ├── auth-service/           # 3001
│   ├── core-service/           # 3002
│   ├── booking-service/        # 3003
│   ├── payment-service/        # 3004
│   ├── notification-service/   # 3005
│   ├── marketplace-service/    # 3006
│   └── analytics-service/      # 3007
├── apps/
│   └── frontend/              # Next.js 16 (8080) — fuente de verdad de la UI
├── packages/
│   ├── database/              # Configuración TypeORM, entidades base, paginación
│   ├── event-types/           # Contratos de los 30 eventos de RabbitMQ
│   ├── nest-common/           # Módulo compartido: caché, event bus, outbox, filtros
│   ├── shared-constants/      # Reglas de negocio con nombre
│   ├── shared-types/          # Enums e interfaces del dominio
│   └── shared-utils/          # Horas, intervalos de agenda, paginación
├── infra/docker/postgres/     # init.sh: crea las 7 bases y su usuario
├── docs/                      # Documentación (ver docs/00-INDICE.md)
├── docker-compose.yml         # Infraestructura de desarrollo
└── docker-compose.test.yml    # Infraestructura para tests de integración
```

## Funcionalidades

**Gestión del negocio** — multi-tenancy por subdominio (`{slug}.beautyspot.co`),
negocios y sedes con selector de sede activa, equipo y asignación de servicios con
precio propio, categorías y catálogo, fichas de cliente con campos configurables
por negocio, horarios de atención (incluido cerrar de madrugada).

**Reservas y agenda** — vista día en columnas por profesional, con el hueco del
procesado pintado y bloqueo rápido desde el hueco. Servicios encadenados con
distintos profesionales, buffer de limpieza, bloqueos con repetición, reserva
pública sin cuenta desde el marketplace, ciclo completo (pendiente → confirmada →
en curso → atendida, con cancelación tipificada, no-show y reprogramación) y
recordatorios de 24 h y 1 h.

**Pagos y facturación** — pagos manuales por varios métodos, caja con corte X y
cierre Z desglosado, facturación con IVA y serie por negocio, PDF descargable
desde el portal del cliente, devoluciones y resumen diario.

**Fidelización** — puntos que se acreditan al atender la cita y se canjean al
cobrar, niveles configurables por negocio y felicitación de cumpleaños.

**Análisis** — KPIs, ticket medio, tasa de retorno y frecuencia de visita,
rentabilidad por servicio, ocupación de agenda y ranking de profesionales.

**Marketplace** — perfiles públicos de negocios y profesionales, búsqueda con
filtros, feed, y reseñas verificadas contra la cita, con respuesta del negocio,
moderación, denuncia y marca de útil.

## Roles

| Rol            | Alcance                             |
| -------------- | ----------------------------------- |
| `SUPER_ADMIN`  | Toda la plataforma                  |
| `OWNER`        | Su negocio, incluida la facturación |
| `ADMIN`        | Su negocio, sin facturación         |
| `PROFESSIONAL` | Su agenda y su perfil               |
| `RECEPTIONIST` | Citas, pagos y clientes             |
| `CLIENT`       | Marketplace y sus propias citas     |

Matriz completa en [docs/08-ROLES-PERMISOS.md](docs/08-ROLES-PERMISOS.md).

## Configuración de entorno

Cada servicio lee su propio `.env`; se versiona sólo el `.env.example`. Ejemplo de
`payment-service`:

```bash
NODE_ENV=development
PORT=3004
DATABASE_URL=postgresql://beautyspot_payment:beautyspot_payment@localhost:5433/beautyspot_payment
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis123
RABBITMQ_URL=amqp://beautyspot:beautyspot123@localhost:5672
INTERNAL_API_SECRET=<secreto compartido entre servicios>
CORS_ORIGINS=http://localhost:3000
```

> Cada servicio tiene su propio usuario de Postgres, dueño únicamente de su base.
> Redis se configura siempre con `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`: es la
> única forma que lee el código.

## Calidad

**Convenciones**

- **Prettier**: comillas dobles, punto y coma, comas ES5, ancho 80, saltos LF.
- **ESLint**: TypeScript + Prettier. `no-explicit-any` es **error** en producción y
  está desactivado en los ficheros de test. Variables sin usar permitidas con
  prefijo `_`. `console.log` avisa (usar `console.warn`/`console.error`).
- **Husky + lint-staged**: pre-commit con ESLint y Prettier.
- **Idioma**: todo el texto de usuario, los comentarios y los mensajes de commit van
  en español.

**Tests**

|             | Cantidad                                                        |
| ----------- | --------------------------------------------------------------- |
| Unitarios   | **1870 tests / 136 suites**                                     |
| Integración | 75 tests / 25 suites (contra Postgres, Redis y RabbitMQ reales) |

Cobertura: **92,34 %** statements, **81,41 %** branches, **83,90 %** functions,
**93,69 %** lines. El gate de `jest.config.js` falla el CI si baja de 92/80/80/93.

Detalle en [docs/TESTING.md](docs/TESTING.md).

**Integración continua**

Un workflow (`.github/workflows/tests.yml`) con 6 jobs: `quality`, `test`,
`integration`, `changes`, `docker-build` (matriz dinámica de hasta 9 imágenes) y
`ci` como check agregado. Ver [docs/CI-CD.md](docs/CI-CD.md).

## Documentación

Punto de entrada: **[docs/00-INDICE.md](docs/00-INDICE.md)**.

Los más usados:

| Documento                                          | Contenido                         |
| -------------------------------------------------- | --------------------------------- |
| [docs/SETUP.md](docs/SETUP.md)                     | Entorno de desarrollo paso a paso |
| [docs/API.md](docs/API.md)                         | Referencia de las 216 rutas       |
| [docs/04-ARQUITECTURA.md](docs/04-ARQUITECTURA.md) | Arquitectura y ADRs               |
| [docs/05-BASE-DATOS.md](docs/05-BASE-DATOS.md)     | Las 47 tablas, columna a columna  |
| [docs/TESTING.md](docs/TESTING.md)                 | Estrategia de tests               |
| [docs/CI-CD.md](docs/CI-CD.md)                     | Pipeline de CI                    |
| [DEPLOY.md](DEPLOY.md)                             | Despliegue en producción          |

## Despliegue

Ver [DEPLOY.md](DEPLOY.md).

`docker-compose.prod.yml` levanta los 12 contenedores a partir de las 9 imágenes
construidas. El esquema de base de datos lo crean las migraciones, que **no se
ejecutan al arrancar**: hay que aplicarlas con `npm run migration:run` antes de
levantar los servicios.

> Lo que queda antes de un despliegue real es de operación: generar los
> secretos, apuntar el DNS y montar el reverse proxy con el certificado wildcard
> `*.beautyspot.co` (el tenant se resuelve por subdominio). Checklist completo en
> [DEPLOY.md](DEPLOY.md).

## Licencia

Propiedad privada — todos los derechos reservados.
