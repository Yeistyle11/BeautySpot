# Estrategia de tests

BeautySpot tiene dos niveles de test con propósitos distintos y mecánica distinta:
**unitarios** contra dependencias mockeadas, e **integración** contra
PostgreSQL, Redis y RabbitMQ reales.

## Resumen

|                   | Unitarios                         | Integración                           |
| ----------------- | --------------------------------- | ------------------------------------- |
| Patrón de fichero | `*.spec.ts`                       | `*.int-test.ts`                       |
| Config            | `jest.config.js` de cada proyecto | `jest.integration.config.js`          |
| Dependencias      | Mockeadas (BD, Redis, RabbitMQ)   | Reales, vía `docker-compose.test.yml` |
| Cuántos           | **1876 tests / 140 suites**       | 75 tests / 25 suites                  |
| En CI             | Job `test`                        | Job `integration`                     |
| Comando           | `npm test`                        | `npm run test:int` (por servicio)     |

Cobertura actual, medida sobre los unitarios:

| Métrica    | Actual  | Gate mínimo |
| ---------- | ------- | ----------- |
| Statements | 92,38 % | 92          |
| Branches   | 81,32 % | 80          |
| Functions  | 83,76 % | 80          |
| Lines      | 93,72 % | 93          |

El gate está en `coverageThreshold` de `jest.config.js` (raíz) y **falla el CI si
la cobertura baja**. Los valores están fijados un poco por debajo de la medición
real para que una variación de décimas no rompa el pipeline.

---

## Tests unitarios

### Ejecutar

```bash
npm test                 # los 13 proyectos de Jest
npm run test:watch
npm run test:coverage    # con cobertura y gate
```

La configuración de la raíz (`jest.config.js`) agrupa 13 proyectos: el frontend,
4 paquetes compartidos (`shared-utils`, `shared-constants`, `database`,
`nest-common`) y los 8 servicios.

### Ejecutar los de un solo servicio

Sólo `apps/frontend` declara `displayName` (`"frontend"`), así que desde la raíz
funciona `npx jest --selectProjects frontend` pero no hay equivalente para los
servicios ni para los paquetes. Para esos hay que entrar en la carpeta:

```bash
cd services/booking-service
npx jest appointments.service       # por nombre de fichero
npx jest -t "nombre del test"       # por nombre de test
npx jest --coverage --collectCoverageFrom="src/modules/proxy/*.ts"
```

### Convenciones

- Cada servicio tiene su `jest.config.js` con `preset: "ts-jest"` y un
  `moduleNameMapper` que resuelve `@beautyspot/*` a `packages/*/src`.
- `src/test/setup.ts` de cada servicio aplica los mocks comunes (BD, Redis,
  RabbitMQ) vía `setupFilesAfterEnv`.
- La regla `@typescript-eslint/no-explicit-any` es **error** en código de
  producción y está **desactivada en los ficheros de test**: los mocks usan `any`
  de forma legítima.

### Qué cubrir con un unitario

Lógica de negocio, ramas de decisión, validaciones, transformaciones y manejo de
errores. Todo lo que se pueda comprobar sin infraestructura.

### Un test que vigila una regla, no un comportamiento

`packages/database/src/entities/aislamiento-de-tenant.spec.ts` no prueba código:
lee el de los servicios. Recorre cada consulta sobre una tabla con `businessId` y
exige que el método la filtre por negocio, o que esté en su lista de excepciones
con el motivo escrito. El aislamiento entre negocios es lógico (ADR-002) y
TypeORM 0.3 no tiene filtros globales, así que sin esto una consulta nueva que se
olvide del filtro devuelve datos de otro negocio sin que nada falle.

Si al añadir una consulta el test se queja, hay dos salidas: filtrar por negocio
—casi siempre lo correcto— o, si de verdad es una consulta entre negocios (por
clave primaria con comprobación posterior, por columna única de la plataforma, o
una ruta interna), añadirla a `SIN_NEGOCIO_A_PROPOSITO` explicando por qué puede.

### Aviso: ramas inalcanzables

Al subir la cobertura de branches se encontraron **44 ramas imposibles de cubrir**:
`try/catch` que envolvían cuerpos que sólo desestructuraban y logueaban, con la
única línea capaz de lanzar (`logger.log(event.payload.X)`) **fuera** del `try`.

La solución correcta fue eliminar ese código muerto, no escribir tests imposibles.
Antes de invertir esfuerzo en una rama sin cubrir, comprobar si es alcanzable.

### Aviso: el segundo de `findBy*` se queda corto bajo cobertura

`findByText` y compañía esperan **1 segundo** por defecto. Basta para un test
suelto, pero `npm run test:coverage` corre los 13 proyectos instrumentados a la
vez, y ahí una aserción que dependa de un envío asíncrono puede no llegar. El
síntoma engaña: el test pasa en aislamiento, pasa con `--selectProjects` y solo
falla en la pasada completa.

Si una espera depende de una petición o de un ciclo de estado, dale margen
explícito en vez de confiar en el valor por defecto:

```ts
await screen.findByText(/…/, undefined, { timeout: 5000 });
```

---

## Tests de integración

Comprueban lo que un unitario **no puede**, porque sólo existe en la base de datos:
restricciones, índices, transacciones y condiciones de carrera.

### Ejecutar

Requieren infraestructura levantada, y es un compose **distinto** del de desarrollo:

```bash
docker compose -f docker-compose.test.yml up -d --wait

npm run test:int --workspace @beautyspot/payment-service

docker compose -f docker-compose.test.yml down -v
```

Los 8 servicios de una pasada (es lo que hace el CI):

```bash
for s in api-gateway auth-service core-service booking-service \
         payment-service notification-service marketplace-service analytics-service; do
  npm run test:int --workspace "@beautyspot/$s"
done
```

### Qué hay hoy

Los 8 servicios tienen el harness y un _smoke test_ de conexión:

- 7 servicios con base de datos: `db-connection.int-test.ts`.
- `api-gateway` no tiene base propia, así que el suyo es contra **Redis**
  (`redis-connection.int-test.ts`), del que depende para rate limiting, caché de
  tenants y sesiones revocadas.

Los 7 con base de datos tienen además `schema-migrations.int-test.ts`, que
levanta el esquema **sólo con las migraciones** sobre una base en blanco y exige
que `createSchemaBuilder().log()` no devuelva ninguna sentencia pendiente. Es lo
que impide que una entidad cambie sin su migración: en desarrollo `synchronize`
lo taparía y el fallo aparecería en producción. También es lo que obliga a
nombrar los índices igual en la entidad y en la migración.

Encima de eso hay suites que prueban una garantía concreta:

| Servicio  | Fichero                                 | Qué demuestra                                                             |
| --------- | --------------------------------------- | ------------------------------------------------------------------------- |
| payment   | `cash-session-single-open.int-test.ts`  | El índice único parcial impide dos cajas abiertas por negocio             |
| payment   | `outbox-atomicidad.int-test.ts`         | El cambio y su evento se confirman en la misma transacción                |
| payment   | `numeracion-facturas.int-test.ts`       | La serie por negocio no choca con la unicidad global del número           |
| payment   | `cobro-de-la-cita.int-test.ts`          | No se puede cobrar dos veces la misma cita, y las líneas llegan a disco   |
| payment   | `arqueo-de-caja.int-test.ts`            | El cierre Z desglosa por método pero sólo descuadra contra el efectivo    |
| payment   | `canje-de-puntos.int-test.ts`           | El descuento de puntos se confirma con el cobro o no ocurre               |
| booking   | `doble-reserva-concurrente.int-test.ts` | Dos reservas simultáneas de la misma franja no crean dos citas            |
| booking   | `cruce-de-medianoche.int-test.ts`       | La cita de anoche ocupa la madrugada, y el cierre de madrugada se reserva |
| core      | `cumpleanos.int-test.ts`                | La felicitación se emite una sola vez por año                             |
| analytics | `idempotencia-eventos.int-test.ts`      | Un evento repetido no vuelve a incrementar las métricas                   |

Todas comparten el mismo motivo: **los repositorios simulados devuelven lo que se
les pasó**, así que nada de lo de arriba —transacciones, índices, concurrencia,
que un dato llegue a disco— se puede observar con un unitario.

### Cómo escribir uno

```ts
import { DataSource } from "typeorm";

describe("Integración: ...", () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: "postgres",
      url: process.env.DATABASE_URL, // lo carga integration-setup.ts desde .env.test
      entities: [
        /* las entidades del servicio */
      ],
      synchronize: true, // crea el esquema desde las entidades
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  // La base es COMPARTIDA entre ficheros del mismo servicio: limpiar siempre.
  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "mi_tabla" CASCADE');
  });
});
```

Reglas que hay que respetar:

1. **`TRUNCATE` en `beforeEach`.** Todos los ficheros de un servicio comparten una
   sola base de datos.
2. **Nombrar el fichero `*.int-test.ts`.** El `testRegex` de los unitarios es
   `.spec.ts$`, así que un `.int-test.ts` no se cuela en `npm test` ni en la
   cobertura.
3. **Clientes que fallen rápido.** Un cliente que reintenta para siempre deja el
   proceso de Jest vivo. Con `ioredis` hace falta `lazyConnect`,
   `retryStrategy: () => null` y `enableOfflineQueue: false`; si no, el job de CI se
   colgaría hasta el límite de 6 horas en vez de fallar.
4. **Si importas de un paquete compartido, hay que compilarlo antes.** El
   `moduleNameMapper` resuelve `@beautyspot/*` a los fuentes sólo en ejecución;
   ts-jest también type-chequea, y los **tipos** se resuelven por
   `node_modules → dist/index.d.ts`. Sin `npm run build` de los paquetes, el test
   falla con `TS2307`.

### Configuración del harness

`jest.integration.config.js` hereda del `jest.config.js` del servicio y cambia:

| Opción               | Valor                           | Por qué                                                                                                                                                                             |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testRegex`          | `.*\.int-test\.ts$`             | Sólo los de integración                                                                                                                                                             |
| `setupFiles`         | `src/test/integration-setup.ts` | Carga `.env.test`, **sin** los mocks de los unitarios                                                                                                                               |
| `setupFilesAfterEnv` | `[]`                            | Anula el `setup.ts` que mockea la infraestructura                                                                                                                                   |
| `testTimeout`        | 30000                           | Las conexiones reales tardan más                                                                                                                                                    |
| `forceExit`          | `true`                          | Red de seguridad contra handles filtrados                                                                                                                                           |
| `maxWorkers`         | **1**                           | Obligatorio: en paralelo, dos ficheros con `synchronize` chocan creando el esquema (`duplicate key ... pg_type_typname_nsp_index`) y el `TRUNCATE` de uno borra las tablas del otro |
| `bail`               | **1**                           | Para al primer fichero que falle                                                                                                                                                    |

> `forceExit: true` puede estar tapando handles sin cerrar. Si en el log aparece
> _"Force exiting Jest"_, conviene investigarlo con `--detectOpenHandles`.

---

## Parar al primer fallo

Hay tres niveles, y los tres cortan:

| Nivel                              | Mecanismo                             |
| ---------------------------------- | ------------------------------------- |
| Ficheros dentro de un servicio     | `bail: 1` en el config de integración |
| Recorrido de los 8 servicios en CI | `set -e` en el paso del workflow      |
| Matriz de imágenes Docker          | `fail-fast: true`                     |

---

## Qué no está cubierto

Con honestidad, para que nadie asuma más de lo que hay:

- **No hay tests end-to-end.** Nada ejercita el flujo completo navegador → gateway →
  servicios → base de datos.
- **Los smoke tests de integración sólo comprueban la conexión.** Salvo las dos
  suites de payment-service, el resto no valida comportamiento.
- **No hay tests de contrato entre servicios.** Los 27 eventos de RabbitMQ se tipan
  con `@beautyspot/event-types`, pero nada verifica que emisor y receptor coincidan
  en tiempo de ejecución. Ya apareció un fallo de este tipo: dos listeners leían
  `event.payload.role` en `auth.user.registered`, campo que el emisor nunca envía.
- **No hay tests de carga ni de rendimiento.**

Los siguientes candidatos con más valor: solapes de citas y disponibilidad en
`booking-service`, y unicidad de email y membresías en `auth-service`.

---

## Ver también

- [CI-CD.md](CI-CD.md) — cómo se ejecuta todo esto en GitHub Actions
- [SETUP.md](SETUP.md) — entorno de desarrollo
