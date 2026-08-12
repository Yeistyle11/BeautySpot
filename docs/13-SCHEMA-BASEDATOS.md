# Esquema SQL

Lo que hace falta para escribir SQL a mano contra las bases de BeautySpot: cómo
obtener el DDL de verdad, los tipos enumerados con su nombre exacto, y qué hay en
una base recién creada.

> **El DDL no se mantiene a mano en este documento.** Las migraciones de cada
> servicio (`services/*/src/migrations/`) **son** el SQL, y son ejecutables. Una
> copia escrita aquí sería una segunda fuente de verdad que nadie comprueba y que
> se separaría de la primera al siguiente cambio.
>
> Para la forma de cada tabla —columnas, tipos, nulabilidad, índices y por qué—,
> ver [05-BASE-DATOS.md](05-BASE-DATOS.md).

---

## Volcar el esquema real

Con la infraestructura de desarrollo levantada (`npm run docker:up`), el motor
está en el puerto **5433** del host y cada base tiene su propio usuario:

```bash
# El DDL completo de una base, sin datos
docker exec beautyspot-postgres \
  pg_dump -U beautyspot_core --schema-only beautyspot_core

# Sólo una tabla
docker exec beautyspot-postgres \
  pg_dump -U beautyspot_core --schema-only -t clients beautyspot_core

# Los índices de una tabla, ya formateados
docker exec beautyspot-postgres \
  psql -U beautyspot_booking -d beautyspot_booking -c '\d appointments'
```

Las siete bases son `beautyspot_auth`, `beautyspot_core`, `beautyspot_booking`,
`beautyspot_payment`, `beautyspot_notification`, `beautyspot_marketplace` y
`beautyspot_analytics`, y el usuario de cada una se llama igual que ella.

Otra vía, sin Postgres delante: `npm run migration:run` dentro de un servicio
aplica sus migraciones a la base que diga su `DATABASE_URL`, y el fichero de
migración se lee como el SQL que es.

---

## Tipos enumerados

Los enum los crea TypeORM y **el nombre lo deriva de la tabla y la columna**:
`{tabla}_{columna}_enum`. No son tipos compartidos con nombre propio, y hay uno
por base: `outbox_messages_status_enum` existe cinco veces, una en cada base que
lleva la tabla.

Es lo primero que sorprende al escribir un `INSERT` a mano, porque el `CAST` hay
que escribirlo con ese nombre:

```sql
INSERT INTO appointments (..., status) VALUES (..., 'CONFIRMED'::appointments_status_enum);
```

| Base             | Tipo                          | Valores                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth             | `memberships_role_enum`       | `SUPER_ADMIN`, `OWNER`, `ADMIN`, `PROFESSIONAL`, `RECEPTIONIST`, `CLIENT`                                                                                                                                                                      |
| booking          | `appointments_status_enum`    | `PENDING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`                                                                                                                                                                     |
| payment          | `payments_method_enum`        | `CASH`, `CARD`, `TRANSFER`, `OTHER`                                                                                                                                                                                                            |
| payment          | `payments_status_enum`        | `PENDING`, `COMPLETED`, `REFUNDED`, `CANCELLED`                                                                                                                                                                                                |
| payment          | `invoices_status_enum`        | `DRAFT`, `SENT`, `PAID`, `CANCELLED`                                                                                                                                                                                                           |
| payment          | `cash_movements_type_enum`    | `IN`, `OUT`                                                                                                                                                                                                                                    |
| notification     | `notifications_type_enum`     | `APPOINTMENT_CREATED`, `APPOINTMENT_CONFIRMED`, `APPOINTMENT_REMINDER`, `APPOINTMENT_CANCELLED`, `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_COMPLETED`, `PAYMENT_REGISTERED`, `REVIEW_RECEIVED`, `MEMBERSHIP_INVITATION`, `PROMOTION`, `BIRTHDAY` |
| notification     | `notifications_channel_enum`  | `IN_APP`, `EMAIL`, `PUSH`, `WHATSAPP`, `SMS`                                                                                                                                                                                                   |
| las 5 con outbox | `outbox_messages_status_enum` | `PENDING`, `PROCESSED`, `DEAD`                                                                                                                                                                                                                 |

`notifications_type_enum` arrancó con ocho valores y ha crecido con
`ALTER TYPE … ADD VALUE IF NOT EXISTS` en migraciones posteriores
(`TiposDeNotificacion`, `TipoCumpleanos`). Postgres no sabe quitar un valor de un
enum y borrar y recrear el tipo obligaría a reescribir la tabla, así que esas
migraciones **no revierten**: dejar un valor de más es inocuo.

De los canales, hoy sólo se emiten `IN_APP` y `EMAIL`. `PUSH`, `WHATSAPP` y `SMS`
están en el tipo sin implementación detrás.

### Los que no son enum de Postgres

Varias columnas que parecen enumerados son `varchar` a propósito, porque su lista
cambia más de lo que compensa una migración de tipo:

| Tabla             | Columna              | Valores                                                 |
| ----------------- | -------------------- | ------------------------------------------------------- |
| `reviews`         | `status`             | `PUBLICADA`, `OCULTA`                                   |
| `review_reports`  | `reason`             | `OFENSIVA`, `FALSA`, `SPAM`, `DATOS_PERSONALES`, `OTRO` |
| `campos_de_ficha` | `tipo`               | `texto`, `numero`, `fecha`, `si_no`, `opciones`         |
| `appointments`    | `cancel_reason_type` | Enum `CancelReason` de TypeScript                       |
| `cash_movements`  | `method`             | Los mismos que `payments_method_enum`, nullable         |

La validación de estas la hace el DTO en la frontera, no la base.

---

## Datos iniciales

El sistema arranca **en blanco**. No se cargan negocios, profesionales, servicios,
clientes ni citas de ejemplo: sólo se crean las siete bases vacías
(`infra/docker/postgres/init.sh`) y, en desarrollo, el esquema que genera
`synchronize` a partir de las entidades.

Los **roles no se siembran**: son un `enum` de TypeScript
(`packages/shared-types/src/auth.types.ts`), no filas de una tabla. El rol
efectivo de cada usuario vive en la columna `role` de `memberships`.

La primera cuenta se crea con el registro normal
(`POST /api/v1/auth/register`), que da de alta al usuario junto con su negocio y
le asigna el rol `OWNER`.

Lo único que se siembra solo viene después, por evento: al crear un profesional,
core publica `core.professional.created` y booking le genera una disponibilidad
de lunes a domingo de 09:00 a 18:00. El resto —servicios, horario de apertura,
perfil del marketplace— lo crea quien administra el negocio.

> **Pendiente**: no existe hoy ninguna cuenta de superadministrador ni forma de
> crearla. El rol `SUPER_ADMIN` está definido en el enum y se comprueba en los
> guards, pero no se puede asignar: `memberships` hereda de `TenantEntity`, así
> que `business_id` es `NOT NULL`, y el rol del JWT se deriva de la primera
> membresía activa. Un administrador de plataforma no pertenece a ningún negocio,
> de modo que asignarlo exigiría un cambio de modelo (una columna en `users`,
> hacer `business_id` nullable, o un negocio sentinela).

---

## Migraciones

Cada servicio gestiona las suyas, con los scripts de su propio `package.json`:

```bash
cd services/booking-service
npm run migration:generate -- src/migrations/NombreDeLaMigracion
npm run migration:run
npm run migration:revert
```

El nombre del fichero es `{timestamp}-{NombreEnPascalCase}.ts` y la clase que
exporta se llama `{NombreEnPascalCase}{timestamp}`; TypeORM ordena por ese
timestamp, así que **tiene que ser mayor que el de la última migración del
servicio** o no se aplicará.

Los timestamps de este proyecto no son fechas reales: van correlativos desde
`1700000000000`, uno por migración y servicio (`1700000000000-InitialSchema`,
`1700000000001-OutboxMessages`, …). Al añadir una, mirar cuál es la última de ese
servicio y sumar uno.

El resto —qué hace `synchronize`, por qué un cambio de entidad funciona en local
sin migración, y las dos reglas de los índices— está en
[05-BASE-DATOS.md](05-BASE-DATOS.md#13-migraciones).
