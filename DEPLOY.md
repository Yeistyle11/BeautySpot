# Despliegue de BeautySpot en producción

Guía de despliegue de la arquitectura actual: monorepo Turborepo con 8
microservicios NestJS, frontend Next.js 14, PostgreSQL 16, Redis 7 y RabbitMQ 3.

> Para el entorno de desarrollo local, ver [docs/SETUP.md](docs/SETUP.md).

---

## Esquema de base de datos

`synchronize` de TypeORM está deshabilitado cuando `NODE_ENV=production`
(`packages/database/src/config/typeorm.config.ts`: `synchronize: !isProduction && synchronize`):
en producción el esquema lo crea **exclusivamente** una migración. Los siete
servicios con base de datos tienen el suyo completo:

| Servicio               | Migraciones | Contenido                               |
| ---------------------- | ----------- | --------------------------------------- |
| `auth-service`         | 1           | Esquema completo, outbox incluido       |
| `core-service`         | 1           | Esquema completo (10 tablas)            |
| `marketplace-service`  | 1           | Esquema completo, outbox incluido       |
| `notification-service` | 1           | Esquema completo                        |
| `analytics-service`    | 1           | Esquema completo                        |
| `booking-service`      | 2           | Outbox + esquema                        |
| `payment-service`      | 3           | Esquema + outbox + índice único de caja |

Las migraciones reproducen literalmente lo que genera `synchronize`, incluidos
los nombres autogenerados de índices y constraints (`IDX_…`, `FK_…`, `UQ_…`,
`PK_…`). Esos nombres no se pueden inventar: si no coinciden, el ORM los toma
por objetos distintos y el esquema queda desincronizado aunque a la vista sea
idéntico.

Cada servicio tiene un `schema-migrations.int-test.ts` que levanta el esquema
desde cero **sólo con las migraciones** y comprueba que a `synchronize` no le
queda después ningún cambio pendiente. Es lo que impide que una migración se
desvíe de las entidades sin que nadie se entere hasta el despliegue: en
desarrollo y en los tests el esquema lo crea `synchronize`, así que un error en
el DDL no se nota antes.

### Ejecutar las migraciones

```bash
# aplicar las pendientes de un servicio
npm run migration:run --workspace @beautyspot/core-service

# generar una nueva tras cambiar entidades (necesita la BD viva)
npm run migration:generate --workspace @beautyspot/core-service -- src/migrations/NombreDescriptivo
```

**No se ejecutan al arrancar** (`migrationsRun: false`), y es deliberado: con
varias réplicas del mismo servicio todas competirían por migrar a la vez, y un
fallo de migración dejaría al servicio sin arrancar en lugar de fallar en un
paso de despliegue visible. Hay que lanzar `migration:run` de los siete
servicios **antes** de levantar los contenedores.

La lista de entidades de cada servicio vive en un único `src/orm-entities.ts`
que comparten `app.module.ts` y `data-source.ts`. No la dupliques: si las dos
divergen, `migration:generate` compara el esquema contra una lista incompleta y
propone borrar las tablas que le falten.

---

## Sesión y cookies

La credencial **no la ve el JavaScript de la página**: el gateway convierte los
tokens que emite `auth-service` en cookies `httpOnly` antes de que la respuesta
llegue al navegador, y los quita del cuerpo. Es lo que impide que un XSS se lleve
la sesión.

| Cookie       | Contenido                            | `httpOnly` | Ruta                   |
| ------------ | ------------------------------------ | ---------- | ---------------------- |
| `bs_access`  | Access token                         | Sí         | `/`                    |
| `bs_refresh` | Refresh token                        | Sí         | `/api/v1/auth/refresh` |
| `bs_session` | Rol, negocio y caducidad (sin token) | **No**     | `/`                    |

`bs_session` es legible a propósito: **no es una credencial**, sólo evita que la
interfaz tenga que adivinar con qué permisos entra el usuario. Quien decide es
siempre el backend, con el token de la cookie `httpOnly`.

El refresh se acota a su propia ruta para que no viaje en cada petición. El
frontend renueva sola la sesión al primer 401 y reintenta; varias peticiones que
caduquen a la vez comparten una única renovación, porque el refresh token rota y
si no las demás llegarían con uno ya consumido.

**Variables**: `COOKIE_DOMAIN` debe ser el dominio padre (`.beautyspot.co`)
porque el tenant va por subdominio y la sesión tiene que valer en todos.
`JWT_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN` deben coincidir con los de
`auth-service`: el gateway calcula con ellos la vida de cada cookie. `secure` se
activa solo con `NODE_ENV=production`, porque en `http://localhost` el navegador
descarta las cookies seguras.

### CSRF

Autenticar por cookie significa que el navegador la adjunta sola, así que hay dos
barreras: `SameSite=Lax`, que impide que se envíe en peticiones POST originadas
en otro sitio, y `CsrfOriginGuard`, que rechaza las mutaciones cuyo `Origin` no
esté en `CORS_ORIGINS`. El guard sólo actúa sobre peticiones autenticadas **por
cookie**: una con cabecera `Authorization` no la puede provocar un sitio ajeno.

`auth-service` sigue devolviendo tokens en el cuerpo y no sabe nada de cookies,
de modo que un cliente que no sea un navegador —una app móvil, una
integración— puede seguir usando `Authorization: Bearer`.

---

## Salud de los servicios

Los ocho servicios exponen `GET /health` y los nueve Dockerfile declaran
`HEALTHCHECK` contra él.

- Los 7 microservicios usan el `HealthModule` de `@beautyspot/nest-common`, que
  comprueba las dependencias que cada uno tenga —Postgres con un `SELECT 1`,
  Redis con un `PING`, RabbitMQ mirando si hay canal abierto— y responde **200
  si todas están arriba y 503 si alguna está caída**. El código de estado es lo
  único que miran las _readiness probes_: un 200 con `"unhealthy"` en el cuerpo
  dejaría al orquestador enviando tráfico a un servicio que no puede atender.
- El gateway expone además un health agregado, que consulta el `/health` de los
  siete y devuelve `healthy` o `degraded`.

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

`docker-compose.prod.yml` levanta los 12 contenedores: los 8 servicios, el
frontend, Postgres, Redis y RabbitMQ.

```bash
cp .env.prod.example .env                                   # secretos de infraestructura
for f in env/*.env.example; do cp "$f" "${f%.example}"; done # uno por contenedor
# rellenar todo lo que ponga CAMBIAR (ver env/README.md)

docker compose -f docker-compose.prod.yml up -d
```

Orden de arranque: **primero la infraestructura, después las migraciones y sólo
entonces los servicios.** Las migraciones no se aplican solas:

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis rabbitmq
for s in auth core booking payment notification marketplace analytics; do
  npm run migration:run --workspace "@beautyspot/$s-service"
done
docker compose -f docker-compose.prod.yml up -d
```

Puntos importantes:

- **Sólo el gateway y el frontend publican puertos**, y sólo en `127.0.0.1`:
  se espera un reverse proxy con TLS por delante. Postgres, Redis, RabbitMQ y los
  7 microservicios no son accesibles desde fuera del host.
- Dentro de la red de Docker las URLs entre servicios usan el nombre del
  contenedor (`http://auth-service:3001`), no `localhost`. La excepción es
  `NEXT_PUBLIC_API_URL`: la resuelve el navegador, así que es la URL pública.
- Los `depends_on` esperan a `service_healthy`, no a que el contenedor arranque.
  Por eso importa el `HEALTHCHECK` de los 9 Dockerfile: sin él, el gateway
  empezaría a proxear hacia servicios que todavía no han abierto su conexión a
  la base de datos.
- El panel de RabbitMQ (15672) **no se publica**.
- El CI valida en cada cambio que el fichero parsea y que no le falta ninguna
  variable, con `docker compose config`.

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

> El script sólo se ejecuta en el **primer arranque del volumen**. Sobre un
> volumen ya creado no tiene efecto: para aplicar un cambio hay que recrearlo
> con `docker volume rm beautyspot_postgres_data`.

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

> `REDIS_URL` no se lee en ninguna parte: si un servicio la define creyendo que
> basta con eso, se conecta al `localhost:6379` por defecto y sin contraseña, no
> al Redis configurado.

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
2. **Migraciones** de cada servicio (ver [Ejecutar las migraciones](#ejecutar-las-migraciones)).
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

Con `NODE_ENV=production` cada línea es un JSON con `nivel`, `hora`, `contexto`,
`mensaje` y **`requestId`**, listo para que un agregador lo indexe sin parsear
texto libre. En desarrollo el formato es el legible de Nest, con el
identificador abreviado como prefijo.

El `requestId` nace en el gateway, viaja a los backends en la cabecera
`x-request-id` y se devuelve al cliente en la respuesta. Es lo que permite
reconstruir una petición que atravesó cuatro servicios sin cruzar logs por marca
de tiempo; si un cliente reporta un fallo, ese identificador basta para
encontrarlo. Si la cabecera llega desde fuera se respeta, así que un balanceador
que ya asigne el suyo sigue funcionando.

```bash
docker compose -f docker-compose.prod.yml logs -f api-gateway

# todo lo que ocurrió en una petición concreta, en todos los servicios
docker compose -f docker-compose.prod.yml logs --no-log-prefix \
  | grep '"requestId":"<id>"'
```

El logging de TypeORM se limita a `error` y `warn`, y `maxQueryExecutionTime` es
de 1000 ms: las consultas más lentas aparecen como aviso, que es la vía más
rápida para detectar una consulta degradada.

> Lo que sigue faltando es traza distribuida y métricas. Con el `requestId` se
> puede reconstruir el recorrido de una petición a mano; no hay latencias por
> tramo ni percentiles.

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

Infraestructura:

- [ ] Postgres 16 con las 7 bases y un usuario acotado por servicio (sin `SUPERUSER`)
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
- [ ] `NEXT_PUBLIC_API_URL` apuntando al gateway público

Despliegue:

- [ ] Las 9 imágenes construidas desde la raíz del monorepo
- [ ] Migraciones aplicadas antes de arrancar
- [ ] Reverse proxy con certificado **wildcard** y `X-Forwarded-For`
- [ ] Verificaciones de la sección 7 completadas
- [ ] Copias de seguridad de las 7 bases programadas
