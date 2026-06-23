# BeautySpot SaaS - Documento de Arquitectura

## 1. Vision General

BeautySpot es una plataforma SaaS multi-tenant construida sobre una arquitectura de microservicios con 8 servicios independientes comunicados via REST sincrono y eventos asincronos a traves de RabbitMQ. El monorepo se gestiona con Turborepo, cada servicio posee su propia base de datos PostgreSQL (patron database-per-service), y la infraestructura se orquesta con Docker Compose para desarrollo.

### Principios Arquitectonicos

1. **Database-per-service**: Cada microservicio es dueno de sus datos y los expone unicamente via API
2. **Event-driven**: Los cambios de estado se propagan mediante eventos asincronos para desacoplamiento
3. **API Gateway**: Unico punto de entrada que enruta, autentica y transforma las solicitudes
4. **Multi-tenancy por negocio**: Cada entidad de negocio incluye `businessId` para aislamiento logico
5. **Fail gracefully**: Los servicios no criticos pueden fallar sin afectar la operacion principal

---

## 2. Diagrama de Arquitectura

```
                           +-----------------+
                           |   CDN / DNS     |
                           | *.beautyspot.co |
                           +--------+--------+
                                    |
                                    v
+-------------------------------------------------------------------+
|                        LOAD BALANCER (Nginx)                       |
|                    SSL Termination + Reverse Proxy                  |
+--------+------------------+------------------+--------------------+-+
         |                  |                  |                    |
         v                  v                  v                    v
+--------+------+  +--------+------+  +--------+------+  +--------+------+
|               |  |               |  |               |  |               |
|   Frontend    |  |   Frontend    |  |   Frontend    |  |   Frontend    |
|   Dashboard   |  |   Marketplace |  |   Public      |  |   Admin       |
|   (Next.js)   |  |   (Next.js)   |  |   Profile SSR |  |   Panel       |
|               |  |               |  |   (Next.js)   |  |  (Next.js)    |
+-------+-------+  +-------+-------+  +-------+-------+  +-------+-------+
        |                  |                  |                    |
        v                  v                  v                    v
+-------------------------------------------------------------------+
|                                                                    |
|                    API GATEWAY (NestJS)                            |
|                    Puerto: 3001                                     |
|                                                                    |
|  +------------+  +------------+  +-------------+  +------------+  |
|  | Rate       |  | JWT        |  | Tenant      |  | Request    |  |
|  | Limiting   |  | Validation |  | Resolution  |  | Routing    |  |
|  +------------+  +------------+  +-------------+  +------------+  |
|                                                                    |
+--------+---------+---------+-----------+---------+--------+--------+
         |         |         |           |         |        |
         v         v         v           v         v        v
+--------+---+ +---+--------+ +--+-------+ +-------+--+ +---+--------+
|            | |            | |  |        | |          | |            |
|   AUTH     | |   CORE     | |  |BOOKING | | PAYMENT  | |NOTIFICATION|
| SERVICE    | | SERVICE    | |  |SERVICE | | SERVICE  | | SERVICE    |
| :3002      | | :3003      | |  | :3004  | | :3005    | | :3006      |
|            | |            | |  |        | |          | |            |
| auth_db    | | core_db    | |  |booking_| | payment_ | | notific._  |
| (PostgreSQL| | (PostgreSQL| |  |db      | | db       | | db         |
+-------+----+ +----+-------+ +--+--+-----+ +----+-----+ +-----+------+
        |           |               |             |             |
        v           v               v             v             v
+-------------------------------------------------------------------+
|                        MESSAGE BROKER                              |
|                        RabbitMQ :5672                              |
|                                                                    |
|   Exchanges:                                                       |
|   +------------------+  +------------------+  +------------------+ |
|   |  auth.events     |  |  booking.events  |  |  payment.events  | |
|   +------------------+  +------------------+  +------------------+ |
|   +------------------+  +------------------+                      |
|   |  core.events     |  |  notif.commands  |                      |
|   +------------------+  +------------------+                      |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                        CACHE LAYER                                 |
|                        Redis :6379                                 |
|                                                                    |
|   +----------+  +-----------+  +-------------+  +--------------+  |
|   | Sessions |  | Availab.  |  | Rate Limit  |  | Refresh      |  |
|   | Cache    |  | Cache     |  | Counters    |  | Token Black. |  |
|   +----------+  +-----------+  +-------------+  +--------------+  |
+-------------------------------------------------------------------+
```

---

## 3. API Gateway

### Responsabilidades

El API Gateway es el unico punto de entrada para todas las solicitudes del frontend. Sus responsabilidades son:

1. **Enrutamiento**: Dirige cada solicitud al microservicio correspondiente segun el path
2. **Autenticacion**: Valida el JWT en cada solicitud (excepto rutas publicas)
3. **Resolucion de Tenant**: Extrae el subdominio del host header y resuelve el `businessId`
4. **Rate Limiting**: Limita solicitudes por IP y por usuario
5. **Transformacion**: Agrega headers comunes (X-Request-Id, X-Business-Id, X-User-Id)
6. **Manejo de Errores**: Formato consistente de errores desde cualquier servicio
7. **Logging**: Registra cada solicitud con correlation ID para trazabilidad
8. **CORS**: Gestiona las politicas de Cross-Origin Resource Sharing

### Tabla de Enrutamiento

| Patron de Ruta                      | Servicio Destino | Autenticacion                 | Roles Permitidos                                 |
| ----------------------------------- | ---------------- | ----------------------------- | ------------------------------------------------ |
| `POST /api/v1/auth/login`           | Auth             | No                            | Publico                                          |
| `POST /api/v1/auth/register`        | Auth             | No                            | Publico                                          |
| `POST /api/v1/auth/refresh`         | Auth             | No (refresh token)            | Publico                                          |
| `POST /api/v1/auth/forgot-password` | Auth             | No                            | Publico                                          |
| `POST /api/v1/auth/reset-password`  | Auth             | No (token)                    | Publico                                          |
| `POST /api/v1/auth/logout`          | Auth             | Si                            | Todos                                            |
| `GET /api/v1/auth/me`               | Auth             | Si                            | Todos                                            |
| `* /api/v1/businesses/*`            | Core             | Si                            | SUPER_ADMIN                                      |
| `* /api/v1/branches/*`              | Core             | Si                            | OWNER, ADMIN                                     |
| `* /api/v1/professionals/*`         | Core             | Si                            | OWNER, ADMIN, PROFESSIONAL                       |
| `* /api/v1/services/*`              | Core             | Si                            | OWNER, ADMIN                                     |
| `* /api/v1/clients/*`               | Core             | Si                            | OWNER, ADMIN, RECEPTIONIST                       |
| `* /api/v1/appointments/*`          | Booking          | Si                            | OWNER, ADMIN, PROFESSIONAL, RECEPTIONIST, CLIENT |
| `* /api/v1/availability/*`          | Booking          | Si                            | OWNER, ADMIN, PROFESSIONAL                       |
| `* /api/v1/payments/*`              | Payment          | Si                            | OWNER, ADMIN, RECEPTIONIST                       |
| `* /api/v1/invoices/*`              | Payment          | Si                            | OWNER, ADMIN                                     |
| `* /api/v1/cash-sessions/*`         | Payment          | Si                            | OWNER, ADMIN, RECEPTIONIST                       |
| `* /api/v1/notifications/*`         | Notification     | Si                            | Todos                                            |
| `* /api/v1/marketplace/*`           | Marketplace      | No                            | Publico                                          |
| `* /api/v1/profiles/*`              | Marketplace      | No                            | Publico                                          |
| `* /api/v1/reviews/*`               | Marketplace      | Si (escritura) / No (lectura) | CLIENT                                           |
| `* /api/v1/analytics/*`             | Analytics        | Si                            | OWNER, ADMIN, SUPER_ADMIN                        |

### Flujo de una Solicitud

```
Cliente -> Nginx (SSL) -> API Gateway
                              |
                              +-> 1. Generar correlation ID
                              +-> 2. Verificar Rate Limit (Redis)
                              +-> 3. Validar JWT (si ruta protegida)
                              +-> 4. Resolver tenant (subdominio -> businessId)
                              +-> 5. Inyectar headers (X-Request-Id, X-Business-Id, X-User-Id, X-User-Role)
                              +-> 6. Enrutar al servicio correspondiente
                              +-> 7. Recibir respuesta y formatear errores si aplica
                              +-> 8. Registrar log de la solicitud
                              |
                              v
                          Respuesta al Cliente
```

---

## 4. Comunicacion entre Servicios

### 4.1 Comunicacion Sincrona (REST)

Se utiliza para operaciones donde se necesita una respuesta inmediata del servicio destino.

**Patron**: Request-Response via HTTP/REST interno

**Caracteristicas**:

- Timeout: 5 segundos por defecto, 10 segundos para consultas complejas
- Retry: 2 reintentos con backoff exponencial para errores transitorios (5xx)
- Circuit Breaker: Se abre despues de 5 fallos consecutivos, se cierra tras 30 segundos
- Idempotencia: Los endpoints de escritura deben ser idempotentes (usar idempotency key)

**Ejemplo**: El Booking Service consulta al Core Service para validar que un profesional existe y pertenece al negocio.

```
Booking Service -> GET http://core:3003/api/internal/v1/professionals/{id}
Headers:
  X-Request-Id: uuid
  X-Service-Name: booking
  X-Business-Id: uuid
```

### 4.2 Comunicacion Asincrona (RabbitMQ)

Se utiliza para eventos de dominio que no requieren respuesta inmediata y para desacoplar servicios.

**Patron**: Event-Driven con Exchange tipo Topic

**Caracteristicas**:

- Los mensajes son persistentes (durable queues)
- Confirmacion de recepcion (ack/nack)
- Dead Letter Queue para mensajes fallidos
- Orden garantizado dentro de una misma routing key
- Serializacion JSON con schema versionado

**Formato del Evento**:

```json
{
  "eventId": "uuid",
  "eventType": "appointment.created",
  "eventVersion": "1",
  "timestamp": "2025-01-15T10:30:00Z",
  "source": "booking-service",
  "correlationId": "uuid",
  "data": {
    "appointmentId": "uuid",
    "businessId": "uuid",
    "clientId": "uuid",
    "professionalId": "uuid",
    "services": [
      {
        "serviceId": "uuid",
        "name": "Corte clasico",
        "price": 25000,
        "duration": 30
      }
    ],
    "startTime": "2025-01-20T14:00:00Z",
    "status": "PENDING"
  }
}
```

---

## 5. Flujo de Autenticacion

### 5.1 Registro

```
1. Cliente envia POST /api/v1/auth/register
   { email, password, name, role: "CLIENT" }

2. Auth Service valida datos (Zod schema)
   - Email unico en la plataforma
   - Password cumple requisitos

3. Auth Service hashea password (bcrypt, 12 rounds)

4. Auth Service crea usuario en auth_db
   - Estado: PENDING_VERIFICATION (si verificacion de email activa)
   - Estado: ACTIVE (si verificacion no requerida en MVP)

5. Auth Service genera token de verificacion y publica evento
   -> Exchange: auth.events, Routing Key: user.registered

6. Notification Service consume el evento y envia email de bienvenida

7. Respuesta al cliente: { user, accessToken, refreshToken }
```

### 5.2 Login

```
1. Cliente envia POST /api/v1/auth/login
   { email, password }

2. Auth Service busca usuario por email
   - Verificar estado activo
   - Verificar intentos fallidos (rate limit)

3. Auth Service compara password (bcrypt.compare)

4. Si exitoso:
   a. Generar access token (JWT, RS256, TTL: 15 min)
      Payload: { sub: userId, email, role, memberships: [{ businessId, role }] }
   b. Generar refresh token (JWT, HS256, TTL: 7 dias)
      Almacenar en Redis con clave: refresh:{userId}:{tokenId}
   c. Resetear contador de intentos fallidos
   d. Publicar evento: auth.events / user.loggedIn

5. Si fallido:
   a. Incrementar contador de intentos fallidos en Redis
   b. Si alcanza 5 intentos: bloquear por 15 minutos
   c. Publicar evento: auth.events / user.loginFailed

6. Respuesta: { accessToken, refreshToken, user }
```

### 5.3 Validacion de Token en API Gateway

```
1. Request llega con header: Authorization: Bearer <access_token>

2. API Gateway extrae el token

3. Verifica firma (RS256 con clave publica)
   - Verifica expiracion
   - Verifica issuer (beautyspot)
   - Verifica audience

4. Extrae payload: { sub, email, role, memberships }

5. Verifica si el token esta en lista negra (Redis SET: token_blacklist)
   - Solo tokens invalidados por logout

6. Inyecta en headers downstream:
   X-User-Id: {sub}
   X-User-Email: {email}
   X-User-Role: {role}
   X-User-Memberships: JSON codificado en base64

7. Continua con el enrutamiento
```

### 5.4 Refresh Token

```
1. Cliente envia POST /api/v1/auth/refresh
   { refreshToken }

2. Auth Service verifica refresh token
   - Firma valida
   - No expirado
   - Existe en Redis (refresh:{userId}:{tokenId})

3. Genera nuevo access token y nuevo refresh token (rotacion)

4. Elimina refresh token anterior de Redis

5. Almacena nuevo refresh token en Redis

6. Respuesta: { accessToken, refreshToken }
```

---

## 6. Estrategia Multi-Tenant

### 6.1 Modelo de Multi-Tenancy

BeautySpot utiliza **multi-tenancy logico** (base de datos compartida con aislamiento por columna `businessId`) dentro de cada servicio. Cada servicio tiene su propia base de datos, pero dentro de cada base de datos, los datos de diferentes negocios coexisten y se separan mediante la columna `businessId`.

**Por que no una base de datos por negocio?**

- El overhead de gestionar miles de bases de datos es prohibitivo en MVP
- Las migraciones se simplifican (una por servicio, no una por negocio)
- Los costos de infraestructura se reducen drasticamente
- Se puede migrar a database-per-tenant posteriormente si es necesario

### 6.2 Resolucion de Tenant

```
1. Request llega al API Gateway con Host: elite-barbershop.beautyspot.co

2. API Gateway extrae el subdominio: "elite-barbershop"

3. Consulta cache Redis (clave: tenant:slug:{slug})
   - Si existe: obtiene businessId
   - Si no existe: consulta al Core Service GET /api/internal/v1/tenants/resolve?slug=elite-barbershop

4. Core Service busca en core_db: SELECT id FROM businesses WHERE slug = 'elite-barbershop' AND active = true

5. Si encontrado: cachea en Redis (TTL: 1 hora) y retorna businessId

6. API Gateway inyecta header: X-Business-Id: {businessId}

7. Todos los servicios downstream filtran por businessId en cada query
```

### 6.3 Filtro Obligatorio de businessId

Cada servicio aplica un **guard de tenant** que verifica que:

1. El header `X-Business-Id` esta presente en toda solicitud que no sea global (SUPER_ADMIN)
2. El usuario autenticado tiene membresia activa en el negocio solicitado
3. Todas las queries Prisma incluyen `where: { businessId }` para entidades de negocio

**Implementacion en NestJS**:

```typescript
// Tenant Guard - aplicado globalmente excepto en rutas publicas
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const businessId = request.headers['x-business-id'];
    const userRole = request.headers['x-user-role'];

    // SUPER_ADMIN no requiere businessId para operaciones globales
    if (userRole === 'SUPER_ADMIN' && !businessId) {
      return true;
    }

    if (!businessId) {
      throw new ForbiddenException('Business context required');
    }

    // Verificar membresia del usuario en el negocio
    const memberships = JSON.parse(
      Buffer.from(request.headers['x-user-memberships'], 'base64').toString()
    );
    const hasAccess = memberships.some(m => m.businessId === businessId);
    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this business');
    }

    request.businessId = businessId;
    return true;
  }
}
```

### 6.4 Entidades Globales vs de Negocio

| Tipo       | Ejemplos                                                             | businessId  | Aislamiento                      |
| ---------- | -------------------------------------------------------------------- | ----------- | -------------------------------- |
| Global     | users, memberships                                                   | No aplica   | Solo SUPER_ADMIN                 |
| De negocio | businesses, professionals, services, appointments, payments, clients | Obligatorio | Filtrado por businessId          |
| Hibrida    | notifications                                                        | Opcional    | Filtrado por userId o businessId |

---

## 7. Arquitectura Event-Driven

### 7.1 Catalogo de Eventos

#### Auth Events (Exchange: `auth.events`)

| Evento             | Routing Key               | Publicado por | Consumido por           | Descripcion              |
| ------------------ | ------------------------- | ------------- | ----------------------- | ------------------------ |
| user.registered    | `auth.user.registered`    | Auth          | Notification, Analytics | Nuevo usuario registrado |
| user.loggedIn      | `auth.user.loggedIn`      | Auth          | Analytics               | Inicio de sesion         |
| user.passwordReset | `auth.user.passwordReset` | Auth          | Notification            | Contrasena restablecida  |
| user.emailVerified | `auth.user.emailVerified` | Auth          | Analytics               | Email verificado         |

#### Core Events (Exchange: `core.events`)

| Evento                   | Routing Key                     | Publicado por | Consumido por                        | Descripcion                        |
| ------------------------ | ------------------------------- | ------------- | ------------------------------------ | ---------------------------------- |
| business.created         | `core.business.created`         | Core          | Notification, Marketplace, Analytics | Nuevo negocio registrado           |
| business.updated         | `core.business.updated`         | Core          | Marketplace, Notification            | Datos del negocio actualizados     |
| business.deactivated     | `core.business.deactivated`     | Core          | Notification, Marketplace            | Negocio desactivado                |
| professional.created     | `core.professional.created`     | Core          | Notification, Analytics              | Nuevo profesional registrado       |
| professional.updated     | `core.professional.updated`     | Core          | Marketplace                          | Datos del profesional actualizados |
| professional.deactivated | `core.professional.deactivated` | Core          | Booking, Marketplace                 | Profesional desactivado            |
| service.created          | `core.service.created`          | Core          | Marketplace                          | Nuevo servicio creado              |
| service.updated          | `core.service.updated`          | Core          | Marketplace                          | Servicio actualizado               |
| service.deactivated      | `core.service.deactivated`      | Core          | Marketplace                          | Servicio desactivado               |
| client.created           | `core.client.created`           | Core          | Analytics                            | Nuevo cliente registrado           |

#### Booking Events (Exchange: `booking.events`)

| Evento                  | Routing Key                       | Publicado por  | Consumido por                    | Descripcion                |
| ----------------------- | --------------------------------- | -------------- | -------------------------------- | -------------------------- |
| appointment.created     | `booking.appointment.created`     | Booking        | Notification, Analytics          | Nueva cita creada          |
| appointment.confirmed   | `booking.appointment.confirmed`   | Booking        | Notification, Analytics          | Cita confirmada            |
| appointment.cancelled   | `booking.appointment.cancelled`   | Booking        | Notification, Analytics          | Cita cancelada             |
| appointment.completed   | `booking.appointment.completed`   | Booking        | Notification, Analytics, Payment | Cita completada            |
| appointment.noShow      | `booking.appointment.noShow`      | Booking        | Notification, Analytics          | Cliente no asistio         |
| appointment.rescheduled | `booking.appointment.rescheduled` | Booking        | Notification, Analytics          | Cita reagendada            |
| availability.updated    | `booking.availability.updated`    | Booking        | Analytics                        | Disponibilidad actualizada |
| reminder.24h            | `booking.reminder.24h`            | Booking (cron) | Notification                     | Recordatorio 24h antes     |
| reminder.1h             | `booking.reminder.1h`             | Booking (cron) | Notification                     | Recordatorio 1h antes      |

#### Payment Events (Exchange: `payment.events`)

| Evento             | Routing Key                  | Publicado por | Consumido por           | Descripcion             |
| ------------------ | ---------------------------- | ------------- | ----------------------- | ----------------------- |
| payment.registered | `payment.payment.registered` | Payment       | Notification, Analytics | Pago registrado         |
| invoice.generated  | `payment.invoice.generated`  | Payment       | Notification            | Factura/recibo generado |
| cashSession.opened | `payment.cashSession.opened` | Payment       | Analytics               | Caja abierta            |
| cashSession.closed | `payment.cashSession.closed` | Payment       | Analytics               | Caja cerrada            |

#### Notification Commands (Exchange: `notif.commands`)

| Comando    | Routing Key        | Publicado por      | Consumido por | Descripcion               |
| ---------- | ------------------ | ------------------ | ------------- | ------------------------- |
| send.email | `notif.send.email` | Cualquier servicio | Notification  | Enviar email              |
| send.push  | `notif.send.push`  | Cualquier servicio | Notification  | Enviar push (post-MVP)    |
| send.inApp | `notif.send.inApp` | Cualquier servicio | Notification  | Crear notificacion in-app |

#### Marketplace Events (Exchange: `marketplace.events`)

| Evento           | Routing Key                    | Publicado por | Consumido por                 | Descripcion         |
| ---------------- | ------------------------------ | ------------- | ----------------------------- | ------------------- |
| review.created   | `marketplace.review.created`   | Marketplace   | Notification, Core, Analytics | Nueva resena creada |
| review.moderated | `marketplace.review.moderated` | Marketplace   | Notification                  | Resena moderada     |

### 7.2 Topologia de RabbitMQ

```
                        +-----------------------+
                        |   auth.events (Topic)  |
                        +-----------+-----------+
                                    |
                  +-----------------+-----------------+
                  |                 |                   |
          +-------v------+  +------v-------+  +-------v------+
          | notification |  |  analytics   |  |  marketplace |
          |   .queue     |  |   .queue     |  |   .queue     |
          +--------------+  +--------------+  +--------------+

                        +-----------------------+
                        |  core.events (Topic)   |
                        +-----------+-----------+
                                    |
                  +-----------------+-----------------+
                  |                 |                   |
          +-------v------+  +------v-------+  +-------v------+
          | notification |  |  analytics   |  |   booking    |
          |   .queue     |  |   .queue     |  |   .queue     |
          +--------------+  +--------------+  +--------------+

                        +-----------------------+
                        | booking.events (Topic) |
                        +-----------+-----------+
                                    |
            +-----------+-----------+-----------+-----------+
            |           |           |           |           |
    +-------v--+ +-----v----+ +---v------+ +--v--------+ +-v-------+
    | notif.   | | analytic.| | payment  | | notif.    | | notif.  |
    | queue    | | queue    | | queue    | | queue     | | queue   |
    +----------+ +----------+ +----------+ +-----------+ +---------+
```

---

## 8. Patron Database-per-Service

### 8.1 Distribucion de Bases de Datos

```
+------------------+     +------------------+     +------------------+
|    auth_db       |     |    core_db       |     |   booking_db     |
|                  |     |                  |     |                  |
| - users          |     | - businesses     |     | - appointments   |
| - memberships    |     | - branches       |     | - appointment_   |
| - password_      |     | - professionals  |     |   services       |
|   resets         |     | - services       |     | - availabilities |
| - audit_logs     |     | - professional_  |     | - blocked_slots  |
|                  |     |   services       |     |                  |
| Puerto: 5432     |     | - clients        |     | Puerto: 5434     |
| DB: beautyspot_  |     | - business_hours |     | DB: beautyspot_  |
|      auth        |     | - business_config|     |      booking     |
+------------------+     +------------------+     +------------------+

+------------------+     +------------------+     +------------------+
|   payment_db     |     | notification_db  |     |  marketplace_db  |
|                  |     |                  |     |                  |
| - payments       |     | - notifications  |     | - business_      |
| - invoices       |     | - notification_  |     |   profiles       |
| - invoice_items  |     |   preferences    |     | - reviews        |
| - cash_sessions  |     |                  |     |                  |
| - cash_movements |     | Puerto: 5437     |     | Puerto: 5438     |
|                  |     | DB: beautyspot_  |     | DB: beautyspot_  |
| Puerto: 5436     |     |      notif       |     |      marketplace |
| DB: beautyspot_  |     +------------------+     +------------------+
|      payment     |
+------------------+     +------------------+
                         |  analytics_db    |
                         |                  |
                         | - daily_metrics  |
                         | - professional_  |
                         |   metrics        |
                         |                  |
                         | Puerto: 5439     |
                         | DB: beautyspot_  |
                         |      analytics   |
                         +------------------+
```

### 8.2 Reglas de Propiedad de Datos

| Servicio     | Es dueno de                                                       | Lee de otros servicios via                                                               |
| ------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Auth         | users, memberships, password_resets, audit_logs                   | API interna de Core (para validar negocio)                                               |
| Core         | businesses, branches, professionals, services, clients            | API interna de Auth (para datos basicos de usuario)                                      |
| Booking      | appointments, appointment_services, availabilities, blocked_slots | API interna de Core (profesionales, servicios), API de Auth (usuarios)                   |
| Payment      | payments, invoices, invoice_items, cash_sessions, cash_movements  | Eventos de Booking (cita completada), API de Core (negocio, cliente)                     |
| Notification | notifications, notification_preferences                           | Eventos de todos los servicios                                                           |
| Marketplace  | business_profiles, reviews                                        | API interna de Core (negocio, servicios, profesionales), API de Booking (disponibilidad) |
| Analytics    | daily_metrics, professional_metrics                               | Eventos de todos los servicios, API de Payment/Core/Booking                              |

### 8.3 Principio de No-Compartir Base de Datos

**Regla estricta**: Ningun servicio puede conectarse directamente a la base de datos de otro servicio. La unica forma de acceder a datos de otro servicio es:

1. **Sincrona**: Llamada REST a la API interna del servicio dueno de los datos
2. **Asincrona**: Consumir eventos que contienen los datos necesarios
3. **Duplicacion controlada**: El servicio consumidor puede almacenar datos duplicados de solo lectura que recibe via eventos (ej: Analytics almacena copias de datos para reportes)

---

## 9. Estrategia de Manejo de Errores

### 9.1 Formato de Error Estandarizado

Todas las respuestas de error siguen el mismo formato, independientemente del servicio:

```json
{
  "success": false,
  "error": {
    "code": "APPOINTMENT_SLOT_CONFLICT",
    "message": "El horario seleccionado ya no esta disponible",
    "details": [
      {
        "field": "startTime",
        "message": "Conflicto con cita existente: 14:00 - 14:30"
      }
    ],
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "uuid-correlation-id",
    "path": "/api/v1/appointments"
  }
}
```

### 9.2 Codigos de Error HTTP

| Codigo | Uso                          | Ejemplo                                                 |
| ------ | ---------------------------- | ------------------------------------------------------- |
| 400    | Error de validacion de datos | Email con formato invalido                              |
| 401    | No autenticado               | Token expirado o ausente                                |
| 403    | No autorizado (sin permisos) | Recepcionista intentando acceder a configuracion global |
| 404    | Recurso no encontrado        | Profesional con ID no existente                         |
| 409    | Conflicto de estado          | Crear cita en slot ya ocupado                           |
| 422    | Error de negocio             | Cancelar cita dentro del tiempo minimo                  |
| 429    | Rate limit excedido          | Mas de 100 solicitudes por minuto                       |
| 500    | Error interno del servidor   | Error inesperado en la base de datos                    |
| 503    | Servicio no disponible       | Servicio dependiente no responde                        |

### 9.3 Codigos de Error de Negocio

| Dominio | Codigo                       | Descripcion                              |
| ------- | ---------------------------- | ---------------------------------------- |
| Auth    | `AUTH_INVALID_CREDENTIALS`   | Email o contrasena incorrectos           |
| Auth    | `AUTH_ACCOUNT_LOCKED`        | Cuenta bloqueada por intentos fallidos   |
| Auth    | `AUTH_TOKEN_EXPIRED`         | Token JWT expirado                       |
| Auth    | `AUTH_TOKEN_INVALID`         | Token JWT invalido o malformado          |
| Auth    | `AUTH_EMAIL_TAKEN`           | Email ya registrado                      |
| Booking | `BOOKING_SLOT_UNAVAILABLE`   | Slot no disponible                       |
| Booking | `BOOKING_SLOT_CONFLICT`      | Conflicto con cita existente             |
| Booking | `BOOKING_INVALID_TRANSITION` | Transicion de estado no permitida        |
| Booking | `BOOKING_CANCEL_TOO_LATE`    | Tiempo minimo de cancelacion excedido    |
| Payment | `PAYMENT_EXCEEDS_BALANCE`    | Monto excede saldo pendiente             |
| Payment | `PAYMENT_INVALID_METHOD`     | Metodo de pago no aceptado               |
| Payment | `CASH_SESSION_ALREADY_OPEN`  | Ya existe caja abierta para la sucursal  |
| Core    | `BUSINESS_SLUG_TAKEN`        | Slug ya en uso por otro negocio          |
| Core    | `DUPLICATE_RESOURCE`         | Recurso duplicado (email, telefono)      |
| Tenant  | `TENANT_NOT_FOUND`           | Negocio no encontrado para el subdominio |
| Tenant  | `TENANT_SUSPENDED`           | Negocio suspendido                       |
| Tenant  | `TENANT_ACCESS_DENIED`       | Usuario sin acceso al negocio            |

### 9.4 Circuit Breaker

Cada servicio implementa un Circuit Breaker para llamadas a otros servicios:

```
Estado: CLOSED (normal)
  - Todas las solicitudes pasan
  - Si 5 fallos consecutivos -> cambiar a OPEN

Estado: OPEN (bloqueado)
  - Todas las solicitudes fallan inmediatamente con error 503
  - Despues de 30 segundos -> cambiar a HALF_OPEN

Estado: HALF_OPEN (prueba)
  - Se permite 1 solicitud de prueba
  - Si exitosa -> cambiar a CLOSED
  - Si falla -> cambiar a OPEN
```

---

## 10. Convenciones de Diseno de API

### 10.1 Principios REST

- Los sustantivos en plural para recursos: `/api/v1/appointments`, `/api/v1/professionals`
- Acciones sobre recursos via metodos HTTP: GET (leer), POST (crear), PUT (reemplazar), PATCH (actualizar), DELETE (eliminar)
- Acciones especificas via sub-rutas: `POST /api/v1/appointments/{id}/confirm`, `POST /api/v1/appointments/{id}/cancel`

### 10.2 Versionado

- Prefijo de version en la URL: `/api/v1/`, `/api/v2/`
- La version actual es `v1`
- Cambios breaking requieren nueva version

### 10.3 Paginacion

Se utiliza paginacion basada en cursor para colecciones grandes:

**Request**:

```
GET /api/v1/appointments?limit=20&cursor=eyJpZCI6IjEyMyJ9
```

**Response**:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "hasMore": true,
    "nextCursor": "eyJpZCI6IjE0MCJ9",
    "prevCursor": "eyJpZCI6IjEyMyJ9"
  }
}
```

### 10.4 Filtrado y Ordenamiento

```
GET /api/v1/appointments?status=CONFIRMED&professionalId=uuid&date=2025-01-20&sortBy=startTime&sortOrder=asc
```

**Filtros soportados**:

- Igualdad: `?status=CONFIRMED`
- Rango: `?dateFrom=2025-01-01&dateTo=2025-01-31`
- Inclusion: `?status=CONFIRMED,PENDING`
- Busqueda: `?search=juan`

### 10.5 Formato de Respuesta Exitosa

**Coleccion**:

```json
{
  "success": true,
  "data": [...],
  "pagination": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

**Recurso unico**:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

---

## 11. Estructura de Carpetas del Monorepo

```
beautyspot/
|
+-- .github/
|   +-- workflows/
|       +-- ci.yml                    # Pipeline de CI
|       +-- deploy.yml                # Pipeline de deploy
|
+-- .husky/
|   +-- pre-commit                    # Lint + format en commit
|
+-- apps/
|   +-- api-gateway/                  # Servicio: API Gateway
|   |   +-- src/
|   |   |   +-- auth/                 # Auth proxy y validacion JWT
|   |   |   +-- proxy/                # Proxy routes a servicios
|   |   |   +-- tenant/               # Resolucion de tenant
|   |   |   +-- rate-limit/           # Rate limiting
|   |   |   +-- common/               # Guards, interceptors, filters
|   |   |   +-- config/               # Configuracion del servicio
|   |   |   +-- health/               # Health check endpoint
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- nest-cli.json
|   |   +-- tsconfig.json
|   |   +-- package.json
|   |
|   +-- auth-service/                 # Servicio: Autenticacion
|   |   +-- src/
|   |   |   +-- auth/
|   |   |   |   +-- auth.controller.ts
|   |   |   |   +-- auth.service.ts
|   |   |   |   +-- auth.module.ts
|   |   |   +-- users/
|   |   |   |   +-- users.controller.ts
|   |   |   |   +-- users.service.ts
|   |   |   |   +-- users.module.ts
|   |   |   +-- memberships/
|   |   |   +-- password/
|   |   |   +-- audit/
|   |   |   +-- strategies/           # Passport strategies (JWT, Google OAuth)
|   |   |   +-- guards/               # Auth guards
|   |   |   +-- decorators/           # Custom decorators (@CurrentUser, @Roles)
|   |   |   +-- events/               # Publicadores de eventos RabbitMQ
|   |   |   +-- prisma/               # Prisma schema y service
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- nest-cli.json
|   |   +-- tsconfig.json
|   |   +-- package.json
|   |
|   +-- core-service/                 # Servicio: Core (Negocios, Profesionales, etc.)
|   |   +-- src/
|   |   |   +-- businesses/
|   |   |   |   +-- businesses.controller.ts
|   |   |   |   +-- businesses.service.ts
|   |   |   |   +-- businesses.module.ts
|   |   |   |   +-- dto/
|   |   |   +-- branches/
|   |   |   +-- professionals/
|   |   |   +-- services/
|   |   |   +-- clients/
|   |   |   +-- events/
|   |   |   +-- prisma/
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- package.json
|   |
|   +-- booking-service/              # Servicio: Reservas
|   |   +-- src/
|   |   |   +-- appointments/
|   |   |   |   +-- appointments.controller.ts
|   |   |   |   +-- appointments.service.ts
|   |   |   |   +-- appointments.module.ts
|   |   |   |   +-- dto/
|   |   |   |   +-- validators/
|   |   |   +-- availability/
|   |   |   +-- blocked-slots/
|   |   |   +-- reminders/            # Cron jobs para recordatorios
|   |   |   +-- events/
|   |   |   +-- prisma/
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- package.json
|   |
|   +-- payment-service/              # Servicio: Pagos
|   |   +-- src/
|   |   |   +-- payments/
|   |   |   +-- invoices/
|   |   |   +-- cash-register/
|   |   |   |   +-- cash-sessions/
|   |   |   |   +-- cash-movements/
|   |   |   +-- events/
|   |   |   +-- prisma/
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- package.json
|   |
|   +-- notification-service/         # Servicio: Notificaciones
|   |   +-- src/
|   |   |   +-- notifications/
|   |   |   +-- preferences/
|   |   |   +-- email/                # Proveedor de email (Resend/SES)
|   |   |   +-- push/                 # Proveedor push (post-MVP)
|   |   |   +-- templates/            # Templates de email
|   |   |   +-- events/               # Consumidores de eventos RabbitMQ
|   |   |   +-- prisma/
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- package.json
|   |
|   +-- marketplace-service/          # Servicio: Marketplace
|   |   +-- src/
|   |   |   +-- profiles/             # Perfiles publicos de negocio
|   |   |   +-- search/               # Busqueda
|   |   |   +-- reviews/
|   |   |   +-- events/
|   |   |   +-- prisma/
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- package.json
|   |
|   +-- analytics-service/            # Servicio: Analitica
|   |   +-- src/
|   |   |   +-- dashboard/
|   |   |   +-- reports/
|   |   |   +-- metrics/
|   |   |   |   +-- daily-metrics/
|   |   |   |   +-- professional-metrics/
|   |   |   +-- jobs/                 # Cron jobs de calculo de metricas
|   |   |   +-- events/               # Consumidores de eventos
|   |   |   +-- prisma/
|   |   |   |   +-- schema.prisma
|   |   |   |   +-- migrations/
|   |   |   +-- common/
|   |   |   +-- config/
|   |   |   +-- app.module.ts
|   |   |   +-- main.ts
|   |   +-- test/
|   |   +-- package.json
|   |
|   +-- web-dashboard/                # Frontend: Dashboard (Next.js)
|   |   +-- src/
|   |   |   +-- app/
|   |   |   |   +-- (auth)/           # Login, register, forgot-password
|   |   |   |   +-- (dashboard)/      # Dashboard protegido por rol
|   |   |   |   |   +-- admin/
|   |   |   |   |   +-- appointments/
|   |   |   |   |   +-- calendar/
|   |   |   |   |   +-- clients/
|   |   |   |   |   +-- professionals/
|   |   |   |   |   +-- services/
|   |   |   |   |   +-- payments/
|   |   |   |   |   +-- analytics/
|   |   |   |   |   +-- settings/
|   |   |   +-- components/
|   |   |   +-- hooks/
|   |   |   +-- lib/
|   |   |   +-- types/
|   |   +-- public/
|   |   +-- next.config.js
|   |   +-- package.json
|   |
|   +-- web-marketplace/              # Frontend: Marketplace (Next.js)
|   |   +-- src/
|   |   |   +-- app/
|   |   |   |   +-- page.tsx          # Home del marketplace
|   |   |   |   +-- search/
|   |   |   |   +-- business/[slug]/  # Perfil publico del negocio
|   |   |   +-- components/
|   |   |   +-- hooks/
|   |   |   +-- lib/
|   |   +-- package.json
|   |
|   +-- web-landing/                  # Frontend: Landing page
|       +-- src/
|       +-- package.json
|
+-- packages/
|   +-- shared-types/                 # Tipos TypeScript compartidos
|   |   +-- src/
|   |   |   +-- auth.ts
|   |   |   +-- booking.ts
|   |   |   +-- core.ts
|   |   |   +-- payment.ts
|   |   |   +-- notification.ts
|   |   |   +-- marketplace.ts
|   |   |   +-- analytics.ts
|   |   |   +-- events.ts             # Tipos de eventos
|   |   |   +-- api.ts                # Tipos de request/response
|   |   |   +-- index.ts
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |
|   +-- shared-utils/                 # Utilidades compartidas
|   |   +-- src/
|   |   |   +-- date.ts               # Formateo de fechas
|   |   |   +-- currency.ts           # Formateo de moneda
|   |   |   +-- validation.ts         # Esquemas Zod compartidos
|   |   |   +-- pagination.ts         # Helpers de paginacion
|   |   |   +-- slug.ts               # Generacion de slugs
|   |   |   +-- index.ts
|   |   +-- package.json
|   |   +-- tsconfig.json
|   |
|   +-- database/                     # Prisma shared config
|   |   +-- base-schema.prisma        # Campos base (id, timestamps, soft delete)
|   +-- eslint-config/                # ESLint config compartida
|   +-- prettier-config/              # Prettier config compartida
|   +-- tsconfig/                     # TypeScript configs compartidos
|       +-- base.json
|       +-- nestjs.json
|       +-- nextjs.json
|
+-- infra/
|   +-- docker/
|   |   +-- docker-compose.yml        # Compose de desarrollo
|   |   +-- docker-compose.test.yml   # Compose de testing
|   |   +-- api-gateway.Dockerfile
|   |   +-- auth-service.Dockerfile
|   |   +-- core-service.Dockerfile
|   |   +-- booking-service.Dockerfile
|   |   +-- payment-service.Dockerfile
|   |   +-- notification-service.Dockerfile
|   |   +-- marketplace-service.Dockerfile
|   |   +-- analytics-service.Dockerfile
|   |   +-- nginx/
|   |   |   +-- nginx.conf
|   |   |   +-- ssl/
|   |   +-- init-scripts/
|   |       +-- 01-create-databases.sql  # Crear BDs en PostgreSQL
|   |
|   +-- k8s/                          # Kubernetes manifests (produccion)
|       +-- base/
|       +-- overlays/
|           +-- dev/
|           +-- staging/
|           +-- production/
|
+-- docs/                             # Documentacion del proyecto
|   +-- 01-REQUISITOS.md
|   +-- 02-MODULOS.md
|   +-- 03-HISTORIAS-USUARIO.md
|   +-- 04-ARQUITECTURA.md
|   +-- 05-BASE-DATOS.md
|
+-- turbo.json                        # Configuracion de Turborepo
+-- pnpm-workspace.yaml               # Workspace de pnpm
+-- package.json                       # Package.json raiz (scripts, devDeps)
+-- tsconfig.base.json                # TypeScript config base
+-- .env.example                      # Variables de entorno ejemplo
+-- .eslintrc.js                       # ESLint raiz
+-- .prettierrc                        # Prettier raiz
+-- .gitignore
+-- README.md
```

---

## 12. Health Checks y Monitoreo

### 12.1 Health Check Endpoints

Cada servicio expone:

```
GET /health/live       # Liveness: el proceso esta corriendo
GET /health/ready      # Readiness: listo para recibir trafico
GET /health/detail     # Detalle: estado de dependencias
```

**Ejemplo de respuesta /health/detail**:

```json
{
  "status": "ok",
  "service": "booking-service",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": { "status": "ok", "latency": "5ms" },
    "redis": { "status": "ok", "latency": "1ms" },
    "rabbitmq": { "status": "ok", "latency": "2ms" },
    "coreService": { "status": "ok", "latency": "45ms" }
  }
}
```

### 12.2 Logging Estructurado

Todos los logs son en formato JSON:

```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "info",
  "service": "booking-service",
  "correlationId": "uuid",
  "userId": "uuid",
  "businessId": "uuid",
  "message": "Appointment created",
  "metadata": {
    "appointmentId": "uuid",
    "professionalId": "uuid",
    "duration": 45
  }
}
```

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
**Rationale**: NestJS provee una arquitectura modular con DI, decorators, guards, interceptors, y excelente integracion con Prisma, RabbitMQ, y Redis. La curva de aprendizaje es baja para desarrolladores familiarizados con Angular o TypeScript.

### ADR-005: Next.js para el frontend

**Contexto**: El frontend necesita SSR para perfiles publicos (SEO) y SPA para el dashboard.
**Decision**: Next.js 14 con App Router.
**Rationale**: Next.js permite SSR para el marketplace y perfiles publicos, y SPA para el dashboard. El App Router con React Server Components optimiza la carga inicial y el SEO.
