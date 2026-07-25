# Despliegue de BeautySpot en producción

Guía de despliegue de la arquitectura actual: monorepo Turborepo con 8
microservicios NestJS, frontend Next.js 14, PostgreSQL 16, Redis 7 y RabbitMQ 3.

> Para el entorno de desarrollo local, ver [docs/SETUP.md](docs/SETUP.md).

---

## ⛔ Bloqueantes antes del primer despliegue

Estos puntos **no son opcionales**: con el código tal como está hoy, un despliegue
a producción no funcionaría. Están listados primero a propósito.

### 1. ~~Faltan las migraciones de 4 servicios~~ — resuelto

`synchronize` de TypeORM está deshabilitado cuando `NODE_ENV=production`
(`packages/database/src/config/typeorm.config.ts`: `synchronize: !isProduction && synchronize`).
Eso es correcto —no se quiere que el ORM altere el esquema en producción—, pero
significa que **el esquema tiene que crearlo una migración**. Los siete servicios
con base de datos tienen ya su esquema completo en migraciones:

| Servicio               | Migraciones | Contenido                               |
| ---------------------- | ----------- | --------------------------------------- |
| `auth-service`         | 1           | Esquema completo, outbox incluido       |
| `core-service`         | 1           | Esquema completo (10 tablas)            |
| `marketplace-service`  | 1           | Esquema completo, outbox incluido       |
| `notification-service` | 1           | Esquema completo                        |
| `analytics-service`    | 1           | Esquema completo                        |
| `booking-service`      | 2           | Outbox + esquema                        |
| `payment-service`      | 3           | Esquema + outbox + índice único de caja |

Las migraciones se escribieron a partir de los metadatos del propio TypeORM, de
modo que reproducen literalmente lo que `synchronize` genera —incluidos los
nombres autogenerados de índices y constraints (`IDX_…`, `FK_…`, `UQ_…`,
`PK_…`), que no se pueden inventar: si no coinciden, el ORM los toma por objetos
distintos.

Cada servicio tiene un test de integración `schema-migrations.int-test.ts` que
levanta el esquema desde cero **sólo con las migraciones** y comprueba que
`synchronize` no tendría después ningún cambio pendiente. Es lo que impide que
una migración se desvíe de las entidades sin que nadie se entere hasta el
despliegue.

### 2. ~~No hay forma de ejecutar las migraciones~~ — resuelto

Los siete servicios con base de datos tienen ya el mecanismo completo:

- `createTypeOrmConfig` declara `migrations` y **`migrationsRun: false`**
  (`packages/database/src/config/typeorm.config.ts`).
- Cada servicio tiene un `src/data-source.ts` que el CLI de TypeORM consume.
- Cada `package.json` expone `migration:run`, `migration:revert` y
  `migration:generate`.

```bash
# aplicar las migraciones pendientes de un servicio
npm run migration:run --workspace @beautyspot/core-service

# generar una migración nueva tras cambiar entidades (necesita la BD viva)
npm run migration:generate --workspace @beautyspot/core-service -- src/migrations/NombreDescriptivo
```

**Las migraciones no se ejecutan al arrancar**, y es deliberado: con varias
réplicas del mismo servicio todas competirían por migrar a la vez, y un fallo de
migración dejaría al servicio sin arrancar en lugar de fallar en un paso de
despliegue visible. Hay que ejecutar `migration:run` de los siete servicios
**antes** de levantar los contenedores.

La lista de entidades de cada servicio vive en un único `src/orm-entities.ts`
que comparten `app.module.ts` y `data-source.ts`. No dupliques la lista: si las
dos divergen, `migration:generate` compara el esquema contra una lista
incompleta y propone borrar las tablas que le falten.

### 3. No hay artefacto de orquestación para producción

El repositorio contiene:

- `docker-compose.yml` — **sólo infraestructura de desarrollo** (Postgres, Redis,
  RabbitMQ). No levanta los servicios.
- `docker-compose.test.yml` — infraestructura para los tests de integración.
- Un `Dockerfile` por servicio y otro para el frontend (9 en total), validados en CI.

Falta un `docker-compose.prod.yml` (o manifiestos de Kubernetes) que orqueste los
9 contenedores más la infraestructura. La sección
[Orquestación](#3-orquestación-de-la-aplicación) propone uno.

### 4. ~~Los microservicios no tienen healthcheck~~ — resuelto

Los ocho servicios exponen `GET /health`, y los nueve Dockerfile declaran
`HEALTHCHECK`.

- Los 7 microservicios usan el `HealthModule` compartido de
  `@beautyspot/nest-common`, que comprueba las dependencias que cada uno tenga
  —Postgres con un `SELECT 1`, Redis con un `PING`, RabbitMQ mirando si hay
  canal abierto— y responde **200 si todas están arriba y 503 si alguna está
  caída**. El código es lo único que miran las _readiness probes_: devolver 200
  con un `"unhealthy"` en el cuerpo dejaría al orquestador enviando tráfico a un
  servicio que no puede atender.
- El gateway conserva su health agregado, que consulta el `/health` de los 7 y
  devuelve `healthy` o `degraded`. **Ese endpoint no funcionaba**: el
  controlador existía pero no estaba declarado en ningún módulo, así que
  respondía 404 pese a que esta misma guía lo daba por operativo. Ahora se
  registra en `HealthModule` del gateway.

El endpoint es público por diseño: `@Public()` lo exime de `JwtAuthGuard` y de
`BusinessScopeGuard`, `RolesGuard` lo deja pasar al no llevar `@Roles`, y
`InternalSecretGuard` sólo protege `/internal`.

---

## 1. Requisitos del servidor

| Componente | Versión mínima | Notas                                        |
| ---------- | -------------- | -------------------------------------------- |
| Node.js    | 20.x           | Es la versión con la que se construye en CI  |
| npm        | 10.x           | El repo declara `packageManager: npm@10.8.0` |
| Docker     | 24+            | Con Compose v2 (`docker compose`)            |
| PostgreSQL | 16             | Puede ser gestionado (RDS, Cloud SQL…)       |
| Redis      | 7              | Sesiones, caché de tenants y rate limiting   |
| RabbitMQ   | 3              | Bus de eventos entre servicios               |

Recursos orientativos para un despliegue de un solo nodo: 4 vCPU y 8 GB de RAM.
Son 9 contenedores de aplicación más tres de infraestructura; el build del
frontend es la parte que más memoria consume.

---

## 2. Construcción de las imágenes

Todos los Dockerfile son multi-stage y **exigen que el contexto sea la raíz del
monorepo**, porque necesitan acceso a los workspaces `@beautyspot/*`:

```bash
# Un servicio
docker build -f services/auth-service/Dockerfile -t beautyspot-auth:1.0.0 .

# El frontend
docker build -f apps/frontend/Dockerfile -t beautyspot-frontend:1.0.0 .
```

Nunca `cd services/auth-service && docker build .`: fallaría al resolver los
paquetes compartidos.

Cada imagen construye con `npx turbo run build --filter=@beautyspot/<paquete>`, lo
que arrastra también los paquetes compartidos de los que depende.

Script para construir las nueve:

```bash
for s in api-gateway auth-service core-service booking-service payment-service \
         notification-service marketplace-service analytics-service; do
  docker build -f "services/$s/Dockerfile" -t "beautyspot-$s:$VERSION" .
done
docker build -f apps/frontend/Dockerfile -t "beautyspot-frontend:$VERSION" .
```

El CI ya valida que las nueve imágenes construyen en cada cambio relevante; ver
[docs/CI-CD.md](docs/CI-CD.md).

---

## 3. Orquestación de la aplicación

Este fichero **no existe todavía** en el repositorio (ver bloqueante 3). Esta es la
forma mínima de `docker-compose.prod.yml`, con los puertos y variables que los
servicios esperan de verdad:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    # Sin `ports`: sólo accesible desde la red interna de Docker.
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    restart: always
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  auth-service:
    image: beautyspot-auth-service:${VERSION}
    restart: always
    env_file: ./env/auth-service.env
    depends_on:
      postgres: { condition: service_healthy }

  # ... repetir para core, booking, payment, notification, marketplace, analytics

  api-gateway:
    image: beautyspot-api-gateway:${VERSION}
    restart: always
    env_file: ./env/api-gateway.env
    ports:
      - "127.0.0.1:3000:3000" # sólo local; expuesto vía reverse proxy

  frontend:
    image: beautyspot-frontend:${VERSION}
    restart: always
    ports:
      - "127.0.0.1:8080:8080"

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

Puntos importantes:

- **Sólo el gateway y el frontend publican puertos**, y sólo en `127.0.0.1`. Postgres,
  Redis, RabbitMQ y los 7 microservicios no deben ser accesibles desde internet.
- Dentro de la red de Docker las URLs entre servicios usan el nombre del contenedor
  (`http://auth-service:3001`), no `localhost`.
- El panel de RabbitMQ (15672) **no debe publicarse** en producción.

### Usuarios de base de datos

`infra/docker/postgres/init.sh` crea las 7 bases, cada una con **su propio
usuario, dueño sólo de esa base y sin `SUPERUSER`**, y revoca el `CONNECT` a
`PUBLIC` para que los demás servicios no puedan siquiera conectarse a ella.

Las 7 bases son `beautyspot_auth`, `beautyspot_core`, `beautyspot_booking`,
`beautyspot_payment`, `beautyspot_notification`, `beautyspot_marketplace` y
`beautyspot_analytics`, y el usuario de cada una se llama igual. El
`api-gateway` no tiene base de datos propia.

Las contraseñas se pasan por entorno —`BEAUTYSPOT_AUTH_PASSWORD`,
`BEAUTYSPOT_CORE_PASSWORD`, …—; **hay que definir las siete en producción**,
porque el valor por defecto (el propio nombre del usuario) sólo sirve para
desarrollo local.

> Antes este fichero era un `.sql` que creaba un único rol `beautyspot`
> SUPERUSER con la contraseña en claro y sin un solo `GRANT`: funcionaba
> justamente por ser superusuario, con lo que cualquier servicio podía leer y
> escribir en las bases de los otros siete y administrar el clúster. Creaba
> además la base y el usuario de SonarQube (`sonar`/`sonar123`), que ningún
> compose del repositorio levanta. Ambas cosas están eliminadas.
>
> El script sólo se ejecuta en el **primer arranque del volumen**. Sobre un
> volumen ya creado no tiene efecto: hay que recrearlo con
> `docker volume rm beautyspot_postgres_data`.

---

## 4. Variables de entorno

Cada servicio lee su propio `.env`. Los `.env.example` del repositorio contienen los
valores de desarrollo y sirven de plantilla.

### Comunes a todos los servicios

| Variable              | Descripción                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`            | **`production`** — activa SSL, desactiva `synchronize`, sube los pools y limita el logging a `error`/`warn` |
| `PORT`                | Puerto de escucha (ver tabla de servicios)                                                                  |
| `DATABASE_URL`        | `postgresql://usuario:clave@postgres:5432/beautyspot_<servicio>`                                            |
| `RABBITMQ_URL`        | `amqp://usuario:clave@rabbitmq:5672`                                                                        |
| `INTERNAL_API_SECRET` | Secreto compartido de las rutas `internal/*`. **El mismo en todos los servicios**                           |
| `CORS_ORIGINS`        | Orígenes permitidos, separados por coma. En producción, el dominio real                                     |

Redis se configura **siempre** con `REDIS_HOST`, `REDIS_PORT` y
`REDIS_PASSWORD`. Es la única forma que lee el código (`RedisCacheService`, el
`RedisModule` del gateway y BullMQ en notification).

> `analytics`, `marketplace` y `payment` declaraban en su lugar un `REDIS_URL`
> que **no se lee en ninguna parte del código**. No es que usaran otra forma:
> caían al valor por defecto `localhost:6379` sin contraseña, es decir, no se
> conectaban al Redis configurado. Ya está unificado, igual que el usuario de
> base de datos, que ahora es uno por servicio.

### Específicas por servicio

**api-gateway (3000)** — no tiene base de datos.

| Variable                 | Descripción                                    |
| ------------------------ | ---------------------------------------------- |
| `JWT_SECRET`             | Debe coincidir con el de `auth-service`        |
| `{SERVICIO}_SERVICE_URL` | URL interna de cada uno de los 7 servicios     |
| `RATE_LIMIT_AUTH_MAX`    | Límite de peticiones en rutas de autenticación |
| `RATE_LIMIT_GENERAL_MAX` | Límite general                                 |

**auth-service (3001)**

| Variable                 | Descripción                                        |
| ------------------------ | -------------------------------------------------- |
| `JWT_SECRET`             | Firma del access token                             |
| `JWT_REFRESH_SECRET`     | Firma del refresh token, **distinto del anterior** |
| `JWT_EXPIRES_IN`         | `15m` por defecto                                  |
| `JWT_REFRESH_EXPIRES_IN` | `7d` por defecto                                   |
| `BCRYPT_SALT_ROUNDS`     | `12`                                               |

**core-service (3002)** — almacenamiento de imágenes

| Variable                | Descripción             |
| ----------------------- | ----------------------- |
| `AWS_ACCESS_KEY_ID`     | Credenciales de S3      |
| `AWS_SECRET_ACCESS_KEY` | Credenciales de S3      |
| `AWS_REGION`            | `us-east-1` por defecto |
| `AWS_S3_BUCKET`         | Bucket de imágenes      |
| `AWS_CDN_URL`           | URL pública del CDN     |

**notification-service (3005)** — correo saliente

| Variable      | Descripción                                      |
| ------------- | ------------------------------------------------ |
| `SMTP_HOST`   | Servidor SMTP                                    |
| `SMTP_PORT`   | `587`                                            |
| `SMTP_SECURE` | `false` con STARTTLS en 587, `true` en 465       |
| `SMTP_USER`   | Usuario                                          |
| `SMTP_PASS`   | Contraseña o clave de aplicación                 |
| `EMAIL_FROM`  | Remitente, p. ej. `BeautySpot <noreply@…>`       |
| `APP_URL`     | URL pública, usada en los enlaces de los correos |

**frontend (8080)**

| Variable                  | Descripción                                    |
| ------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | URL pública del gateway + `/api/v1`            |
| `NEXT_PUBLIC_IMAGE_HOSTS` | Hosts extra permitidos para optimizar imágenes |

> `apps/frontend/next.config.js` tiene un `rewrite` de `/api/:path*` a
> `http://localhost:3000`, pensado para desarrollo. En producción hay que apuntar
> `NEXT_PUBLIC_API_URL` al gateway real, o ajustar ese rewrite en el despliegue.

### Generar secretos

```bash
# JWT_SECRET, JWT_REFRESH_SECRET, INTERNAL_API_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Reglas: un valor distinto por secreto, nunca los del `.env.example`, y fuera del
control de versiones (los `.env` están en `.gitignore`; sólo se versiona `.env.example`).

---

## 5. Orden de arranque

Las dependencias importan:

1. **Postgres, Redis y RabbitMQ**, y esperar a que estén _healthy_.
2. **Migraciones** de cada servicio (ver bloqueante 2).
3. **Los 7 microservicios**. Se pueden arrancar en paralelo: se comunican por
   RabbitMQ y toleran que el destinatario no esté listo, porque los publicadores
   críticos usan el patrón Outbox.
4. **api-gateway**, que necesita poder resolver las URLs de los servicios.
5. **frontend**.

```bash
export VERSION=1.0.0
docker compose -f docker-compose.prod.yml up -d --wait
```

---

## 6. Reverse proxy y TLS

Sólo se exponen dos cosas a internet: el frontend y el gateway. Ejemplo con Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name beautyspot.co *.beautyspot.co;

    ssl_certificate     /etc/letsencrypt/live/beautyspot.co/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beautyspot.co/privkey.pem;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name beautyspot.co *.beautyspot.co;
    return 301 https://$host$request_uri;
}
```

**El certificado debe ser wildcard** (`*.beautyspot.co`): la resolución de tenant es
por subdominio, así que cada negocio tiene el suyo (`{slug}.beautyspot.co`).

El rate limiting del gateway se apoya en la IP del cliente, así que el proxy tiene
que enviar `X-Forwarded-For` correctamente o todas las peticiones parecerán venir
de la misma dirección.

---

## 7. Verificación posterior al despliegue

```bash
# Gateway y los 7 servicios
curl -s https://beautyspot.co/api/v1/../health | jq

# El gateway responde y enruta
curl -s https://beautyspot.co/api/v1/core/public/businesses | jq

# Login
curl -s -X POST https://beautyspot.co/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"..."}' | jq
```

Comprobaciones manuales:

- [ ] `GET /health` del gateway devuelve los 7 servicios en verde.
- [ ] Login y navegación por el dashboard.
- [ ] Un negocio publicado se ve en el marketplace público.
- [ ] Una reserva pública crea la cita y llega el correo de confirmación.
- [ ] La tabla `outbox_messages` de booking y payment no acumula filas en
      `PENDING` (si crecen, el relay no está publicando).
- [ ] El panel de RabbitMQ **no** es accesible desde internet.
- [ ] Postgres, Redis y RabbitMQ **no** son accesibles desde internet.

---

## 8. Operación

### Copias de seguridad

Hay 7 bases de datos: hay que respaldar **todas**.

```bash
for db in auth core booking payment notification marketplace analytics; do
  docker exec beautyspot-postgres pg_dump -U "$PGUSER" "beautyspot_$db" \
    | gzip > "backup_${db}_$(date +%Y%m%d).sql.gz"
done
```

Restauración de una:

```bash
gunzip -c backup_core_20260725.sql.gz \
  | docker exec -i beautyspot-postgres psql -U "$PGUSER" beautyspot_core
```

Consideraciones: los volúmenes de Redis y RabbitMQ no necesitan respaldo (Redis es
caché y sesiones, RabbitMQ es tránsito), pero **sí hay que vigilar que RabbitMQ no
acumule mensajes** en las colas de fallidos (DLQ).

### Actualización de versión

```bash
git pull origin main
export VERSION=1.1.0
# construir las 9 imágenes (sección 2)
# ejecutar migraciones pendientes
docker compose -f docker-compose.prod.yml up -d --wait
```

Los servicios son _stateless_: se pueden reemplazar de uno en uno. El único orden
que importa es que las migraciones se apliquen antes de arrancar la versión nueva.

### Logs

En producción el logging de TypeORM se limita a `error` y `warn`, y
`maxQueryExecutionTime` es de 1000 ms: las consultas más lentas aparecen en el log
como aviso, lo cual es la vía más rápida para detectar una consulta degradada.

```bash
docker compose -f docker-compose.prod.yml logs -f api-gateway
docker compose -f docker-compose.prod.yml logs --tail 100 core-service
```

### Ajustes que ya aplica el código en producción

Con `NODE_ENV=production`, `packages/database` cambia automáticamente:

| Ajuste              | Desarrollo         | Producción                                 |
| ------------------- | ------------------ | ------------------------------------------ |
| `synchronize`       | activado           | **desactivado**                            |
| SSL a Postgres      | desactivado        | activado (`rejectUnauthorized: false`)     |
| Pool de conexiones  | 10                 | 30 escritura / 50 lectura / 40 por defecto |
| `statement_timeout` | sin límite         | 30 s                                       |
| `query_timeout`     | sin límite         | 60 s                                       |
| Logging             | `query,error,warn` | `error,warn`                               |

> `rejectUnauthorized: false` acepta certificados de Postgres no verificados. Es
> lo habitual con bases gestionadas que usan CA propia, pero conviene revisarlo si
> el proveedor permite verificación completa.

---

## 9. Problemas frecuentes

**Un servicio arranca y muere al instante**
`DATABASE_URL no está configurado` es el error más común: `createTypeOrmModuleOptions`
lanza si falta la variable. Revisar el `env_file` del contenedor.

**El gateway devuelve 503 en todas las rutas de un servicio**
El circuit breaker se ha abierto por fallos repetidos. Comprobar el servicio destino
y su `{SERVICIO}_SERVICE_URL`: dentro de Docker debe ser el nombre del contenedor,
no `localhost`.

**El gateway devuelve 504**
El backend tardó más que `PROXY_TIMEOUT_MS`. Suele ser una consulta lenta; buscar el
aviso de `maxQueryExecutionTime` en el log del servicio.

**Todas las rutas de un servicio devuelven 404 a través del gateway**
Se está llamando con la forma `{servicio}-service`. Hay que usar el nombre corto
(`/api/v1/core/...`), no `/api/v1/core-service/...`. Explicado en
[docs/API.md](docs/API.md#url-base-y-enrutado-del-gateway).

**Los eventos no llegan entre servicios**
Revisar la tabla `outbox_messages` del emisor: si hay filas en `PENDING` con
`attempts` creciendo y `last_error` relleno, el problema es la conexión a RabbitMQ.
Si están en `DEAD`, agotaron los reintentos.

**El correo no sale**
`notification-service` necesita las `SMTP_*`. Con Gmail hace falta una contraseña
de aplicación, no la del usuario.

---

## Checklist de despliegue

Bloqueantes (secciones anteriores):

- [x] Migraciones iniciales creadas para core, marketplace, notification y analytics
- [x] `data-source.ts` y scripts `migration:*` en cada servicio con base de datos
- [ ] `docker-compose.prod.yml` (o manifiestos de Kubernetes) escrito
- [x] Endpoint `/health` en los 7 microservicios

Infraestructura:

- [x] Postgres 16 con las 7 bases y un usuario acotado por servicio (sin `SUPERUSER`)
- [ ] Las 7 contraseñas `BEAUTYSPOT_<SERVICIO>_PASSWORD` definidas en el entorno
- [ ] Redis 7 con contraseña
- [ ] RabbitMQ 3 con usuario propio y panel no expuesto
- [ ] Nada de infraestructura accesible desde internet

Configuración:

- [ ] `NODE_ENV=production` en los 9 contenedores
- [ ] Secretos generados de nuevo (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_SECRET`)
- [ ] `JWT_SECRET` idéntico en gateway y auth-service
- [ ] `INTERNAL_API_SECRET` idéntico en los 8 servicios
- [ ] `CORS_ORIGINS` con el dominio real
- [x] Variables de Redis unificadas en `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`
- [ ] `NEXT_PUBLIC_API_URL` apuntando al gateway público

Despliegue:

- [ ] Las 9 imágenes construidas desde la raíz del monorepo
- [ ] Migraciones aplicadas antes de arrancar
- [ ] Reverse proxy con certificado **wildcard** y `X-Forwarded-For`
- [ ] Verificaciones de la sección 7 completadas
- [ ] Copias de seguridad de las 7 bases programadas
