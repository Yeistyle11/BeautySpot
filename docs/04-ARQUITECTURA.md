# BeautySpot SaaS - Documento de Arquitectura

## 1. Vision General

BeautySpot es una plataforma SaaS multi-tenant: 8 microservicios NestJS que se
hablan por REST interno y por eventos de RabbitMQ, con un frontend Next.js. El
monorepo se gestiona con Turborepo, cada servicio es dueno de su base de datos, y
en desarrollo la infraestructura la levanta Docker Compose.

### Principios arquitectonicos

1. **Database-per-service**: cada servicio es dueno de sus datos y solo los expone
   por API. Ninguno se conecta a la base de otro.
2. **Event-driven**: los cambios de estado se propagan por eventos, y los que no
   pueden perderse salen por el Outbox, en la misma transaccion que el cambio.
3. **API Gateway**: unico punto de entrada. Enruta, autentica y resuelve el
   tenant; **autorizar es cosa de cada servicio**.
4. **Multi-tenancy logica**: `businessId` en las tablas de negocio, y un guard que
   comprueba que el usuario pertenece al negocio que pide.
5. **Degradar antes que caer**: lo accesorio falla en abierto. Si core no
   responde, el huso del negocio cae al de por defecto y la reserva sigue; lo que
   no puede degradarse —cobrar, reservar— falla y lo dice.
6. **Las invariantes, en la base**: donde una comprobacion en codigo seria un
   check-then-act, hay ademas un indice unico que lo garantiza.

---

## 2. Diagrama de Arquitectura

```
                        Navegador
                            |
                   apps/frontend (Next.js 16)
                   dev :8080 — panel, marketplace
                   y perfil publico son rutas de
                   la MISMA aplicacion
                            |
                    /api/* (rewrite de Next)
                            v
              +---------------------------------+
              |      API GATEWAY  :3000         |
              |  rate limit · JWT+tokenVersion  |
              |  tenant · circuit breaker       |
              +----------------+----------------+
                               |  /api/v1/{servicio}/{ruta}
     +---------+---------+-----+-----+---------+---------+---------+
     v         v         v           v         v         v         v
  AUTH      CORE     BOOKING     PAYMENT    NOTIF.   MARKETPL.  ANALYTICS
  :3001     :3002     :3003       :3004     :3005     :3006      :3007
     |         |         |           |         |         |         |
     +---------+---------+-----+-----+---------+---------+---------+
                               |
     +-------------------------+--------------------------+
     v                         v                          v
  PostgreSQL 16            RabbitMQ                     Redis
  host :5433               beautyspot.events (topic)    sesiones revocadas,
  7 bases, 1 motor,        + beautyspot.dlx             cache de tenant,
  1 usuario por base       1 cola por servicio/evento   rate limit
```

Lo que este dibujo no dice y conviene saber: **en produccion delante del gateway
hay un reverse proxy con certificado wildcard** para `*.beautyspot.co`, que es lo
que hace posible la resolucion de tenant por subdominio. No esta en el
repositorio; es parte del checklist de [../DEPLOY.md](../DEPLOY.md).

---

## 3. API Gateway

### Responsabilidades

El gateway es el unico punto de entrada. Hace cinco cosas, y **autorizar no es
una de ellas**:

1. **Enrutar**: un solo controlador comodin, `@All(":service/*splat")`, que quita
   su propio prefijo y reenvia a `<SERVICE_URL><ruta>`. No conoce las rutas de
   los servicios ni hay tabla que mantener: si el nombre del servicio es valido,
   se reenvia lo que venga.
2. **Autenticar**: valida el JWT y su `tokenVersion` contra Redis
   (`AuthGatewayGuard`), de modo que un logout invalida los tokens ya emitidos.
3. **Resolver el tenant**: saca el negocio del token y lo inyecta como
   `x-business-id`. **El cliente no puede falsificarlo**, porque la cabecera se
   construye a partir del token y no de la peticion entrante.
4. **Limitar el trafico**: `RateLimitGuard` sobre Redis, mas estricto en las
   rutas de autenticacion.
5. **Cortar cuando un servicio cae**: cada reenvio va dentro de un circuit
   breaker por servicio, con timeout (`PROXY_TIMEOUT_MS`).

**Quien autoriza es cada servicio**, con `@Roles(...)` y `RolesGuard` sobre el
token que el gateway reenvia. Ponerlo en el gateway obligaria a tener aqui una
copia de los roles de las 215 rutas, que se separaria de los controladores a la
primera.

### Que se reenvia

| Cabecera        | De donde sale                                               |
| --------------- | ----------------------------------------------------------- |
| `authorization` | La cabecera entrante o, si no viene, la cookie `bs_access`  |
| `x-business-id` | El negocio resuelto del token                               |
| `x-branch-id`   | La sede que el panel tenga seleccionada, si la manda        |
| `x-request-id`  | El identificador de correlacion, para poder seguir el salto |

La forma de la URL y la trampa del sufijo `-service` estan en
[API.md](API.md#url-base-y-enrutado-del-gateway).

### Flujo de una solicitud

```
Navegador -> API Gateway (3000)
                  |
                  +-> 1. Rate limit (Redis)
                  +-> 2. Origen permitido (CSRF) en las peticiones con efecto
                  +-> 3. Validar JWT + tokenVersion (salvo ruta @Public)
                  +-> 4. Resolver el negocio del token
                  +-> 5. Reenviar con las cabeceras de arriba, bajo el breaker
                  +-> 6. Traducir el fallo: 5xx->502, timeout->504, caido->503
                  |
                  v
              Microservicio: @Roles decide si el rol puede
```

---

## 4. Comunicacion entre Servicios

### 4.1 Comunicacion Sincrona (REST)

Se utiliza para operaciones donde se necesita una respuesta inmediata del servicio destino.

La hacen las rutas `internal/*`, a traves de `InternalHttpClient`
(`packages/nest-common`).

- **Autenticacion**: cabecera `x-internal-secret` con `INTERNAL_API_SECRET`, que
  `InternalSecretGuard` comprueba. Tiene que ser **identico en los ocho
  servicios**. El gateway nunca reenvia esa cabecera, asi que estas rutas no son
  alcanzables desde fuera.
- **Timeout**: 5 s por defecto (`AbortSignal.timeout`), ajustable por llamada,
  para que un servicio colgado no retenga al que llama.
- **Sin reintentos**: un fallo es un fallo. Lo que no puede perderse no viaja por
  aqui, viaja por el Outbox.
- **Fallar o degradar**, segun el caso: `pedir()` lanza
  `ServiceUnavailableException`, y `pedirONulo()` devuelve `null` para que quien
  llama siga con un valor por defecto. Asi el huso del negocio o su horario de
  apertura no tumban una reserva si core no responde.

**Ejemplo**: booking pide a core el precio y la duracion reales de los servicios
de una cita, en vez de fiarse de lo que envie el navegador.

```
booking -> POST http://core:3002/internal/services/resolve
Cabeceras:
  x-internal-secret: <INTERNAL_API_SECRET>
  x-request-id: uuid
```

### 4.2 Comunicacion Asincrona (RabbitMQ)

Se utiliza para eventos de dominio que no requieren respuesta inmediata y para desacoplar servicios.

**Patron**: Event-Driven sobre un exchange de tipo topic, con Dead Letter
Exchange para lo que ningun consumidor pudo procesar. El catalogo y la topologia
estan en el apartado 7.

**Formato del evento** (`IBaseEvent`, en `packages/event-types`):

```json
{
  "eventId": "uuid",
  "eventType": "booking.appointment.created",
  "timestamp": "2026-08-11T10:30:00.000Z",
  "correlationId": "uuid",
  "payload": {
    "appointmentId": "uuid",
    "businessId": "uuid",
    "clientId": "uuid",
    "professionalId": "uuid",
    "date": "2026-08-20",
    "startTime": "14:00",
    "services": [
      { "serviceId": "uuid", "name": "Corte", "price": 25000, "duration": 30 }
    ]
  }
}
```

Va en `payload`, no en `data`, y **no hay `eventVersion` ni `source`**: la version
no se ha necesitado todavia y el origen ya esta en el `eventType`.

`eventId` es lo que sostiene la idempotencia: **es estable entre reentregas**, y
los consumidores lo guardan en `processed_events` para descartar lo que ya
aplicaron. Sin eso, un `nack` y su reentrega volverian a sumar los puntos de
fidelidad o a incrementar dos veces la metrica del dia.

---

## 5. Flujo de Autenticacion

### 5.1 Registro

```
1. Cliente envia POST /api/v1/auth/register
   { email, password, name, phone? }

2. Auth Service valida datos (class-validator)
   - Email unico en la plataforma
   - Password: 10 caracteres, mayusculas + minusculas + digitos, y no comun

3. Auth Service hashea password (bcrypt, 12 rounds)

4. Auth Service crea el usuario en auth_db con email_verified = false

5. En la misma transaccion, guarda el hash del token de confirmacion
   (24 h, un solo uso) y encola por Outbox
   -> auth.user.registered  y  auth.email-verification.requested

6. Notification Service consume ambos: bienvenida y enlace de confirmacion

7. Respuesta al cliente: { user, message } — sin tokens; la cuenta no
   entra hasta canjear el enlace en POST /api/v1/auth/verify-email
```

### 5.2 Login

```
1. Cliente envia POST /api/v1/auth/login
   { email, password }

2. Auth Service busca usuario por email
   - Verificar estado activo y correo confirmado
   - Verificar bloqueo vigente (users.locked_until)

3. Auth Service compara password (bcrypt.compare)

4. Si es correcto:
   a. Access token (HS256 con JWT_SECRET, 15 min por defecto)
      { sub, email, role, businessId, businessIds, memberships, tokenVersion }
   b. Refresh token (HS256 con JWT_REFRESH_SECRET, 7 dias), con su propio
      jti, que se guarda en el conjunto de refresh vivos del usuario en Redis
   c. Reiniciar el contador de intentos fallidos

5. Si falla:
   a. Incrementar users.failed_login_attempts
   b. Al llegar a 5: bloquear 15 min; cada bloqueo encadenado dobla la
      espera, hasta 24 h

6. Respuesta: el gateway pone el access en la cookie httpOnly bs_access y
   una cookie legible bs_session con rol, negocio y vencimiento, para que el
   navegador hidrate la sesion sin leer el token
```

`JWT_SECRET` tiene que ser **identico en auth-service y api-gateway**: uno firma y
el otro verifica. Es el fallo de configuracion que mas confunde, porque se
manifiesta como un 401 en todo.

### 5.3 Validacion de Token en API Gateway

```
1. La peticion trae Authorization: Bearer <token>, o la cookie bs_access

2. AuthGatewayGuard verifica la firma (HS256 con JWT_SECRET) y la expiracion

3. Compara payload.tokenVersion con la version vigente en Redis
   - Distinta -> 401. Es lo que hace que un logout invalide de inmediato
     los tokens ya emitidos, sin esperar a que expiren ni mantener una
     lista negra token a token

4. Reenvia authorization tal cual e inyecta x-business-id con el negocio
   resuelto del token
```

No se inyectan `X-User-Id`, `X-User-Role` ni `X-User-Memberships`: el servicio
recibe el token entero y saca de el lo que necesita con `@CurrentUser()`.

### 5.4 Refresh con rotacion y deteccion de reuso

```
1. POST /api/v1/auth/refresh, con credentials: include (cookie)

2. Auth verifica la firma y que el jti siga en el conjunto de vivos del
   usuario en Redis

3. Canjearlo lo retira de ese conjunto y emite un par nuevo, con jti nuevo

4. Si llega un jti que ya no esta vivo, alguien esta reutilizando uno gastado:
   se revocan TODAS las sesiones del usuario (bumpVersion) y hay que
   identificarse de nuevo
```

En el navegador, la renovacion la dispara `lib/api.ts` ante un 401: varias
peticiones caducadas a la vez comparten **una sola** renovacion
(`renovacionEnCurso`) y despues reintentan.

---

## 6. Estrategia Multi-Tenant

### 6.1 Modelo de Multi-Tenancy

BeautySpot utiliza **multi-tenancy logico** (base de datos compartida con aislamiento por columna `businessId`) dentro de cada servicio. Cada servicio tiene su propia base de datos, pero dentro de cada base de datos, los datos de diferentes negocios coexisten y se separan mediante la columna `businessId`.

**Por que no una base de datos por negocio?**

- El overhead de gestionar miles de bases de datos es prohibitivo en MVP
- Las migraciones se simplifican (una por servicio, no una por negocio)
- Los costos de infraestructura se reducen drasticamente
- Se puede migrar a database-per-tenant posteriormente si es necesario

### 6.2 Resolucion de tenant

Hay **dos caminos**, y el que se usa en cada peticion del panel es el primero.

**Desde el token** (`ProxyService.negocioDeLaPeticion`). El JWT trae `businessId`
y `businessIds`. Si el cliente pide un negocio concreto con `x-business-id`, se
respeta **solo si tiene membresia en el**; si no, 403. Sin cabecera, se usa el
suyo por defecto.

Que el cliente pueda pedir un negocio no es un agujero, es un requisito: quien
trabaja en dos sitios necesita decir en cual esta operando, y sin atender esa
cabecera solo podria entrar al primero de su lista. Lo que no puede es pedir uno
que no sea suyo.

**Desde el subdominio** (`TenantService`), para lo que llega sin sesion:
`{slug}.beautyspot.co` -> se busca `tenant:{slug}` en Redis y, si no esta, se
pregunta a `GET /internal/businesses/resolve?slug=…` y se cachea **300 segundos**.
Los subdominios `www` y `api` no cuentan como negocio.

En los dos casos el resultado sale hacia el servicio como `x-business-id`.

### 6.3 Filtro obligatorio de businessId

Lo aplica `BusinessScopeGuard` (`packages/nest-common`), registrado en todos los
servicios. Comprueba, por este orden:

1. Que la cabecera `x-business-id` este presente y sea un **UUID valido**.
2. Que el negocio pedido este entre los del token (`businessIds`, o `businessId`
   si solo hay uno). Si no, 403: es lo que corta el acceso a un tenant ajeno.
3. `SUPER_ADMIN` se salta el punto 2 y puede entrar en cualquier negocio.

Y **no** se aplica en cuatro casos: rutas `@Public()`, las marcadas con
`@SkipBusinessScope()` (aquellas cuyo sujeto es el usuario y no el negocio: su
perfil, sus citas, sus facturas), `/health` y todo lo que cuelgue de `/internal`,
que ya va tras el secreto interno.

Del guard sale `request.businessId`, que es lo que lee el decorador
`@BusinessId()`. A partir de ahi, filtrar es cosa de cada consulta; el CRUD
compartido (`TenantCrudService`) lo hace por su cuenta.

### 6.4 Entidades globales vs de negocio

| Tipo       | Ejemplos                                                                            | `business_id` | Aislamiento                                 |
| ---------- | ----------------------------------------------------------------------------------- | ------------- | ------------------------------------------- |
| Global     | `users`, `password_resets`, `email_verifications`, `audit_logs`                     | No lleva      | Por `user_id`                               |
| De negocio | `businesses` y todo lo que cuelga: profesionales, servicios, clientes, citas, pagos | Obligatorio   | Por `business_id`                           |
| Hibrida    | `notifications`, `memberships`                                                      | Lo lleva      | Por `user_id`, acotado por negocio si viene |

`memberships` es el caso curioso: lleva `business_id` porque _es_ el vinculo con
el negocio, pero vive en la base de auth, junto a `users`.

---

## 7. Arquitectura Event-Driven

### 7.1 Catalogo de Eventos

Los nombres canonicos viven en `packages/event-types/src/index.ts` (`EventNames`),
compartidos por productores y consumidores para que nadie escriba la cadena a
mano. Son **30 nombres declarados** con el patron `{servicio}.{agregado}.{accion}`,
de los que hoy circulan 25.

| Routing key                         | Publica          | Consume                       |
| ----------------------------------- | ---------------- | ----------------------------- |
| `auth.user.registered`              | Auth             | Notification                  |
| `auth.user.logged-in`               | Auth             | —                             |
| `auth.password-reset.requested`     | Auth             | Notification                  |
| `auth.email-verification.requested` | Auth             | Notification                  |
| `auth.membership.created`           | Auth             | —                             |
| `auth.membership.role-changed`      | Auth             | —                             |
| `core.business.created`             | Core             | —                             |
| `core.business.updated`             | Core             | Marketplace                   |
| `core.professional.created`         | Core             | Booking                       |
| `core.service.created`              | nadie            | —                             |
| `core.service.updated`              | nadie            | —                             |
| `core.client.created`               | Core             | Analytics                     |
| `core.client.birthday`              | Core (sondeo)    | Notification                  |
| `booking.appointment.created`       | Booking          | Notification, Analytics       |
| `booking.appointment.confirmed`     | Booking          | Notification, Analytics       |
| `booking.appointment.cancelled`     | Booking          | Notification, Analytics       |
| `booking.appointment.completed`     | Booking          | Notification, Analytics, Core |
| `booking.appointment.no-showed`     | Booking          | Analytics, Core               |
| `booking.appointment.rescheduled`   | Booking          | Notification                  |
| `booking.appointment.reminder-due`  | Booking (sondeo) | Notification                  |
| `payment.payment.registered`        | Payment          | Notification, Analytics       |
| `payment.invoice.generated`         | Payment          | Notification                  |
| `payment.points.redeemed`           | Payment          | Core                          |
| `payment.refund.processed`          | Payment          | —                             |
| `payment.cash.session.closed`       | Payment          | —                             |
| `marketplace.review.created`        | Marketplace      | Notification, Analytics       |
| `marketplace.review.updated`        | nadie            | —                             |
| `notification.email.queued`         | Notification     | —                             |
| `notification.email.sent`           | nadie            | —                             |
| `notification.email.failed`         | nadie            | —                             |

Dos columnas que conviene leer con cuidado:

- **«Consume» a guion** significa que hoy nadie se suscribe. El evento se publica
  igualmente: el contrato ya esta y añadir el consumidor no obliga a tocar al
  productor.
- **«Publica: nadie»** significa que el nombre esta declarado en `EventNames`
  pero **ningun servicio lo emite**. Son huecos reservados, no flujos: no hay que
  contar con ellos al diseñar nada.

`notification.email.queued` se publica directamente con `AmqpConnection`, sin
pasar por el Outbox ni por `EventBusService`: es traza, no un cambio de negocio
que deba confirmarse con una transaccion.

Los dos marcados **sondeo** no nacen de una peticion: `RemindersWorker` y
`CumpleanosWorker` los emiten desde un `setInterval`, marcando en la propia fila
lo que ya publicaron para no repetirse aunque haya varias instancias.

### 7.2 Topologia de RabbitMQ

**Un solo exchange, no uno por servicio**: todos los eventos viajan por el topic
`beautyspot.events` (`EVENTS_EXCHANGE`), y cada consumidor se queda con los suyos
por routing key. Los que fallan van a `beautyspot.dlx` y se acumulan en
`beautyspot.dlx.dead`, que es terminal: no se reencolan solas, se revisan y se
reprocesan a mano.

Cada servicio tiene **su propia cola por evento**, nombrada
`nombreDeCola(servicio, evento)` — `notification.booking.appointment.created`—,
de modo que todos reciben el mismo evento y el fallo de uno no deja sin él a los
demas.

```
                    productores
      auth  core  booking  payment  marketplace
        |     |      |        |         |
        +-----+------+--------+---------+
                     |
        +------------v--------------+
        |  beautyspot.events (topic)|
        +------------+--------------+
                     |  una cola por (servicio, evento)
   +-----------------+------------------+
   |                 |                  |
+--v------------+ +--v-------------+ +--v------------+
| notification. | | analytics.     | | core.         |
| booking.appo… | | booking.appo…  | | payment.poin… |
+--------+------+ +--------+-------+ +-------+-------+
         |                 |                 |
         +--------- fallo ------------------+
                     |
        +------------v--------------+
        |   beautyspot.dlx (DLX)    |
        +------------+--------------+
                     |
            beautyspot.dlx.dead
```

---

## 8. Patron Database-per-Service

### 8.1 Distribucion de bases de datos

Siete bases, **una sola instancia de Postgres**. No hay un motor por servicio: lo
que aisla es el usuario, propietario unicamente de su base y sin `CONNECT` sobre
las demas. El reparto de tablas esta en
[05-BASE-DATOS.md](05-BASE-DATOS.md#1-un-motor-siete-bases).

En desarrollo el motor se publica en el **5433** del host; en los tests de
integracion, en el **5434**.

### 8.2 Reglas de propiedad de datos

| Servicio     | Es dueno de                                                      | De fuera consume                                                           |
| ------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Auth         | `users`, `memberships`, tokens de correo y reset, `audit_logs`   | Nada                                                                       |
| Core         | El negocio y todo lo que cuelga: sedes, equipo, catalogo, fichas | Eventos de booking (cita atendida, no-show) y de payment (canje de puntos) |
| Booking      | `appointments`, sus lineas, jornadas y bloqueos                  | `core.professional.created`; catalogo, horario y huso por API interna      |
| Payment      | `payments`, facturas, series y caja                              | Cita y cliente por API interna                                             |
| Notification | `notifications` y preferencias                                   | Eventos de auth, booking, core, payment y marketplace                      |
| Marketplace  | Perfiles publicos, `reviews`, votos y denuncias                  | `core.business.updated`; el resto se sincroniza por API interna            |
| Analytics    | Las cinco tablas de metricas                                     | Eventos de booking, core, payment y marketplace                            |

### 8.3 No compartir base de datos

**Regla estricta**: ningun servicio se conecta a la base de otro. Las tres formas
admitidas de leer datos ajenos:

1. **Sincrona**: llamada a la ruta `internal/*` del servicio dueno.
2. **Asincrona**: consumir el evento que los lleva.
3. **Duplicacion controlada**: guardar una copia de solo lectura de lo que llega
   por evento. Es lo que hacen marketplace con el nombre y la foto del negocio, y
   `appointment_services` con el precio del catalogo. En el segundo caso la copia
   no es cache sino **registro**: el precio que se acordo al reservar no debe
   cambiar porque el catalogo suba.

La consecuencia es que las columnas que apuntan a otra base —`client_id`,
`professional_id`, `appointment_id`— **no tienen clave ajena**. La integridad
referencial acaba en el borde del servicio, y quien borra tiene que preguntar
antes: por eso existe `GET /internal/appointments/professional/:id/has-history`.

---

## 9. Estrategia de Manejo de Errores

### 9.1 Formato de error

Lo impone `HttpExceptionFilter` (`packages/nest-common`), registrado en los ocho
servicios. Cualquier excepcion sale con esta forma:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación",
    "details": { "validation": ["email debe ser un correo válido"] }
  },
  "statusCode": 400,
  "timestamp": "2026-08-11T10:30:00.000Z"
}
```

`details` solo aparece en los errores de validacion, y es un objeto con la lista
de mensajes, no un arreglo de `{ field, message }`. **No hay `requestId` ni
`path`** en el cuerpo: la correlacion viaja en la cabecera `x-request-id` y en el
log estructurado.

Dos comportamientos del filtro que conviene conocer:

- **Solo se registran en el log los 5xx.** Un 400 o un 404 son respuestas
  normales, no incidencias.
- Si la respuesta ya se envio —el gateway propagando el cuerpo de un backend— no
  escribe un segundo cuerpo: lo registra y calla. Sin eso reventaria con
  `ERR_HTTP_HEADERS_SENT`, tapando el error de verdad.
- En un consumidor de RabbitMQ no hay respuesta que escribir, asi que **relanza**
  para que el mensaje se rechace y acabe en la DLQ.

### 9.2 Codigos de error

El filtro deriva el codigo del estado HTTP, y una excepcion puede traer el suyo
propio si lo necesita. Los estables son estos:

| HTTP | `error.code`          | Cuando                                      |
| ---- | --------------------- | ------------------------------------------- |
| 400  | `VALIDATION_ERROR`    | Falla el DTO en el `ValidationPipe`         |
| 401  | `AUTH_UNAUTHORIZED`   | Sin token, invalido, expirado o revocado    |
| 403  | `AUTH_FORBIDDEN`      | Autenticado pero sin el rol, o tenant ajeno |
| 404  | `NOT_FOUND`           | El recurso no existe                        |
| 409  | `CONFLICT`            | Choque de estado                            |
| 429  | `RATE_LIMIT_EXCEEDED` | Demasiadas peticiones                       |
| 500  | `INTERNAL_ERROR`      | Fallo no controlado                         |

**No existe un catalogo de codigos de negocio** (`BOOKING_SLOT_CONFLICT` y
similares): los errores de dominio se lanzan como `BadRequestException` con un
mensaje en espanol, y quien los muestra es el frontend tal cual. Añadir codigos
propios es posible —el filtro los respeta— pero hoy no se usa.

### 9.4 Circuit breaker

Vive **en el gateway**, no en cada servicio (`CircuitBreakerService`), y lleva un
estado por servicio de destino.

```
CLOSED (normal)
  - Se reenvia todo
  - CIRCUIT_BREAKER_THRESHOLD fallos seguidos (5) -> OPEN

OPEN (cortado)
  - Se rechaza sin llamar, con 503
  - Pasados CIRCUIT_BREAKER_TIMEOUT_MS (60 s) -> HALF_OPEN

HALF_OPEN (tanteo)
  - Se dejan pasar CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS (3) peticiones
  - Si van bien -> CLOSED;  si falla una -> OPEN
```

Los tres valores se configuran por entorno. El estado se guarda **en memoria del
proceso**, así que con varias instancias del gateway cada una lleva el suyo: es
suficiente para lo que hace —dejar de castigar a un servicio caído— y evita que
el corte dependa de Redis.

Cuenta como fallo tanto el 5xx del backend como el timeout y el error de red. El
gateway los traduce a 502, 504 y 503 respectivamente.

---

## 10. Convenciones de Diseno de API

### 10.1 Principios REST

- Los sustantivos en plural para recursos: `/api/v1/appointments`, `/api/v1/professionals`
- Acciones sobre recursos via metodos HTTP: GET (leer), POST (crear), PUT (reemplazar), PATCH (actualizar), DELETE (eliminar)
- Acciones especificas via sub-rutas: `POST /api/v1/appointments/{id}/confirm`, `POST /api/v1/appointments/{id}/cancel`

### 10.2 Versionado

El prefijo `/api/v1/` lo pone y lo quita **el gateway**; los microservicios no
llaman a `setGlobalPrefix`, así que sus controladores cuelgan de la raíz. Hoy solo
existe `v1` y no hay mecanismo de convivencia entre versiones: añadir `v2` pide
decidir antes si conviven en el mismo proceso o en otro.

### 10.3 Paginacion

**Por página, no por cursor.** Los listados aceptan `?page=` y `?limit=` y
responden con la forma `IPaginatedResponse<T>`
(`packages/shared-types/src/common.types.ts`), que el `TransformInterceptor`
envuelve a su vez en el sobre estándar:

```json
{
  "success": true,
  "data": {
    "data": [],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 137,
      "totalPages": 7,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2026-08-11T10:30:00.000Z"
}
```

El anidamiento `data.data` es real y el frontend lo desenvuelve en `lib/swr.ts`
(`paginatedSchema`), que además **valida la respuesta con Zod en tiempo de
ejecución**.

### 10.4 Filtrado y ordenacion

`parsePaginationQuery` (`packages/shared-utils`) resuelve `page`, `limit`, `sort`,
`order` y `search`, y acota tres cosas:

- **`sort` contra una lista blanca** que pasa el controlador; lo que no esté en
  ella cae a `createdAt` y no llega a la consulta.
- **`limit` a 100** como máximo.
- **`page` a 1000** (`MAX_PAGE`), porque sin tope un `?page=500000&limit=100`
  genera un `OFFSET` de 50 millones que Postgres tiene que leer y descartar.

El resto de filtros los declara cada endpoint en su DTO.

### 10.5 Formato de respuesta correcta

Lo pone `TransformInterceptor`, global en los ocho servicios:

```json
{
  "success": true,
  "data": { "...": "el valor que devuelve el controlador" },
  "timestamp": "2026-08-11T10:30:00.000Z"
}
```

Siempre esas tres claves, tanto para un recurso como para una colección. **No hay
bloque `meta` con `requestId`**: la correlación va en la cabecera `x-request-id`.
En un consumidor de RabbitMQ el interceptor no envuelve nada, porque ahí no hay
respuesta HTTP.

---

## 11. Estructura del monorepo

```
BeautySpot/
+-- apps/
|   +-- frontend/             Next.js 16 (App Router). El unico frontend.
|       +-- src/app/          Rutas: dashboard, login, marketplace
|       +-- src/components/   UI compartida
|       +-- src/lib/          api, swr, store, permissions: lo que componen las paginas
|
+-- services/                 Los 8 microservicios NestJS
|   +-- api-gateway/          3000  auth, proxy, tenant, rate-limit, circuit-breaker
|   +-- auth-service/         3001
|   +-- core-service/         3002
|   +-- booking-service/      3003
|   +-- payment-service/      3004
|   +-- notification-service/ 3005
|   +-- marketplace-service/  3006
|   +-- analytics-service/    3007
|
+-- packages/
|   +-- nest-common/          Guards, decoradores, Outbox, cache, health, observabilidad
|   +-- database/             Entidades base, config de TypeORM, transformers
|   +-- shared-types/         Enums y tipos del dominio
|   +-- shared-utils/         Horas, intervalos de agenda, paginacion
|   +-- shared-constants/     Reglas de negocio con nombre
|   +-- event-types/          Nombres y payloads de los eventos
|
+-- infra/docker/             init.sh de Postgres y configuracion de infraestructura
+-- env/                      Un fichero de entorno por contenedor (produccion)
+-- docs/
+-- .github/workflows/        tests.yml
```

Cada servicio repite la misma forma dentro de `src/`:

```
src/
+-- modules/<dominio>/        controller + service + module + dto/
+-- entities/                 Entidades TypeORM del servicio
+-- migrations/               Sus migraciones
+-- common/                   Decoradores y utilidades propias
+-- test/                     setup de unitarios, integration-setup y los *.int-test.ts
+-- orm-entities.ts           La lista que comparten app.module y data-source
+-- app.module.ts
+-- main.ts                   Arranca con bootstrapMicroservice de nest-common
```

Dos cosas que no se ven en el arbol y explican bastante:

- **Los servicios estan en `services/`, no en `apps/`**, donde solo vive el
  frontend.
- **Los paquetes compartidos se resuelven por `node_modules` hacia su
  `dist/index.d.ts`**, asi que hay que compilarlos (`npm run build`) antes de
  cualquier cosa que haga type-check contra ellos. Es la causa mas comun de un
  TS2307 en un clon recien hecho.

## 12. Health Checks y Monitoreo

### 12.1 Health check

**Uno solo por servicio**, `GET /health`, publico (`@Public()`) y compartido desde
`packages/nest-common`. No hay `live`, `ready` ni `detail` separados: el mismo
endpoint responde **200 si todo va y 503 si algo falla**, que es lo que necesita
un orquestador para decidir si mandar trafico.

```json
{
  "status": "healthy",
  "checks": { "database": "up", "redis": "up", "rabbitmq": "up" },
  "timestamp": "2026-08-11T10:30:00.000Z"
}
```

Solo aparecen las dependencias **que el servicio tenga inyectadas**: se declaran
`@Optional()`, así que el gateway —sin base de datos propia— informa de Redis y
nada más. No se mide latencia ni se informa de versión ni de uptime.

El `/health` del gateway ademas consulta el de los siete servicios, que es la
vista de conjunto.

### 12.2 Trazas y logging

`StructuredLogger` escribe JSON, y la correlacion la sostiene
`requestContextMiddleware` con `AsyncLocalStorage`: el `x-request-id` que entra
por el gateway se propaga al reenvio y **cada servicio lo pone en sus lineas de
log sin tener que pasarlo por parametro**. Un fallo se puede seguir de punta a
punta con ese identificador.

`LatenciaInterceptor` mide cada peticion en los siete servicios, y el gateway mide
ademas el salto completo; lo que pase de `UMBRAL_LENTO_MS` (1000 ms) se registra
como aviso.

Lo que **no** hay: metricas Prometheus, trazas distribuidas OpenTelemetry ni
agregador de logs. Es el siguiente paso natural y esta descrito como objetivo en
[10-DEVOPS.md](10-DEVOPS.md).

---

## 13. Decisiones Arquitectonicas

### ADR-001: Microservicios desde el inicio

**Contexto**: La plataforma podria construirse como monolito o como microservicios.
**Decision**: Arquitectura de microservicios desde el inicio con monorepo.
**Rationale**: El dominio tiene limites claros (auth, core, booking, payment, notification, marketplace, analytics) que se alinean bien con microservicios. El monorepo mitiga la complejidad de gestionar repos separados. El overhead operacional se justifica por la escalabilidad independiente y la isolation de fallos.

### ADR-002: Multi-tenancy logico (shared database)

**Contexto**: Se puede aislar tenants con bases de datos separadas o con filtro por columna.
**Decision**: Aislamiento logico con columna businessId en tablas compartidas.
**Rationale**: En fase MVP con pocos cientos de negocios, el overhead de miles de bases de datos es injustificable. Se puede migrar a schema-per-tenant o database-per-tenant si la escala lo requiere.

### ADR-003: RabbitMQ sobre Kafka

**Contexto**: Se necesita un message broker para eventos asincronos.
**Decision**: RabbitMQ con exchanges tipo topic.
**Rationale**: RabbitMQ es mas simple de operar para el equipo, tiene mejor soporte para routing complejo con topic exchanges, y el volumen de eventos en MVP no justifica la complejidad de Kafka. Se puede migrar a Kafka si el throughput lo requiere.

### ADR-004: NestJS como framework de backend

**Contexto**: Se necesita un framework robusto para construir los microservicios.
**Decision**: NestJS para todos los servicios backend.
**Rationale**: NestJS provee una arquitectura modular con DI, decorators, guards, interceptors, y excelente integracion con TypeORM, RabbitMQ, y Redis. La curva de aprendizaje es baja para desarrolladores familiarizados con Angular o TypeScript.

### ADR-005: Next.js para el frontend

**Contexto**: El frontend necesita SSR para perfiles publicos (SEO) y SPA para el dashboard.
**Decision**: Next.js con App Router (16 desde agosto de 2026; se subio desde 14
para cerrar los avisos de seguridad del optimizador de imagenes).
**Rationale**: Next.js permite SSR para el marketplace y perfiles publicos, y SPA para el dashboard. El App Router con React Server Components optimiza la carga inicial y el SEO.

### ADR-006: Transactional Outbox para los eventos que importan

**Contexto**: Publicar en RabbitMQ despues de confirmar la transaccion deja una
ventana: si el proceso muere en medio, el cambio queda hecho y el evento no sale.
Publicar antes tiene el problema simetrico.
**Decision**: Los eventos criticos se escriben en `outbox_messages` **dentro de la
misma transaccion** que el cambio, y `OutboxRelayWorker` los publica despues.
**Rationale**: Es la unica forma de que no haya cambio sin evento ni evento sin
cambio sin meter transacciones distribuidas. El coste es una tabla por servicio y
un worker; a cambio, los puntos de fidelidad y los avisos al cliente no dependen
de que RabbitMQ este vivo en ese instante. Lo llevan auth, core, booking,
marketplace y payment.

### ADR-007: La correctitud, en la base y no solo en el codigo

**Contexto**: Comprobar antes de escribir («¿hay ya una caja abierta?», «¿esta
cobrada esta cita?») es un _check-then-act_: dos peticiones concurrentes pueden
pasar las dos.
**Decision**: Cada invariante de ese tipo se sostiene con un **indice unico, casi
siempre parcial**, ademas de la comprobacion en codigo.
**Rationale**: La comprobacion en codigo da un mensaje de error legible; el indice
da la garantia. Y son parciales porque la invariante casi nunca es absoluta: una
caja unica **abierta**, un cobro unico **vivo**. Estan enumerados en
[05-BASE-DATOS.md](05-BASE-DATOS.md#12-los-indices-que-sostienen-una-garantia), y
cada uno tiene un test de integracion, porque con repositorios simulados no se
puede observar ninguno.

### ADR-008: Las horas de la agenda son de pared, no instantes

**Contexto**: Una cita a las 10:00 tiene que seguir siendo a las 10:00 aunque
cambie el horario de verano o el servidor este en otro huso.
**Decision**: `date` (`date`) y `start_time` (`HH:MM`) por separado, sin huso, y
el huso del negocio (`businesses.timezone`) solo cuando hay que convertir a
instante.
**Rationale**: Guardar un `timestamptz` obligaria a reinterpretar la agenda entera
si el negocio cambia de zona, y haria depender del huso del proceso lo que es una
propiedad del local. El coste es que la aritmetica de horas es propia
(`packages/shared-utils/src/intervalos.ts`) y que una hora puede pasar de `24:00`
para expresar la madrugada del mismo dia de trabajo.
