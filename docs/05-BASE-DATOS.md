# Base de datos

Las **47 tablas** de BeautySpot, repartidas en siete bases de datos —una por
servicio con estado—, tal y como están definidas hoy en las entidades y las
migraciones. Son 47 contando la copia de `outbox_messages` y `processed_events`
que cada base lleva por su cuenta; formas distintas de tabla hay 40.

## Cómo leer este documento

La fuente de verdad son `services/*/src/entities/` y `services/*/src/migrations/`.
Este documento se escribe a partir de ellas y **si lo contradicen, el error es de
aquí**. Que entidades y migraciones digan lo mismo no depende de la buena fe: cada
servicio tiene un `schema-migrations.int-test.ts` que levanta la base en blanco
sólo con las migraciones y exige que TypeORM no encuentre ninguna sentencia
pendiente frente a las entidades.

Los tipos de la columna «Tipo» son los de Postgres. Donde pone `decimal(10,2)`,
la entidad además aplica `numericTransformer`, que lo convierte a `number` en
TypeScript: el driver de Postgres devuelve los `numeric` como cadena y sin eso
`total + 1` concatenaría en vez de sumar.

---

## 1. Un motor, siete bases

Todas las bases viven en **una sola instancia de PostgreSQL 16**, con un usuario
por servicio que es propietario únicamente de la suya, sin `SUPERUSER` y con el
`CONNECT` revocado a `PUBLIC` (`infra/docker/postgres/init.sh`). Un servicio
comprometido no alcanza los datos de los otros seis.

| Base                      | Servicio     | Tablas |
| ------------------------- | ------------ | ------ |
| `beautyspot_auth`         | auth         | 6      |
| `beautyspot_core`         | core         | 13     |
| `beautyspot_booking`      | booking      | 6      |
| `beautyspot_payment`      | payment      | 7      |
| `beautyspot_notification` | notification | 3      |
| `beautyspot_marketplace`  | marketplace  | 6      |
| `beautyspot_analytics`    | analytics    | 6      |

En desarrollo el motor se publica en el host en el puerto **5433** (no 5432, para
no chocar con un Postgres local) y en los tests de integración en el **5434**
(`docker-compose.test.yml`). Las siete bases se crean solas en el primer arranque
del volumen.

**Ningún servicio consulta la base de otro.** Lo que necesita de fuera lo pide por
las rutas `internal/*` o lo recibe por evento. Por eso hay columnas como
`appointments.client_id` que apuntan a una fila de otra base y **no tienen clave
ajena**: la integridad referencial acaba en el borde del servicio.

---

## 2. Convenciones

### 2.1 Las tres clases base

Casi ninguna entidad declara `id` ni las marcas de tiempo: las hereda de
`packages/database/src/entities/`.

| Clase             | Añade                                    | Cuándo se usa                         |
| ----------------- | ---------------------------------------- | ------------------------------------- |
| `BaseEntity`      | `id`, `created_at`, `updated_at`         | Tablas globales o hijas de otra tabla |
| `TenantEntity`    | lo anterior + `business_id` **indexado** | Todo lo que pertenece a un negocio    |
| `AuditableEntity` | lo anterior + `created_by`, `updated_by` | Sólo `appointments`                   |

- **`id`**: `uuid`, clave primaria. **Lo genera la aplicación** en un
  `@BeforeInsert`, no la base: no hay `DEFAULT uuid_generate_v4()` ni extensión
  que instalar.
- **`created_at` / `updated_at`**: `timestamptz`, nunca `timestamp`. Una columna
  sin huso guarda la hora de pared de quien escribe —Postgres en UTC para los
  valores por defecto, Node en su hora local para el resto— y quien lee después
  no puede saber cuál de las dos era.

### 2.2 Nombres

Tablas en `snake_case` y plural (`business_hours`, `blocked_slots`), columnas en
`snake_case`. Las propiedades de la entidad van en `camelCase` y el mapeo es
explícito (`@Column({ name: "start_time" })`).

Explícito porque **no hay `namingStrategy` configurada**: TypeORM no convierte
nada, así que una columna sin `name:` se crea tal cual está escrita la propiedad.
Tres se quedaron así y siguen en `camelCase` en la base —cambiarlas ahora pide una
migración de renombrado sin ganancia—: `businesses.businessType`,
`businesses.planId` y `appointments.totalAmount`. Al escribir SQL a mano hay que
entrecomillarlas. Ojo con la primera: en `business_profiles` la equivalente sí es
`business_type`.

### 2.3 No hay borrado lógico

**No existe `deleted_at` en ninguna tabla.** Dar de baja es poner `active` a
`false`, que es lo que hace el CRUD compartido (`TenantCrudService`). La única
excepción con semántica propia es `clients.anonymized_at`: no es una baja, es el
derecho de supresión ejercido —la fila se conserva vaciada porque sus citas y sus
facturas tienen que seguir cuadrando—.

### 2.4 Horas de pared

Las citas, los horarios y los bloqueos **no guardan instantes**. Guardan `date`
(`date`) y `start_time` / `end_time` (`varchar` `HH:MM`), que son hora de pared
del local: una cita de las 10:00 son las 10:00 allí, viva donde viva el servidor.
El huso del negocio (`businesses.timezone`) es lo que convierte eso en un instante
cuando hace falta.

La hora se cuenta desde la medianoche de **su** día y puede pasar de `24:00`: un
salón que cierra a las 2 de la mañana lo expresa como `26:00`, y una cita de
23:30 a las `24:30` invade la madrugada del día siguiente.

---

## 3. Tablas compartidas

Dos tablas no pertenecen a ningún dominio: las aporta `packages/nest-common` y
cada servicio que las usa las incluye en su propio esquema.

### `outbox_messages` — auth, core, booking, marketplace, payment

Evento persistido en la misma transacción que el cambio de negocio, a la espera de
que `OutboxRelayWorker` lo publique en RabbitMQ. Así nunca hay un cambio sin
evento ni un evento sin cambio.

| Columna          | Tipo                        | Nulo | Descripción                                 |
| ---------------- | --------------------------- | ---- | ------------------------------------------- |
| `id`             | uuid PK                     | no   |                                             |
| `aggregate_type` | varchar(100)                | no   | Entidad de origen (`appointment`…)          |
| `aggregate_id`   | varchar(100)                | no   | Su identificador                            |
| `event_type`     | varchar(200)                | no   | Routing key (`booking.appointment.created`) |
| `payload`        | jsonb                       | no   | Cuerpo del evento                           |
| `status`         | enum PENDING/PROCESSED/DEAD | no   | `PENDING` al nacer                          |
| `attempts`       | int                         | no   | Intentos de publicación                     |
| `last_error`     | text                        | sí   | Último fallo                                |
| `created_at`     | timestamptz                 | no   |                                             |
| `processed_at`   | timestamptz                 | sí   | Cuando se publicó                           |

Índice `idx_outbox_messages_status_created_at (status, created_at)`: es
exactamente la consulta del relay.

### `processed_events` — core, booking, notification, analytics

Marca de que un handler ya aplicó un evento, para que reintentar la entrega no
duplique el efecto. La clave primaria es **compuesta**, `(event_id, handler)`:
cada handler decide por su cuenta, así que el mismo evento puede estar aplicado
por uno y pendiente por otro.

| Columna        | Tipo            | Nulo | Descripción          |
| -------------- | --------------- | ---- | -------------------- |
| `event_id`     | uuid PK         | no   | `eventId` del evento |
| `handler`      | varchar(200) PK | no   | Quién lo aplicó      |
| `event_type`   | varchar(200)    | no   | Para poder auditar   |
| `processed_at` | timestamptz     | no   |                      |

---

## 4. auth-service — `beautyspot_auth`

### `users`

Cuenta de la plataforma. Es global: **no lleva `business_id`**, porque un usuario
puede trabajar en varios negocios y un cliente final no pertenece a ninguno.

| Columna                 | Tipo        | Nulo | Descripción                                        |
| ----------------------- | ----------- | ---- | -------------------------------------------------- |
| `email`                 | varchar UQ  | no   |                                                    |
| `password`              | varchar     | no   | Hash bcrypt; nunca se serializa (`@Exclude`)       |
| `name`                  | varchar     | no   | Nombre completo, en un solo campo                  |
| `phone`, `avatar`       | varchar     | sí   |                                                    |
| `email_verified`        | boolean     | no   | `false` al registrarse                             |
| `active`                | boolean     | no   |                                                    |
| `current_business_id`   | uuid        | sí   | Negocio con el que trabaja ahora                   |
| `token_version`         | int         | no   | Al subir, invalida los JWT ya emitidos             |
| `failed_login_attempts` | int         | no   | Vuelve a cero al entrar bien                       |
| `locked_until`          | timestamptz | sí   | Hasta cuándo no se admiten intentos                |
| `lockout_count`         | int         | no   | Bloqueos encadenados; cada uno alarga el siguiente |

`token_version` vive también en Redis (`TokenVersionStore`), que es lo que
consultan los servicios: la columna es el respaldo duradero.

### `memberships`

Vínculo usuario–negocio con su rol. `TenantEntity`, y **único por
`(user_id, business_id)`**.

| Columna       | Tipo        | Nulo | Descripción                |
| ------------- | ----------- | ---- | -------------------------- |
| `user_id`     | uuid        | no   | FK a `users`               |
| `business_id` | uuid        | no   | Heredada de `TenantEntity` |
| `role`        | enum `Role` | no   | `CLIENT` por defecto       |
| `active`      | boolean     | no   |                            |
| `invited_by`  | uuid        | sí   | Quién invitó               |
| `accepted_at` | timestamptz | sí   | Cuándo aceptó              |

### `password_resets` y `email_verifications`

Misma forma las dos: **guardan el hash del token, no el token**, con vencimiento y
marca de un solo uso.

| Columna      | Tipo        | Nulo | Descripción                     |
| ------------ | ----------- | ---- | ------------------------------- |
| `user_id`    | uuid        | no   | FK a `users`                    |
| `token_hash` | varchar UQ  | no   | El token sólo lo tuvo el correo |
| `expires_at` | timestamptz | no   |                                 |
| `used_at`    | timestamptz | sí   | Al canjearlo                    |

### `audit_logs`

Quién hizo qué sobre qué, con el contexto de la petición: `user_id`, `action`,
`entity`, `entity_id`, `changes` (jsonb), `ip`, `user_agent`.

### `outbox_messages`

Ver el apartado 3. En auth el esquema lo crea `InitialSchema`, no una migración
aparte.

---

## 5. core-service — `beautyspot_core`

El servicio más grande: el negocio y todo lo que cuelga de él.

### `businesses`

La raíz del tenant. Es la única tabla de core que **no** es `TenantEntity`: ella
_es_ el negocio.

| Columna                               | Tipo           | Nulo | Descripción                                                 |
| ------------------------------------- | -------------- | ---- | ----------------------------------------------------------- |
| `slug`                                | varchar UQ     | no   | Subdominio: `{slug}.beautyspot.co`                          |
| `name`, `description`                 | varchar / text | —    |                                                             |
| `logo`, `cover_image`                 | varchar        | sí   |                                                             |
| `phone`, `email`, `website`           | varchar        | sí   |                                                             |
| `address`, `city`, `state`, `country` | varchar        | sí   |                                                             |
| `latitude`, `longitude`               | decimal(10,7)  | sí   |                                                             |
| `timezone`                            | varchar        | no   | `America/Bogota`; convierte las horas de pared en instantes |
| `currency`                            | varchar        | no   | `COP`                                                       |
| `locale`                              | varchar        | no   | `es-CO`                                                     |
| `businessType`                        | varchar        | no   | `BELLEZA`                                                   |
| `active`, `verified`                  | boolean        | no   |                                                             |
| `planId`                              | varchar        | sí   |                                                             |

### `branches`

Sede física. `TenantEntity` más `name`, dirección (`address`, `city`, `state`,
`country`), `latitude`/`longitude`, `phone` y `active`.

### `professionals`

| Columna                | Tipo         | Nulo | Descripción                               |
| ---------------------- | ------------ | ---- | ----------------------------------------- |
| `branch_id`            | uuid         | sí   | Sede a la que pertenece                   |
| `user_id`              | uuid         | sí   | Cuenta vinculada, si la tiene (otra base) |
| `name`, `photo`, `bio` | varchar/text | —    |                                           |
| `category`             | varchar      | sí   | Nombre suelto, previo a `category_id`     |
| `category_id`          | uuid         | sí   | FK a `professional_categories`            |
| `specialties`          | simple-array | no   | Lista separada por comas en una columna   |
| `years_exp`            | int          | no   |                                           |
| `rating`               | decimal(3,2) | no   | Media calculada                           |
| `total_reviews`        | int          | no   |                                           |
| `portfolio`            | jsonb        | sí   | `{ image, title?, description? }[]`       |
| `active`               | boolean      | no   |                                           |

Índice `(business_id, active)`.

### `services`

| Columna               | Tipo          | Nulo | Descripción                                     |
| --------------------- | ------------- | ---- | ----------------------------------------------- |
| `name`, `description` | varchar/text  | no   |                                                 |
| `price`               | decimal(10,2) | no   |                                                 |
| `duration`            | int           | no   | Minutos que la clienta pasa en el salón         |
| `procesado_desde`     | int           | sí   | Minuto en que el profesional queda libre        |
| `procesado_minutos`   | int           | sí   | Cuánto dura esa ventana                         |
| `buffer_despues`      | int           | no   | Limpieza posterior: ocupado sin cliente delante |
| `category`            | varchar       | no   |                                                 |
| `category_id`         | uuid          | sí   | FK a `service_categories`                       |
| `image`               | varchar       | sí   |                                                 |
| `active`              | boolean       | no   |                                                 |

Dos `CHECK` sostienen la ventana de procesado, que es de donde sale poder anidar
una cita dentro de otra:

- `CHK_procesado_pareja`: los dos nulos o los dos con valor.
- `CHK_procesado_cabe`: `procesado_desde + procesado_minutos <= duration`.

Índices `(business_id, category)` y `(business_id, active)`.

### `professional_services`

Qué presta cada profesional, con precio y duración propios opcionales
(`custom_price`, `custom_duration`). Único por `(professional_id, service_id)`;
la FK a `professionals` va con `ON DELETE CASCADE`.

### `clients`

La ficha del cliente **es del negocio**: quien reserva en dos sitios tiene dos
fichas, unidas sólo por `user_id`.

| Columna                 | Tipo         | Nulo | Descripción                                 |
| ----------------------- | ------------ | ---- | ------------------------------------------- |
| `user_id`               | uuid         | sí   | Cuenta, si reservó registrado               |
| `name`                  | varchar      | no   | Nombre completo, en un solo campo           |
| `email`, `phone`        | varchar      | sí   | Normalizados antes de guardar               |
| `documento`             | varchar      | sí   | Identifica al receptor en la factura        |
| `notes`                 | text         | sí   |                                             |
| `birth_date`            | date         | sí   | De aquí sale la felicitación de cumpleaños  |
| `birthday_greeted_year` | smallint     | sí   | Año en que ya se felicitó                   |
| `loyalty_points`        | int          | no   | Saldo de fidelidad                          |
| `no_show_count`         | int          | no   | Citas a las que no se presentó              |
| `tags`                  | simple-array | sí   |                                             |
| `ficha`                 | jsonb        | sí   | Valores de los campos configurables, por id |
| `active`                | boolean      | no   |                                             |
| `anonymized_at`         | timestamptz  | sí   | Derecho de supresión ejercido               |

Índices: `(business_id, email)`, `(business_id, phone)`,
`idx_clients_negocio_usuario (business_id, user_id)`,
`idx_clients_usuario (user_id)` —el endpoint interno consulta sin negocio— y
`idx_clients_cumpleanos (birth_date) WHERE birth_date IS NOT NULL`, parcial porque
la mayoría de las fichas no traen fecha.

`ficha` va en jsonb y no en columnas porque los campos los decide cada negocio y
cambian sin migrar el esquema.

### `campos_de_ficha`

Los campos que un negocio añade a la ficha: `etiqueta`, `tipo` (`texto`, `numero`,
`fecha`, `si_no`, `opciones`), `opciones` (jsonb), `obligatorio`, `orden`,
`service_ids` (jsonb; vacío = a todo cliente) y `active`. Índice
`(business_id, active)`.

`service_ids` es una lista y no una tabla puente a propósito: sin clave ajena, el
id de un servicio borrado deja de emparejar y ya está.

### `business_hours`

Horario de apertura por día. `branch_id` (nulo = todo el negocio), `day_of_week`
(0–6), `open_time`, `close_time` y `active`. `close_time` admite pasar de `24:00`
(ver 2.4).

### `business_config`

Ajustes sin columnas propias, guardados como pares clave–valor: `key` (varchar) y
`value` (jsonb), únicos por `(business_id, key)`. Las claves en uso son
`facturacion`, `reservas` y `fidelizacion`.

### `professional_categories` y `service_categories`

Misma forma: `name`, `description`, `icon`, `color`, `sort_order`, `active`, con
índice `(business_id, active)`.

### `outbox_messages`, `processed_events`

Ver el apartado 3.

---

## 6. booking-service — `beautyspot_booking`

### `appointments`

La entidad central. Es la única `AuditableEntity` del proyecto, así que además de
`business_id` lleva `created_by` y `updated_by`.

| Columna                  | Tipo                     | Nulo | Descripción                                     |
| ------------------------ | ------------------------ | ---- | ----------------------------------------------- |
| `branch_id`              | uuid                     | sí   | Sede                                            |
| `client_id`              | uuid                     | no   | Ficha en core                                   |
| `professional_id`        | uuid                     | no   | Titular de la cita                              |
| `date`                   | date                     | no   | Día, hora de pared del local                    |
| `start_time`, `end_time` | varchar `HH:MM`          | no   | Previstas                                       |
| `status`                 | enum `AppointmentStatus` | no   | `PENDING` al nacer                              |
| `notes`                  | varchar                  | sí   |                                                 |
| `cancel_reason`          | varchar                  | sí   | Nota libre de quien cancela                     |
| `cancel_reason_type`     | varchar                  | sí   | Motivo tipificado                               |
| `cancelled_by`           | uuid                     | sí   |                                                 |
| `cancelled_at`           | timestamptz              | sí   |                                                 |
| `points_earned`          | int                      | no   | Puntos que generó al atenderse                  |
| `totalAmount`            | decimal(10,2)            | no   | Calculado con el catálogo, no con lo que llegue |
| `ocupado_hasta`          | varchar `HH:MM`          | sí   | `end_time` más la limpieza del último servicio  |
| `started_at`             | timestamptz              | sí   | Cuándo empezó **de verdad**                     |
| `completed_at`           | timestamptz              | sí   | Cuándo terminó de verdad                        |
| `reminder_24h_sent_at`   | timestamptz              | sí   | Marca del aviso; evita repetirlo                |
| `reminder_1h_sent_at`    | timestamptz              | sí   | Íd.                                             |

La diferencia entre `started_at`/`completed_at` y `start_time`/`end_time` es lo
que dice si la duración estimada de un servicio se ajusta a la realidad.

Índices: `(business_id, date)`, `(professional_id, date)`,
`(business_id, professional_id, date, start_time)`,
`idx_appointments_cliente_fecha (client_id, date)` y
`idx_appointments_recordatorios (date)`, este último **parcial** con
`status IN ('PENDING','CONFIRMED') AND (reminder_24h_sent_at IS NULL OR reminder_1h_sent_at IS NULL)`:
el worker busca por fecha sin acotar por negocio, así que ninguno de los otros le
sirve.

### `appointment_services`

Los servicios de la cita, **con su precio y su duración congelados al reservar**:
que el catálogo suba mañana no reescribe lo que se acordó.

| Columna             | Tipo          | Nulo | Descripción                                  |
| ------------------- | ------------- | ---- | -------------------------------------------- |
| `appointment_id`    | uuid          | no   | FK, `ON DELETE CASCADE`                      |
| `service_id`        | uuid          | no   |                                              |
| `service_name`      | varchar       | no   | Congelado también                            |
| `price`             | decimal(10,2) | no   |                                              |
| `duration`          | int           | no   |                                              |
| `orden`             | int           | no   | Posición; de ahí sale su hora de inicio      |
| `procesado_desde`   | int           | sí   | Congelados del servicio                      |
| `procesado_minutos` | int           | sí   |                                              |
| `buffer_despues`    | int           | no   |                                              |
| `professional_id`   | uuid          | sí   | Quién atiende **esta línea**; nulo = titular |

Único por `(appointment_id, service_id)`. `professional_id` por línea es lo que
permite encadenar lavado + color + peinado con tres personas distintas.

### `availabilities`

Jornada recurrente de un profesional: `professional_id`, `day_of_week`,
`start_time`, `end_time`, `active`. Índice
`(business_id, professional_id, day_of_week)`. `end_time` admite pasar de `24:00`.

### `blocked_slots`

Bloqueo puntual que impide reservar: `professional_id`, `date`, `start_time`,
`end_time`, `reason` y `serie_id`.

Las repeticiones **se materializan como filas sueltas**, una por día, en vez de
guardar la regla: el cálculo de disponibilidad ya lee fechas concretas y no tiene
que aprender a expandir nada. `serie_id` es lo único que las mantiene unidas, para
poder levantar la serie entera de una vez. Índices
`(business_id, professional_id, date)` e `idx_blocked_slots_serie (serie_id)`.

### `outbox_messages`, `processed_events`

Ver el apartado 3.

---

## 7. payment-service — `beautyspot_payment`

### `payments`

| Columna          | Tipo                 | Nulo | Descripción                  |
| ---------------- | -------------------- | ---- | ---------------------------- |
| `branch_id`      | uuid                 | sí   | Sede en la que se cobró      |
| `appointment_id` | uuid                 | sí   | Cita cobrada, si la hay      |
| `client_id`      | uuid                 | no   |                              |
| `amount`         | decimal(10,2)        | no   | Lo que se cobró              |
| `method`         | enum `PaymentMethod` | no   |                              |
| `status`         | enum `PaymentStatus` | no   | `COMPLETED` por defecto      |
| `puntos_usados`  | int                  | no   | Puntos de fidelidad gastados |
| `descuento`      | decimal(10,2)        | no   | Lo que rebajaron             |
| `reference`      | varchar              | sí   |                              |
| `notes`          | text                 | sí   |                              |
| `registered_by`  | uuid                 | sí   |                              |
| `refunded_at`    | timestamptz          | sí   |                              |
| `refund_amount`  | decimal(10,2)        | sí   |                              |
| `refund_reason`  | text                 | sí   |                              |
| `refunded_by`    | varchar(100)         | sí   |                              |

Se guardan `puntos_usados` **y** `descuento`: el valor del punto puede cambiar, y
una vez cobrado hay que poder explicar el importe con los números de entonces.

Índices: `(business_id, created_at)` y
`uq_payments_cita_viva (business_id, appointment_id)` **único y parcial**, con
`appointment_id IS NOT NULL AND status IN ('PENDING','COMPLETED')`. Impide cobrar
dos veces la misma cita; parcial para que anular un cobro deje volver a cobrar.

### `invoices`

| Columna     | Tipo                 | Nulo | Descripción                      |
| ----------- | -------------------- | ---- | -------------------------------- |
| `client_id` | uuid                 | no   |                                  |
| `number`    | varchar              | no   | `{serie}-{año}-{correlativo}`    |
| `date`      | date                 | no   |                                  |
| `due_date`  | date                 | no   |                                  |
| `subtotal`  | decimal(10,2)        | no   | Suma de las líneas, sin impuesto |
| `tax_rate`  | decimal(5,4)         | no   | Tipo **congelado al emitir**     |
| `tax`       | decimal(10,2)        | no   |                                  |
| `total`     | decimal(10,2)        | no   | `subtotal` + `tax`               |
| `status`    | enum `InvoiceStatus` | no   | `DRAFT` por defecto              |
| `notes`     | text                 | sí   |                                  |

`tax_rate` se congela porque el IVA cambia por ley y una factura de hoy no puede
reimprimirse mañana con el tipo nuevo. El número es único por
**`(business_id, number)`**, no globalmente: cada negocio lleva su propia serie.

### `invoice_items`

`invoice_id`, `description`, `quantity`, `unit_price`, `total`. La relación desde
`invoices` va con `cascade: ["insert"]`: las líneas se insertan con la factura,
dentro de la transacción que reserva el número, porque una factura sin detalle no
es una factura.

### `invoice_sequences`

Último número emitido, con **clave primaria compuesta `(business_id, serie, year)`**
y una columna `last_number`. El siguiente se reserva con un
`INSERT … ON CONFLICT DO UPDATE … RETURNING` atómico, que es lo que evita que dos
facturas simultáneas se lleven el mismo número.

### `cash_sessions`

| Columna          | Tipo          | Nulo | Descripción                                |
| ---------------- | ------------- | ---- | ------------------------------------------ |
| `branch_id`      | uuid          | sí   | Sede de la caja                            |
| `opened_by`      | uuid          | no   |                                            |
| `closed_by`      | uuid          | sí   |                                            |
| `opening_amount` | decimal(10,2) | no   | Saldo inicial                              |
| `closing_amount` | decimal(10,2) | sí   | Lo contado al cerrar                       |
| `expected_total` | decimal(10,2) | sí   | Apertura + entradas − salidas              |
| `difference`     | decimal(10,2) | sí   | Sobrante en positivo, faltante en negativo |
| `opened_at`      | timestamptz   | no   |                                            |
| `closed_at`      | timestamptz   | sí   | Nulo mientras la caja siga abierta         |
| `notes`          | text          | sí   |                                            |

**Una caja abierta por sede**, garantizado por dos índices únicos parciales y no
sólo por la comprobación del servicio, que es un check-then-act:

- `uq_cash_sessions_open_per_branch (business_id, branch_id) WHERE closed_at IS NULL AND branch_id IS NOT NULL`
- `uq_cash_sessions_open_per_business (business_id) WHERE closed_at IS NULL AND branch_id IS NULL`, que cubre las cajas sin sede.

### `cash_movements`

`cash_session_id`, `type` (enum `CashMovementType`), `amount`, `concept`, `method`
(nulo en los movimientos anotados a mano), `payment_id` y `registered_by`.

La caja registra **todos** los métodos de pago como movimiento, porque el cierre Z
los desglosa; pero sólo el efectivo cuenta para `expected_total`, que es contra lo
único que tiene sentido descuadrar.

### `outbox_messages`

Ver el apartado 3.

---

## 8. notification-service — `beautyspot_notification`

### `notifications`

`user_id`, `type` (enum `NotificationType`), `channel` (enum
`NotificationChannel`), `title`, `message`, `data` (jsonb), `read` y `sent_at`.

Índices `idx_notifications_usuario_fecha (user_id, created_at)` e
`idx_notifications_usuario_leida (user_id, read)`: el listado y el contador de no
leídas son siempre por usuario.

Del enum de canales, hoy sólo se emiten `IN_APP` y `EMAIL`. `PUSH`, `WHATSAPP` y
`SMS` están declarados sin implementación.

### `notification_preferences`

`user_id`, `type`, `channel` y `enabled`. Sin fila, se recibe: la ausencia es
«nadie ha configurado nada», no «no quiere».

### `processed_events`

Ver el apartado 3.

---

## 9. marketplace-service — `beautyspot_marketplace`

### `business_profiles`

Escaparate público del negocio, **sincronizado desde core por evento**: duplica
`name`, `logo`, ciudad y contacto a propósito, para que el marketplace se pinte
sin llamar a core.

Además del reflejo, los campos del perfil inmersivo: `tagline` (80),
`story_title` (100), `story_text`, `story_image`, `founded_year`, `founders`,
`social_links` (jsonb), `section_config` (jsonb), `gallery_images` (jsonb),
`is_published` y `profile_completeness`. Métricas: `rating`, `total_reviews`.

`slug` es único. Índices `(active, is_published)` y `(city)`.

### `professional_profiles`

Igual: reflejo de core (`professional_id`, `name`, `photo`, `bio`, `specialties`,
`years_exp`) más lo que añade el negocio (`tagline`, `portfolio` jsonb,
`social_instagram`, `slug` único, `visible_on_profile`) y las métricas
calculadas.

### `reviews`

| Columna             | Tipo        | Nulo | Descripción               |
| ------------------- | ----------- | ---- | ------------------------- |
| `appointment_id`    | uuid        | sí   | Cita reseñada             |
| `client_id`         | uuid        | no   | Indexado                  |
| `professional_id`   | uuid        | sí   |                           |
| `rating`            | int         | no   | 1–5                       |
| `comment`           | text        | sí   |                           |
| `response`          | text        | sí   | Respuesta del negocio     |
| `responded_at`      | timestamptz | sí   |                           |
| `edited_at`         | timestamptz | sí   | Última edición del autor  |
| `service_name`      | varchar     | sí   | Enriquecido al crear      |
| `professional_name` | varchar     | sí   | Íd.                       |
| `photos`            | jsonb       | sí   |                           |
| `is_verified`       | boolean     | no   | Nace de una cita atendida |
| `helpful_count`     | int         | no   |                           |
| `status`            | varchar     | no   | `PUBLICADA` u `OCULTA`    |
| `report_count`      | int         | no   |                           |

`idx_reviews_cita (appointment_id)` es **único**: una reseña por cita, y
garantizado por la base, porque con un índice no único dos altas simultáneas
pasan las dos la comprobación previa. `idx_reviews_negocio_fecha
(business_id, created_at)` sostiene el listado, que ordena siempre por fecha.

Una reseña `OCULTA` deja de contar en la media del negocio.

### `review_helpful` y `review_reports`

Voto de «útil» y denuncia, **únicos por `(review_id, user_id)`** los dos: un voto
y una denuncia por persona. La denuncia añade `reason` (`OFENSIVA`, `FALSA`,
`SPAM`, `DATOS_PERSONALES`, `OTRO`) y `detalle`.

### `outbox_messages`

Ver el apartado 3.

---

## 10. analytics-service — `beautyspot_analytics`

Cinco tablas de agregados, todas `TenantEntity` y todas con un índice **único**
sobre su grano: es lo que permite que los incrementos sean un upsert atómico en
SQL y no un read-modify-write que dos eventos concurrentes se pisen.

| Tabla                  | Grano (único)                          | Columnas propias                                                                                                                                      |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daily_metrics`        | `(business_id, date)`                  | `total_appointments`, `completed_appointments`, `cancelled_appointments`, `no_show_appointments`, `total_revenue`, `new_clients`, `returning_clients` |
| `professional_metrics` | `(business_id, professional_id, date)` | `appointments`, `revenue`, `rating`, `avg_service_time`                                                                                               |
| `client_metrics`       | `(business_id, client_id)`             | `primera_visita`, `ultima_visita`, `visitas`, `gasto`                                                                                                 |
| `service_metrics`      | `(business_id, service_id, date)`      | `service_name`, `veces`, `ingresos`, `minutos`                                                                                                        |
| `capacity_daily`       | `(business_id, professional_id, date)` | `minutos_disponibles`, `minutos_vendidos`                                                                                                             |

`professional_metrics`, `service_metrics` y `capacity_daily` llevan además un
índice `(business_id, date)`: con el id del profesional o del servicio en medio,
el índice único no permite acotar por rango de fechas, que es justo como
consultan los reportes.

`client_metrics` no tiene `date` porque es historial acumulado, no una serie: de
`primera_visita`, `ultima_visita` y `visitas` salen la tasa de retorno y la
frecuencia.

`capacity_daily` la materializa un worker contra booking; es el denominador de la
ocupación de agenda.

### `processed_events`

Ver el apartado 3. Aquí es especialmente necesaria: reprocesar un evento sin ella
volvería a incrementar los contadores.

---

## 11. Multi-tenancy

Tenancy **lógica** (ADR-002): las tablas de negocio llevan `business_id` y se
filtran por él. No hay esquema ni base por tenant.

El aislamiento **no lo pide el cliente**: el gateway lee el negocio del JWT y lo
inyecta como cabecera `x-business-id`; `BusinessScopeGuard` y el decorador
`@BusinessId()` lo aplican en el servicio. Un cliente no puede falsificarlo.

Se salen de esto, y por eso llevan `@SkipBusinessScope()`, las rutas cuyo sujeto
es el usuario y no el negocio: el perfil propio, las citas del cliente, sus
facturas y sus notificaciones. Ahí el filtro es `user_id`.

| Alcance     | Tablas                                                                         |
| ----------- | ------------------------------------------------------------------------------ |
| Global      | `users`, `password_resets`, `email_verifications`, `audit_logs`                |
| Del negocio | Todas las `TenantEntity`: el resto                                             |
| Sin tenant  | `outbox_messages`, `processed_events`, `invoice_sequences` (lo lleva en la PK) |

---

## 12. Los índices que sostienen una garantía

La mayoría de los índices son de rendimiento. Estos seis son **correctitud**: sin
ellos el sistema admite un estado imposible, y la comprobación en código no basta
porque leer y escribir son dos pasos.

| Índice                               | Tabla           | Qué impide                             |
| ------------------------------------ | --------------- | -------------------------------------- |
| `uq_cash_sessions_open_per_branch`   | `cash_sessions` | Dos cajas abiertas en la misma sede    |
| `uq_cash_sessions_open_per_business` | `cash_sessions` | Íd. en negocios sin sedes              |
| `uq_payments_cita_viva`              | `payments`      | Cobrar dos veces la misma cita         |
| `(business_id, number)` único        | `invoices`      | Dos facturas con el mismo número       |
| `idx_reviews_cita` único             | `reviews`       | Dos reseñas de la misma cita           |
| Únicos de grano                      | analytics       | Que un upsert duplique la fila del día |

Cada uno tiene su test de integración; ninguno se puede comprobar con un unitario,
porque los repositorios simulados devuelven lo que se les pasó.

---

## 13. Migraciones

Migraciones de **TypeORM**, gestionadas por cada servicio de forma independiente,
en `services/<servicio>/src/migrations/`.

```bash
cd services/booking-service
npm run migration:generate -- src/migrations/NombreDeLaMigracion
npm run migration:run
npm run migration:revert
```

**El comportamiento cambia según el entorno**
(`packages/database/src/config/typeorm.config.ts`):

| Entorno            | `synchronize` | Migraciones                             |
| ------------------ | ------------- | --------------------------------------- |
| Desarrollo y tests | **activado**  | No se ejecutan (`migrationsRun: false`) |
| Producción         | forzado off   | Se aplican a mano en el despliegue      |

La consecuencia práctica, y la trampa: **un cambio de entidad funciona en local
sin escribir migración**, porque `synchronize` lo aplica solo. A producción no
llega. Por eso existe `schema-migrations.int-test.ts` en cada servicio, que es lo
que convierte el olvido en un fallo de CI en lugar de un fallo de despliegue.

De ahí salen dos reglas que cuestan una iteración cada vez que se olvidan:

1. **Un índice nuevo va en dos sitios**: el `@Index` de la entidad y la migración.
2. **Con el mismo nombre en ambos.** Si la migración lo llama
   `idx_blocked_slots_serie` y la entidad no lo nombra, TypeORM espera un
   `IDX_<hash>`, no reconoce el de la migración y lo da por pendiente.

Ver [../DEPLOY.md](../DEPLOY.md) para el procedimiento de despliegue.
