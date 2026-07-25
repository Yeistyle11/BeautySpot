# Docker en BeautySpot

Qué hay, para qué sirve cada cosa y cómo se usa.

## Los tres ficheros de Compose... son dos

| Fichero                   | Qué levanta                                       | Cuándo se usa                          |
| ------------------------- | ------------------------------------------------- | -------------------------------------- |
| `docker-compose.yml`      | Postgres 16, Redis 7, RabbitMQ 3 (**sólo infra**) | Desarrollo local (`npm run docker:up`) |
| `docker-compose.test.yml` | La misma infra en **otros puertos**               | Tests de integración                   |

**No existe un compose de producción.** Los Dockerfile están listos y el CI valida
que las 9 imágenes construyen, pero la orquestación de la aplicación completa está
pendiente; ver los bloqueantes de [../DEPLOY.md](../DEPLOY.md).

Ninguno de los dos compose levanta los microservicios: en desarrollo corren en el
host con `npm run dev`.

### Puertos: desarrollo vs test

Están deliberadamente separados para poder tener ambos entornos a la vez sin
pisarse:

| Servicio   | Desarrollo        | Test                |
| ---------- | ----------------- | ------------------- |
| PostgreSQL | 5433              | 5434                |
| Redis      | 6379 (`redis123`) | 6380 (`redis_test`) |
| RabbitMQ   | 5672 / 15672      | 5673 / 15673        |

Credenciales de Postgres: `postgres`/`postgres` en desarrollo y
`postgres`/`postgres_test` en test. RabbitMQ: `beautyspot`/`beautyspot123` y
`beautyspot_test`/`test123`.

## Infraestructura de desarrollo

```bash
npm run docker:up        # docker-compose up -d
npm run docker:down      # docker-compose down
npm run docker:logs      # docker-compose logs -f
npm run docker:restart   # docker-compose restart
```

En el **primer arranque del volumen** de Postgres se ejecuta
`infra/docker/postgres/init.sql`, que crea las 7 bases por servicio y el rol
`beautyspot`. Si el volumen ya existe, ese script **no** se vuelve a ejecutar: para
partir de cero hay que borrar el volumen.

```bash
npm run docker:down
docker volume rm beautyspot_postgres_data
npm run docker:up
```

Borrar los datos de todo (destructivo):

```bash
docker compose down -v
```

## Infraestructura de test

Los tests de integración (`*.int-test.ts`) corren contra infraestructura real:

```bash
docker compose -f docker-compose.test.yml up -d --wait
npm run test:int --workspace @beautyspot/payment-service
docker compose -f docker-compose.test.yml down -v
```

`--wait` bloquea hasta que los tres healthchecks pasan a _healthy_. Las bases de
test las crea `infra/docker/postgres/init-test.sql`. Ver [TESTING.md](TESTING.md).

## Imágenes de la aplicación

Hay 9 Dockerfile: uno por microservicio y uno para el frontend. Todos son
multi-stage sobre `node:20-alpine`.

**El contexto de build tiene que ser la raíz del monorepo**, siempre:

```bash
docker build -f services/auth-service/Dockerfile -t beautyspot-auth .
docker build -f apps/frontend/Dockerfile -t beautyspot-frontend .
```

Esto **no** funciona:

```bash
cd services/auth-service && docker build .   # ✗ no resuelve @beautyspot/*
```

La razón: los servicios dependen de los paquetes compartidos del workspace
(`@beautyspot/shared-types`, `nest-common`, etc.). Con el contexto en la carpeta del
servicio, `npm install` no los ve. Cada Dockerfile copia el repo entero y construye
con `npx turbo run build --filter=@beautyspot/<paquete>`, que arrastra las
dependencias del grafo.

### Consecuencia práctica del `COPY . .`

Los Dockerfile copian todo el repositorio antes de instalar, así que **cualquier
fichero modificado invalida la caché de todas las imágenes**. Es lo que hace que en
CI un cambio en `services/**` fuerce un rebuild completo (~3 min por imagen),
mientras que un cambio que sólo toca `.github/` cachee al 100% (~0,3 min): `.github`
está en `.dockerignore`, así que el contexto de build no cambia.

`.dockerignore` excluye `node_modules`, `dist`, `.next`, `coverage`, `.git`,
`.github`, logs y los `.env` (salvo los `.env.example`).

## Comandos útiles

```bash
# Conectarse a una base de datos
docker exec -it beautyspot-postgres psql -U postgres -d beautyspot_core

# Listar las bases creadas
docker exec beautyspot-postgres psql -U postgres -c "\l" | grep beautyspot

# Redis (requiere contraseña)
docker exec -it beautyspot-redis redis-cli -a redis123

# Colas de RabbitMQ
docker exec beautyspot-rabbitmq rabbitmqctl list_queues

# Estado de salud de los contenedores
docker compose ps
```

Dentro de `psql`: `\dt` lista tablas, `\d users` describe una, `\q` sale.

## Problemas frecuentes

**`port is already allocated`**
Otro proceso ocupa 5433, 6379 o 5672. Localizarlo:

```powershell
netstat -ano | findstr :5433     # Windows
```

```bash
lsof -i :5433                     # Linux/macOS
```

**Las bases de datos no existen aunque el contenedor está arriba**
`init.sql` sólo corre en el primer arranque del volumen. Recrear el volumen (arriba).

**Un healthcheck no pasa a _healthy_**
El de Redis necesita autenticarse porque el servidor arranca con `--requirepass`:
el comando correcto es `redis-cli -a <clave> --no-auth-warning ping`. Sin `-a`
devuelve `NOAUTH` y el contenedor nunca se marca como saludable.

**Docker Desktop no arranca (Windows)**
Comprobar que WSL 2 está instalado y que la virtualización está habilitada en BIOS.

**El build del frontend falla con `Cannot find module '@beautyspot/...'`**
Falta declarar esa dependencia en `apps/frontend/package.json`. Turbo deriva el
grafo de build del `package.json`, así que una dependencia usada pero no declarada
queda fuera del `--filter` y su `dist` no se construye.
