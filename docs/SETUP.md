# Puesta en marcha del entorno de desarrollo

Guía para tener BeautySpot corriendo en local: 8 microservicios NestJS, el frontend
Next.js y la infraestructura (PostgreSQL, Redis, RabbitMQ).

Para producción, ver [../DEPLOY.md](../DEPLOY.md).

## Requisitos

| Herramienta | Versión | Comprobar con      |
| ----------- | ------- | ------------------ |
| Node.js     | 20.x    | `node --version`   |
| npm         | 10.x    | `npm --version`    |
| Docker      | 24+     | `docker --version` |
| Git         | —       | `git --version`    |

Docker sólo se usa para la infraestructura; los servicios corren en el host con
Turborepo. Con 8 GB de RAM va sobrado.

## Instalación

```bash
git clone https://github.com/Yeistyle11/BeautySpot.git
cd BeautySpot

# El flag es OBLIGATORIO: sin él, la resolución de peers falla en el monorepo.
npm install --legacy-peer-deps
```

## Infraestructura

```bash
npm run docker:up
```

Levanta tres contenedores y, en el **primer arranque del volumen**, ejecuta
`infra/docker/postgres/init.sql`, que crea las 7 bases de datos y el rol
`beautyspot`:

| Servicio   | Puerto en el host | Credenciales                   |
| ---------- | ----------------- | ------------------------------ |
| PostgreSQL | **5433**          | `postgres` / `postgres`        |
| Redis      | 6379              | contraseña `redis123`          |
| RabbitMQ   | 5672 / 15672      | `beautyspot` / `beautyspot123` |

> Postgres se publica en **5433**, no en 5432, para no chocar con una instalación
> local. Todos los `.env.example` ya apuntan a 5433.

Panel de RabbitMQ: <http://localhost:15672>

Comprobar que los tres están arriba:

```bash
docker compose ps
```

## Variables de entorno

Cada servicio lee su propio `.env`. Los `.env.example` ya vienen alineados con el
compose, así que basta copiarlos:

```bash
for s in services/*/; do
  [ -f "$s.env.example" ] && cp -n "$s.env.example" "$s.env"
done
```

En PowerShell:

```powershell
Get-ChildItem services -Directory | ForEach-Object {
  $ex = Join-Path $_.FullName ".env.example"
  $dst = Join-Path $_.FullName ".env"
  if ((Test-Path $ex) -and -not (Test-Path $dst)) { Copy-Item $ex $dst }
}
```

No hay que editar nada para desarrollo local. Sólo si vas a probar
funcionalidades que dependen de servicios externos:

- **Correo** (`notification-service`): las `SMTP_*`. Con Gmail hace falta una
  contraseña de aplicación.
- **Imágenes** (`core-service`): las `AWS_*` para S3 y el CDN.

## Esquema de base de datos

No hay que ejecutar nada. En desarrollo TypeORM arranca con `synchronize`
activado y crea las tablas a partir de las entidades en el primer arranque de cada
servicio.

> Ojo: en producción `synchronize` está **desactivado** y el esquema lo crean las
> migraciones, que se aplican como paso explícito del despliegue. Si cambias una
> entidad, genera la migración correspondiente; ver [../DEPLOY.md](../DEPLOY.md).

## Arrancar

```bash
npm run dev
```

Turborepo levanta los 8 servicios y el frontend:

| Aplicación           | URL                     |
| -------------------- | ----------------------- |
| Frontend             | <http://localhost:8080> |
| API Gateway          | <http://localhost:3000> |
| auth-service         | 3001                    |
| core-service         | 3002                    |
| booking-service      | 3003                    |
| payment-service      | 3004                    |
| notification-service | 3005                    |
| marketplace-service  | 3006                    |
| analytics-service    | 3007                    |

Sólo el frontend:

```bash
cd apps/frontend && npm run dev
```

Comprobar que el gateway ve a todos los servicios:

```bash
curl http://localhost:3000/health
```

## Comandos habituales

```bash
# Calidad
npm run lint
npm run type-check
npm run format
npm run format:check

# Tests
npm test                 # los 960 tests unitarios
npm run test:coverage    # con cobertura y gate

# Infraestructura
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:restart
```

Para los tests de un solo servicio hay que entrar en su carpeta, porque los
proyectos de Jest no tienen `displayName` y `--selectProjects` no funciona desde la
raíz:

```bash
cd services/booking-service && npx jest appointments.service
cd services/booking-service && npx jest -t "nombre del test"
```

Detalle completo en [TESTING.md](TESTING.md).

## Problemas frecuentes

**`npm install` falla con conflictos de peer dependencies**
Falta `--legacy-peer-deps`.

**Un servicio no arranca: `DATABASE_URL no está configurado`**
Falta su `.env`. Copiarlo del `.env.example`.

**`ECONNREFUSED ::1:5433` o `127.0.0.1:5433`**
Postgres no está arriba (`npm run docker:up`) o el `.env` apunta a 5432 en vez de 5433.

**`port is already allocated` al levantar el compose**
Otro proceso usa 5433, 6379 o 5672. Localizarlo con `netstat -ano | findstr :6379`
(Windows) o `lsof -i :6379` (Linux/macOS).

**Las bases de datos no existen**
`init.sql` sólo se ejecuta en el primer arranque del volumen. Si el volumen ya
existía, hay que recrearlo:

```bash
npm run docker:down
docker volume rm beautyspot_postgres_data
npm run docker:up
```

**`npm run format` marca cientos de ficheros en Windows**
Prettier normaliza CRLF a LF. Esos ficheros están bien en CI (Linux). No hay que
commitear ese ruido: formatear sólo los ficheros que CI señale.

**Los tests de integración fallan con `ECONNREFUSED`**
Necesitan `docker-compose.test.yml`, que es distinto del de desarrollo. Ver
[TESTING.md](TESTING.md).
