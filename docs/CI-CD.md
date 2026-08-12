# Integración continua

Un único workflow: `.github/workflows/tests.yml`, con nombre **CI**.

## Cuándo se ejecuta

| Evento              | Detalle                                                 |
| ------------------- | ------------------------------------------------------- |
| `push`              | Sólo a `main`                                           |
| `pull_request`      | `opened`, `synchronize`, `reopened`, `ready_for_review` |
| `workflow_dispatch` | Manual                                                  |

### Cancelación de runs obsoletos

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Un push nuevo a un PR cancela el run anterior. En `main` **no** se cancela, para que
cada commit de la rama principal conserve su propio run concluido.

## Los jobs

| Job            | Depende de           | Qué hace                                                 |
| -------------- | -------------------- | -------------------------------------------------------- |
| `quality`      | —                    | `format:check`, `build`, `lint`, `type-check`            |
| `test`         | —                    | 1870 tests unitarios con cobertura y gate                |
| `integration`  | —                    | Los `*.int-test.ts` de los 8 servicios contra infra real |
| `changes`      | —                    | Calcula qué imágenes Docker hay que construir            |
| `docker-build` | `quality`, `changes` | Construye las imágenes de la matriz                      |
| `ci`           | todos                | **Check agregado**                                       |

### `quality`

Node 20, `npm install --legacy-peer-deps`, y después Prettier, build de turbo, ESLint
y TypeScript. Es el job que bloquea `docker-build`: si el código no compila, no tiene
sentido construir imágenes.

### `test`

Levanta Postgres, Redis y RabbitMQ como _service containers_ (puertos 5434/6380/5673),
crea las bases con `init-test.sql`, compila los paquetes compartidos y ejecuta
`npm run test:coverage`. Sube el informe a Codecov (`fail_ci_if_error: false`, así
que un fallo de Codecov no rompe el CI).

`TZ: America/Bogota`, para que las pruebas con fechas se comporten como en el
entorno objetivo.

### `integration`

Levanta la infraestructura con **el propio `docker-compose.test.yml`** en lugar de
bloques `services:`, para no duplicar puertos y credenciales que ya viven en los
`.env.test`. Con `services:` además no se puede pasar `--requirepass` a Redis,
porque no admiten sobrescribir el `command`.

```yaml
- run: docker compose -f docker-compose.test.yml up -d --wait
```

`--wait` bloquea hasta que los tres healthchecks pasan a _healthy_. Luego recorre los
8 servicios con `set -euo pipefail`, así que **para en el primero que falle**. Si algo
va mal, un paso `if: failure()` volca los últimos 50 renglones de log de la
infraestructura; un `if: always()` hace `down -v`.

> Este job compila los paquetes compartidos antes de los tests. Es imprescindible:
> ts-jest type-chequea los `*.int-test.ts` y los tipos de `@beautyspot/*` se
> resuelven por `node_modules → dist/index.d.ts`. Sin ese paso, cualquier test que
> importe de un paquete compartido falla con `TS2307`.

### `changes` y la matriz de `docker-build`

Construir las 9 imágenes en cada run cuesta ~31 de los ~38 minutos facturables del
workflow. Como un cambio típico toca uno o dos servicios, el job `changes` calcula
la matriz mínima con `git diff` y la expone como JSON:

```yaml
matrix:
  image: ${{ fromJSON(needs.changes.outputs.images) }}
```

Si no hay nada que construir, `docker-build` se omite entero
(`if: needs.changes.outputs.images != '[]'`).

Se usa `git diff` en vez de una action de terceros para no añadir dependencias al
pipeline —y porque `dorny/paths-filter` corre sobre Node 20, justo lo que se quitó
del workflow.

**Cambios que fuerzan las 9 imágenes**, porque los builds parten de la raíz del
monorepo: `package.json`, `package-lock.json`, `turbo.json`, `tsconfig.base.json`,
`.dockerignore`, cualquier cosa en `packages/` y el propio workflow.

Sin base de comparación fiable (`workflow_dispatch`, rama nueva) se construye todo,
que es el lado seguro.

Comportamiento verificado:

| Cambio                               | Imágenes            |
| ------------------------------------ | ------------------- |
| Sólo documentación                   | **0** → job omitido |
| Sólo el Dockerfile del frontend      | 1                   |
| 4 servicios + `jest.config.js`       | 4                   |
| Lockfile, `packages/*` o el workflow | 9                   |

La matriz usa `fail-fast: false`: cada imagen se construye hasta el final aunque
otra falle, de modo que un run da el diagnóstico completo. Cancelar a la primera
ahorra minutos cuando el fallo es del contexto compartido y afecta a todas por
igual, pero no permite distinguir ese caso de uno con varias imágenes rotas por
motivos distintos, y convierte un fallo transitorio del registro en la
cancelación de builds sin relación.

### `ci` — el check agregado

```yaml
needs: [quality, test, integration, changes, docker-build]
if: always()
```

Lee `toJSON(needs)` y falla si algún job quedó en `failure` o `cancelled`. Un job
**omitido cuenta como correcto**, que es la clave: `docker-build` se omite
legítimamente cuando no hay imágenes que construir.

> **Éste es el único job que se debe marcar como _required check_** en la protección
> de rama. Los nombres de los jobs de `docker-build` salen de una matriz dinámica y
> el job entero desaparece en algunos runs, así que exigirlos por nombre dejaría el
> check ausente y bloquearía el merge indefinidamente.

## Estado de la protección de rama

Ahora mismo `main` está protegida **sin checks requeridos**:

| Activo                      | No activo          |
| --------------------------- | ------------------ |
| Force-push bloqueado        | Checks requeridos  |
| Borrado de `main` bloqueado | Reviews requeridas |
|                             | `enforce_admins`   |

El check requerido se retiró porque bloqueaba los merges del propio owner: con
checks requeridos el PR queda en `mergeable_state: blocked` y hay que usar el
_bypass_ a mano en cada merge. Con esto, el job `ci` existe y es informativo, pero
**no actúa como puerta**. Para volver a exigirlo:

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -d '{"required_status_checks":{"strict":false,"contexts":["ci"]},
       "enforce_admins":false,"required_pull_request_reviews":null,"restrictions":null}' \
  https://api.github.com/repos/Yeistyle11/BeautySpot/branches/main/protection
```

## Coste

El repositorio es **público**, así que los minutos en runners estándar son gratuitos
e ilimitados. Lo que sigue importa para cuando pase a privado.

Un run completo cuesta **~38 minutos facturables** (GitHub redondea **cada job** al
minuto, así que 11 jobs pagan unos 3 minutos de aire). De esos 38, unos 31 son los
`docker-build`.

| Plan       | Minutos/mes | Runs que caben |
| ---------- | ----------- | -------------- |
| Free       | 2.000       | ~52            |
| Pro / Team | 3.000       | ~78            |

Y un run no equivale a un PR: el workflow dispara en `pull_request` **y** en `push` a
`main`, así que un PR con 4 iteraciones más el merge son 5 runs ≈ 190 minutos.
Pasado el límite se cobra a **$0,008/min** en Linux.

Detalles que conviene tener presentes:

- **Los _larger runners_ se facturan incluso en repos públicos.** El workflow usa
  `ubuntu-latest` en todos los jobs. No migrar a `ubuntu-latest-4-cores` sin mirar
  la factura.
- Los _service containers_ (Postgres, Redis, RabbitMQ) no se facturan aparte.
- La caché de buildx (`type=gha`, `mode=max`) tiene un límite de 10 GB por repo con
  desalojo LRU.
- Un PR que sólo toca `.github/` cachea al 100 % (`.github` está en `.dockerignore`,
  así que el contexto de build no cambia) y los 9 builds bajan a ~0,3 min. Uno que
  toca `services/**` invalida el `COPY . .` y fuerza rebuild completo, ~3 min por
  imagen.

## Versiones de las actions

Todas fuera de Node 20, que GitHub está retirando de los runners:

| Action                       | Versión | Runtime              |
| ---------------------------- | ------- | -------------------- |
| `actions/checkout`           | v5      | node24               |
| `actions/setup-node`         | v5      | node24               |
| `codecov/codecov-action`     | v7      | composite (sin Node) |
| `docker/setup-buildx-action` | v4      | node24               |
| `docker/build-push-action`   | v7      | node24               |

Para comprobar el runtime de una action sin instalar nada:

```bash
curl -s https://raw.githubusercontent.com/<repo>/<tag>/action.yml | grep -A4 '^runs:'
```

## Lo que el CI no hace

- **No despliega.** No hay job de deploy ni registro de imágenes: `docker-build`
  sólo valida que los Dockerfile construyen (`push: false`), no publica nada.
- **No despliega migraciones.** Sí las ejecuta en el job `integration`: cada
  servicio tiene un `schema-migrations.int-test.ts` que crea el esquema desde
  cero con `migration:run` y comprueba que coincide con las entidades. Lo que no
  hace el CI es aplicarlas a ningún entorno.
- **No hay escaneo de seguridad** de dependencias ni de imágenes.
- **No hay tests end-to-end.**

## Ver también

- [TESTING.md](TESTING.md) — qué se ejecuta en cada job
- [../DEPLOY.md](../DEPLOY.md) — despliegue, hoy manual
