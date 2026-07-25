# Despliegue de BeautySpot en producción

Guía de despliegue de la arquitectura actual: monorepo Turborepo con 8
microservicios NestJS, frontend Next.js 14, PostgreSQL 16, Redis 7 y RabbitMQ 3.

> Para el entorno de desarrollo local, ver [docs/SETUP.md](docs/SETUP.md).

---

## ⛔ Bloqueantes antes del primer despliegue

Estos puntos **no son opcionales**: con el código tal como está hoy, un despliegue
a producción no funcionaría. Están listados primero a propósito.

### 1. Faltan las migraciones de 4 servicios

`synchronize` de TypeORM está deshabilitado cuando `NODE_ENV=production`
(`packages/database/src/config/typeorm.config.ts`: `synchronize: !isProduction && synchronize`).
Eso es correcto —no se quiere que el ORM altere el esquema en producción—, pero
significa que **el esquema tiene que crearlo una migración**. El estado actual:

| Servicio               | Entidades | Migraciones | Estado                        |
| ---------------------- | --------- | ----------- | ----------------------------- |
| `auth-service`         | 4         | 3           | Cubierto                      |
| `booking-service`      | 4         | 1           | Sólo la tabla del outbox      |
| `payment-service`      | 5         | 2           | Outbox + índice de caja       |
| `core-service`         | **10**    | **0**       | **Sin esquema en producción** |
| `marketplace-service`  | 4         | **0**       | **Sin esquema en producción** |
| `notification-service` | 2         | **0**       | **Sin esquema en producción** |
| `analytics-service`    | 2         | **0**       | **Sin esquema en producción** |

En desarrollo no se nota porque `synchronize` crea las tablas a partir de las
entidades. En producción esos cuatro servicios arrancarían contra una base vacía y
fallaría cualquier consulta.

### 2. No hay forma de ejecutar las migraciones

Aunque existen 6 ficheros de migración, hoy no se pueden aplicar:

- La configuración de TypeORM **no declara `migrations` ni `migrationsRun`**, así
  que el ORM no conoce esos ficheros.
- No existe ningún `data-source.ts` para la CLI de TypeORM.
- Ningún `package.json` tiene scripts de tipo `migration:run` / `migration:generate`.

**Qué hace falta** (por servicio con base de datos):

1. Un `src/data-source.ts` que exporte un `DataSource` con `entities` y
   `migrations: ["dist/migrations/*.js"]`.
2. Scripts en su `package.json`:
   ```json
   "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/data-source.ts",
   "migration:run": "typeorm-ts-node-commonjs migration:run -d src/data-source.ts",
   "migration:revert": "typeorm-ts-node-commonjs migration:revert -d src/data-source.ts"
   ```
3. Generar la migración inicial de los 4 servicios que no la tienen, partiendo del
   esquema que `synchronize` produce hoy en desarrollo.
4. Un paso de despliegue que ejecute `migration:run` **antes** de arrancar cada
   servicio.

### 3. No hay artefacto de orquestación para producción

El repositorio contiene:

- `docker-compose.yml` — **sólo infraestructura de desarrollo** (Postgres, Redis,
  RabbitMQ). No levanta los servicios.
- `docker-compose.test.yml` — infraestructura para los tests de integración.
- Un `Dockerfile` por servicio y otro para el frontend (9 en total), validados en CI.

Falta un `docker-compose.prod.yml` (o manifiestos de Kubernetes) que orqueste los
9 contenedores más la infraestructura. La sección
[Orquestación](#3-orquestación-de-la-aplicación) propone uno.

### 4. Los microservicios no tienen healthcheck

Sólo el API Gateway expone `GET /health` (y comprueba los 7 servicios). Los
servicios en sí no tienen endpoint de salud, así que un orquestador no puede saber
si están listos. Conviene añadir un `/health` a cada uno antes de depender de
reinicios automáticos o de _readiness probes_.

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

### Aviso sobre `init.sql`

`infra/docker/postgres/init.sql` está pensado para desarrollo y **no es apto para
producción tal cual**:

```sql
CREATE USER beautyspot WITH PASSWORD 'beautyspot' SUPERUSER;
```

Crea un superusuario con contraseña conocida, y además una base y un usuario para
SonarQube (`sonar` / `sonar123`) que no tienen por qué existir en el servidor de
producción. Para producción hay que crear las 7 bases y **un usuario por servicio
con permisos acotados a su propia base**, sin `SUPERUSER`.

Las 7 bases son: `beautyspot_auth`, `beautyspot_core`, `beautyspot_booking`,
`beautyspot_payment`, `beautyspot_notification`, `beautyspot_marketplace` y
`beautyspot_analytics`. El `api-gateway` no tiene base de datos propia.

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

> **Inconsistencia a corregir**: no todos los servicios leen Redis igual. `auth`,
> `core`, `booking`, `notification` y el gateway usan `REDIS_HOST` + `REDIS_PORT`
> (+ `REDIS_PASSWORD`), mientras que `analytics`, `marketplace` y `payment` usan
> `REDIS_URL`. Hay que definir ambas o unificarlas antes de desplegar.
>
> Lo mismo con el usuario de base de datos en los `.env.example`: unos usan
> `postgres:postgres` y otros `beautyspot:beautyspot`.

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

- [ ] Migraciones iniciales creadas para core, marketplace, notification y analytics
- [ ] `data-source.ts` y scripts `migration:*` en cada servicio con base de datos
- [ ] `docker-compose.prod.yml` (o manifiestos de Kubernetes) escrito
- [ ] Endpoint `/health` en los 7 microservicios

Infraestructura:

- [ ] Postgres 16 con las 7 bases y un usuario acotado por servicio (sin `SUPERUSER`)
- [ ] Redis 7 con contraseña
- [ ] RabbitMQ 3 con usuario propio y panel no expuesto
- [ ] Nada de infraestructura accesible desde internet

Configuración:

- [ ] `NODE_ENV=production` en los 9 contenedores
- [ ] Secretos generados de nuevo (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_SECRET`)
- [ ] `JWT_SECRET` idéntico en gateway y auth-service
- [ ] `INTERNAL_API_SECRET` idéntico en los 8 servicios
- [ ] `CORS_ORIGINS` con el dominio real
- [ ] Variables de Redis presentes en la forma que espera cada servicio (`REDIS_URL` vs `REDIS_HOST`)
- [ ] `NEXT_PUBLIC_API_URL` apuntando al gateway público

Despliegue:

- [ ] Las 9 imágenes construidas desde la raíz del monorepo
- [ ] Migraciones aplicadas antes de arrancar
- [ ] Reverse proxy con certificado **wildcard** y `X-Forwarded-For`
- [ ] Verificaciones de la sección 7 completadas
- [ ] Copias de seguridad de las 7 bases programadas
