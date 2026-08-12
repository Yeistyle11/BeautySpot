# Referencia de la API — BeautySpot

Referencia completa de la API HTTP de BeautySpot: **41 controladores y 170 rutas**
repartidos en 8 microservicios NestJS, todos accesibles a través del API Gateway.

Este documento se genera a partir de los controladores reales (`services/*/src/**/*.controller.ts`).
Si una ruta no aparece aquí, no existe.

## Índice

- [Convenciones](#convenciones)
  - [URL base y enrutado del gateway](#url-base-y-enrutado-del-gateway)
  - [Autenticación](#autenticación)
  - [Roles](#roles)
  - [Multi-tenancy](#multi-tenancy)
  - [Endpoints internos](#endpoints-internos)
  - [Paginación](#paginación)
  - [Formato de error](#formato-de-error)
- [auth-service (3001)](#auth-service-3001)
- [core-service (3002)](#core-service-3002)
- [booking-service (3003)](#booking-service-3003)
- [payment-service (3004)](#payment-service-3004)
- [notification-service (3005)](#notification-service-3005)
- [marketplace-service (3006)](#marketplace-service-3006)
- [analytics-service (3007)](#analytics-service-3007)
- [api-gateway (3000)](#api-gateway-3000)

---

## Convenciones

### URL base y enrutado del gateway

Los clientes **nunca** llaman a los microservicios directamente. Todo pasa por el
API Gateway:

```
http://localhost:3000/api/v1/{servicio}/{ruta}
```

El frontend usa `NEXT_PUBLIC_API_URL`, con `http://localhost:3000/api/v1` por defecto
(ver `apps/frontend/src/lib/api.ts`).

`{servicio}` debe ser el **nombre corto**, sin el sufijo `-service`:

| Nombre a usar  | Se enruta a                | Puerto |
| -------------- | -------------------------- | ------ |
| `auth`         | `AUTH_SERVICE_URL`         | 3001   |
| `core`         | `CORE_SERVICE_URL`         | 3002   |
| `booking`      | `BOOKING_SERVICE_URL`      | 3003   |
| `payment`      | `PAYMENT_SERVICE_URL`      | 3004   |
| `notification` | `NOTIFICATION_SERVICE_URL` | 3005   |
| `marketplace`  | `MARKETPLACE_SERVICE_URL`  | 3006   |
| `analytics`    | `ANALYTICS_SERVICE_URL`    | 3007   |

Ejemplo: `GET /api/v1/core/businesses` llega a `http://core:3002/businesses`.

> **⚠️ No uses la forma larga `{servicio}-service`.**
>
> El gateway acepta el nombre con sufijo (`isValidService` lo normaliza quitando
> `-service`), pero al reescribir la ruta añade además un prefijo de módulo:
> `/api/v1/marketplace-service/feed` acaba llamando a `http://marketplace:3006/marketplace/feed`.
> Ningún servicio define `setGlobalPrefix`, así que ese prefijo no existe y la
> petición devuelve **404**. Ver `buildTargetUrl` en
> `services/api-gateway/src/modules/proxy/proxy.controller.ts`.
>
> La forma correcta es siempre la corta: `/api/v1/marketplace/feed`.

El gateway envuelve cada reenvío en un **circuit breaker** por servicio y aplica un
timeout (`PROXY_TIMEOUT_MS`). Traduce los fallos así:

| Situación                          | Respuesta del gateway     |
| ---------------------------------- | ------------------------- |
| El backend responde 5xx            | `502 Bad Gateway`         |
| Se agota el timeout (`AbortError`) | `504 Gateway Timeout`     |
| Fallo de red / servicio caído      | `503 Service Unavailable` |
| Nombre de servicio desconocido     | `404 Not Found`           |

### Autenticación

JWT emitido por `auth-service` y validado en el API Gateway.

```http
Authorization: Bearer <access_token>
```

- **Access token**: `JWT_EXPIRES_IN`, 15 minutos por defecto.
- **Refresh token**: `JWT_REFRESH_EXPIRES_IN`, 7 días por defecto. Se canjea en
  `POST /api/v1/auth/refresh`.
- Las rutas marcadas **PÚBLICA** en las tablas llevan el decorador `@Public()` y no
  requieren token.
- El frontend **no** guarda el token: el gateway lo emite en una cookie httpOnly
  `bs_access`, acompañada de una cookie legible `bs_session` con solo lo no
  sensible (rol, negocio, vencimiento) para hidratar la sesión en el cliente. El
  manejo del `401` se centraliza en `apps/frontend/src/lib/api.ts`, que ante un
  token vencido dispara una única renovación compartida y reintenta.

Las sesiones se pueden invalidar de forma inmediata en todos los servicios: el
`tokenVersion` del usuario vive en Redis como fuente de verdad (ver
`docs/04-ARQUITECTURA.md`), así que un `logout` o un cambio de contraseña
invalida los tokens ya emitidos sin esperar a que expiren.

### Roles

Seis roles del sistema, comprobados con el decorador `@Roles(...)` y `RolesGuard`:

| Rol            | Alcance                             |
| -------------- | ----------------------------------- |
| `SUPER_ADMIN`  | Toda la plataforma                  |
| `OWNER`        | Su negocio, incluida la facturación |
| `ADMIN`        | Su negocio, sin facturación         |
| `PROFESSIONAL` | Su agenda y su perfil               |
| `RECEPTIONIST` | Citas, pagos y clientes             |
| `CLIENT`       | Marketplace y sus propias citas     |

En las tablas, la columna **Roles** indica quién puede llamar a la ruta. Cuando el
decorador está a nivel de clase, aplica a todas las rutas de ese controlador.
Ver [08-ROLES-PERMISOS.md](08-ROLES-PERMISOS.md) para la matriz completa.

### Multi-tenancy

Multi-tenancy **lógica**: las tablas de negocio llevan una columna `businessId`
(ADR-002). El aislamiento no lo pide el cliente, lo inyecta el gateway:

- El gateway lee el `businessId` (o el primero de `businessIds`) del JWT y lo
  reenvía al backend en la cabecera **`x-business-id`**.
- Un cliente **no puede** falsificar el tenant: la cabecera se construye a partir
  del token, no de la petición entrante.
- Resolución por subdominio: `{slug}.beautyspot.co` se resuelve contra
  `GET /internal/businesses/resolve?slug=...` del core-service.

### Endpoints internos

Las rutas bajo `internal/*` son de **servicio a servicio** y no están pensadas para
clientes finales. Van protegidas por `InternalSecretGuard`, que exige la cabecera:

```http
x-internal-secret: <INTERNAL_API_SECRET>
```

Aparecen en este documento porque forman parte del contrato entre servicios, pero
no deben exponerse públicamente en el gateway.

### Paginación

Las rutas de listado aceptan `?page=` y `?limit=` y responden con la forma
`IPaginatedResponse<T>` (`packages/shared-types/src/common.types.ts`):

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 137,
    "totalPages": 7,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Formato de error

Todos los servicios normalizan los errores con `HttpExceptionFilter`
(`packages/nest-common`):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación",
    "details": {
      "validation": ["email debe ser un correo válido"]
    }
  },
  "statusCode": 400,
  "timestamp": "2026-07-25T00:00:00.000Z"
}
```

Códigos estables:

| HTTP | `error.code`        | Cuándo                                         |
| ---- | ------------------- | ---------------------------------------------- |
| 400  | `VALIDATION_ERROR`  | Falla la validación del DTO (`ValidationPipe`) |
| 401  | `AUTH_UNAUTHORIZED` | Sin token, token inválido o expirado           |
| 403  | `AUTH_FORBIDDEN`    | Autenticado pero sin el rol necesario          |
| 404  | `NOT_FOUND`         | El recurso no existe                           |
| 500  | `INTERNAL_ERROR`    | Fallo no controlado (solo los 5xx se loguean)  |

Sólo los errores 5xx se escriben en el log del servidor.

---

## auth-service (3001)

Autenticación, usuarios, personal y membresías. Base de datos `beautyspot_auth`.

### Autenticación — `/api/v1/auth`

| Método | Ruta               | Roles       | Descripción                                |
| ------ | ------------------ | ----------- | ------------------------------------------ |
| POST   | `/register`        | PÚBLICA     | Registra usuario y negocio                 |
| POST   | `/login`           | PÚBLICA     | Devuelve access y refresh token            |
| POST   | `/refresh`         | PÚBLICA     | Canjea el refresh token por uno nuevo      |
| POST   | `/forgot-password` | PÚBLICA     | Dispara el correo de recuperación          |
| POST   | `/reset-password`  | PÚBLICA     | Fija la contraseña con el token del correo |
| POST   | `/change-password` | Autenticado | Cambia la contraseña conociendo la actual  |
| POST   | `/logout`          | Autenticado | Invalida la sesión (sube `tokenVersion`)   |
| GET    | `/me`              | Autenticado | Usuario del token                          |

### Usuarios y personal — `/api/v1/auth/users`

| Método | Ruta                  | Roles                     | Descripción                         |
| ------ | --------------------- | ------------------------- | ----------------------------------- |
| GET    | `/me`                 | Autenticado               | Perfil propio                       |
| PATCH  | `/me`                 | Autenticado               | Actualiza el perfil propio          |
| GET    | `/memberships`        | Autenticado               | Membresías del usuario              |
| GET    | `/business`           | OWNER, ADMIN, SUPER_ADMIN | Lista el personal del negocio       |
| GET    | `/:id/staff`          | OWNER, ADMIN, SUPER_ADMIN | Detalle de un miembro               |
| POST   | `/staff`              | OWNER, ADMIN, SUPER_ADMIN | Crea un miembro del personal        |
| PATCH  | `/:id/staff`          | OWNER, ADMIN, SUPER_ADMIN | Actualiza un miembro                |
| POST   | `/:id/reset-password` | OWNER, ADMIN, SUPER_ADMIN | Resetea la contraseña de un miembro |
| PATCH  | `/:id/status`         | OWNER, ADMIN, SUPER_ADMIN | Activa o desactiva un miembro       |

### Membresías — `/api/v1/auth/memberships`

| Método | Ruta                    | Roles                     | Descripción                   |
| ------ | ----------------------- | ------------------------- | ----------------------------- |
| POST   | `/`                     | OWNER, ADMIN, SUPER_ADMIN | Crea una membresía            |
| PATCH  | `/:id/role`             | OWNER, SUPER_ADMIN        | Cambia el rol de la membresía |
| DELETE | `/:id`                  | OWNER, SUPER_ADMIN        | Desactiva la membresía        |
| GET    | `/business/:businessId` | OWNER, ADMIN, SUPER_ADMIN | Membresías de un negocio      |

### Internos

| Método | Ruta                    | Descripción                                      |
| ------ | ----------------------- | ------------------------------------------------ |
| POST   | `/internal/memberships` | Crea membresía sin comprobar el rol del llamante |

---

## core-service (3002)

Negocios, sucursales, profesionales, servicios, clientes e imágenes. Base de datos
`beautyspot_core`. Es el servicio más grande: 10 entidades y 12 controladores.

### Negocios — `/api/v1/core/businesses`

Roles a nivel de clase: **OWNER, ADMIN, SUPER_ADMIN**.

| Método | Ruta          | Descripción                |
| ------ | ------------- | -------------------------- |
| POST   | `/`           | Crea un negocio            |
| GET    | `/`           | Lista negocios (paginado)  |
| GET    | `/slug/:slug` | Busca por slug             |
| GET    | `/:id`        | Detalle                    |
| PATCH  | `/:id`        | Actualiza                  |
| DELETE | `/:id`        | Desactiva (borrado lógico) |

### Sucursales — `/api/v1/core/branches`

Roles a nivel de clase: **OWNER, ADMIN, SUPER_ADMIN**.

| Método | Ruta   | Descripción      |
| ------ | ------ | ---------------- |
| POST   | `/`    | Crea sucursal    |
| GET    | `/`    | Lista sucursales |
| GET    | `/:id` | Detalle          |
| PATCH  | `/:id` | Actualiza        |
| DELETE | `/:id` | Desactiva        |

### Horarios — `/api/v1/core/business-hours`

Roles a nivel de clase: **OWNER, ADMIN**.

| Método | Ruta   | Descripción                            |
| ------ | ------ | -------------------------------------- |
| GET    | `/`    | Horario semanal del negocio            |
| PUT    | `/`    | Reemplaza el horario completo (upsert) |
| PATCH  | `/:id` | Actualiza un tramo                     |

### Ajustes del negocio — `/api/v1/core/business-config`

Roles a nivel de clase: **OWNER, ADMIN**. Ajustes sin columnas propias, guardados
por clave en `business_config`.

| Método | Ruta            | Descripción                                            |
| ------ | --------------- | ------------------------------------------------------ |
| GET    | `/facturacion`  | Datos fiscales con los que se emiten las facturas      |
| PATCH  | `/facturacion`  | Actualiza los datos fiscales                           |
| GET    | `/reservas`     | Reglas de reserva y cancelación                        |
| PATCH  | `/reservas`     | Actualiza las reglas de reserva                        |
| GET    | `/fidelizacion` | Niveles del programa; los de por defecto si no los hay |
| PATCH  | `/fidelizacion` | Reemplaza la escala de niveles                         |

### Profesionales — `/api/v1/core/professionals`

Roles a nivel de clase: **OWNER, ADMIN, SUPER_ADMIN**.

| Método | Ruta                       | Descripción                   |
| ------ | -------------------------- | ----------------------------- |
| POST   | `/`                        | Crea profesional              |
| GET    | `/`                        | Lista profesionales           |
| GET    | `/:id`                     | Detalle                       |
| PATCH  | `/:id`                     | Actualiza                     |
| DELETE | `/:id`                     | Elimina                       |
| POST   | `/:id/services`            | Asigna un servicio            |
| GET    | `/:id/services`            | Servicios que presta          |
| DELETE | `/:id/services/:serviceId` | Quita un servicio             |
| PATCH  | `/:id/link-user`           | Vincula una cuenta de usuario |
| PATCH  | `/:id/unlink-user`         | Desvincula la cuenta          |

### Servicios — `/api/v1/core/services`

Roles a nivel de clase: **OWNER, ADMIN**.

| Método | Ruta   | Roles                                    | Descripción     |
| ------ | ------ | ---------------------------------------- | --------------- |
| POST   | `/`    | OWNER, ADMIN                             | Crea servicio   |
| GET    | `/`    | OWNER, ADMIN, PROFESSIONAL, RECEPTIONIST | Lista servicios |
| GET    | `/:id` | OWNER, ADMIN                             | Detalle         |
| PATCH  | `/:id` | OWNER, ADMIN                             | Actualiza       |
| DELETE | `/:id` | OWNER, ADMIN                             | Elimina         |

### Categorías de servicio — `/api/v1/core/service-categories`

| Método | Ruta          | Roles                                                 |
| ------ | ------------- | ----------------------------------------------------- |
| POST   | `/`           | OWNER, ADMIN, SUPER_ADMIN                             |
| GET    | `/`           | OWNER, ADMIN, SUPER_ADMIN, PROFESSIONAL, RECEPTIONIST |
| GET    | `/:id`        | OWNER, ADMIN, SUPER_ADMIN, PROFESSIONAL, RECEPTIONIST |
| PATCH  | `/:id`        | OWNER, ADMIN, SUPER_ADMIN                             |
| DELETE | `/:id`        | OWNER, ADMIN, SUPER_ADMIN                             |
| PATCH  | `/:id/toggle` | OWNER, ADMIN, SUPER_ADMIN — activa/desactiva          |
| POST   | `/reorder`    | OWNER, ADMIN, SUPER_ADMIN — reordena                  |

### Categorías de profesional — `/api/v1/core/categories`

| Método | Ruta                       | Roles                                                 |
| ------ | -------------------------- | ----------------------------------------------------- |
| POST   | `/`                        | OWNER, ADMIN, SUPER_ADMIN                             |
| GET    | `/`                        | OWNER, ADMIN, SUPER_ADMIN, PROFESSIONAL, RECEPTIONIST |
| GET    | `/:id`                     | OWNER, ADMIN, SUPER_ADMIN                             |
| PATCH  | `/:id`                     | OWNER, ADMIN, SUPER_ADMIN                             |
| DELETE | `/:id`                     | OWNER, ADMIN, SUPER_ADMIN                             |
| PATCH  | `/:id/toggle`              | OWNER, ADMIN, SUPER_ADMIN                             |
| PATCH  | `/:id/professionals-count` | OWNER, ADMIN, SUPER_ADMIN                             |
| POST   | `/reorder`                 | OWNER, ADMIN, SUPER_ADMIN                             |

### Clientes — `/api/v1/core/clients`

| Método | Ruta   | Roles                                    |
| ------ | ------ | ---------------------------------------- |
| POST   | `/`    | OWNER, ADMIN, RECEPTIONIST               |
| GET    | `/`    | OWNER, ADMIN, RECEPTIONIST, PROFESSIONAL |
| GET    | `/:id` | OWNER, ADMIN, RECEPTIONIST, PROFESSIONAL |
| PATCH  | `/:id` | OWNER, ADMIN, RECEPTIONIST               |

### Imágenes — `/api/v1/core/images`

Subida directa (multipart) o mediante URL firmada contra S3/CDN. Configuración en
`AWS_*` del `.env` de core-service.

| Método | Ruta                                          | Roles                                                 |
| ------ | --------------------------------------------- | ----------------------------------------------------- |
| POST   | `/businesses/:businessId/logo-upload`         | OWNER, ADMIN, SUPER_ADMIN — multipart                 |
| POST   | `/professionals/:professionalId/photo-upload` | OWNER, ADMIN, SUPER_ADMIN — multipart                 |
| POST   | `/services/:serviceId/image-upload`           | OWNER, ADMIN, SUPER_ADMIN — multipart                 |
| GET    | `/upload-signature`                           | OWNER, ADMIN, SUPER_ADMIN                             |
| GET    | `/presigned-url`                              | OWNER, ADMIN, SUPER_ADMIN, PROFESSIONAL, RECEPTIONIST |
| DELETE | `/:publicId`                                  | OWNER, ADMIN, SUPER_ADMIN                             |

### Públicas — `/api/v1/core/public`

Controlador `@Public()`: sin token. Alimenta el marketplace y la reserva pública.

| Método | Ruta                            | Descripción               |
| ------ | ------------------------------- | ------------------------- |
| GET    | `/businesses`                   | Negocios publicados       |
| GET    | `/businesses/slug/:slug`        | Negocio por slug          |
| GET    | `/businesses/:id/services`      | Servicios del negocio     |
| GET    | `/businesses/:id/professionals` | Profesionales del negocio |

### Internos

| Método | Ruta                               | Descripción                                   |
| ------ | ---------------------------------- | --------------------------------------------- |
| GET    | `/internal/businesses/resolve`     | Resuelve negocio por slug (lo usa el gateway) |
| POST   | `/internal/businesses`             | Crea negocio a petición de otro servicio      |
| POST   | `/internal/clients/find-or-create` | Busca o crea cliente (reserva pública)        |
| GET    | `/internal/profiles/resolve`       | Resuelve perfiles                             |

---

## booking-service (3003)

Citas, disponibilidad y bloqueos. Base de datos `beautyspot_booking`. Implementa el
patrón **Outbox** para publicar eventos de forma fiable.

### Citas — `/api/v1/booking/appointments`

| Método | Ruta              | Roles                                    | Descripción               |
| ------ | ----------------- | ---------------------------------------- | ------------------------- |
| POST   | `/`               | OWNER, ADMIN, RECEPTIONIST               | Crea cita                 |
| GET    | `/`               | OWNER, ADMIN, RECEPTIONIST, PROFESSIONAL | Lista citas (paginado)    |
| GET    | `/availability`   | Autenticado                              | Huecos disponibles        |
| GET    | `/:id`            | OWNER, ADMIN, RECEPTIONIST, PROFESSIONAL | Detalle                   |
| POST   | `/:id/confirm`    | OWNER, ADMIN, PROFESSIONAL               | `PENDING` → `CONFIRMED`   |
| POST   | `/:id/start`      | OWNER, ADMIN, PROFESSIONAL               | Marca en curso            |
| POST   | `/:id/complete`   | OWNER, ADMIN, PROFESSIONAL               | Completa y suma fidelidad |
| POST   | `/:id/cancel`     | OWNER, ADMIN, RECEPTIONIST               | Cancela con motivo        |
| POST   | `/:id/no-show`    | OWNER, ADMIN, PROFESSIONAL               | Marca no presentado       |
| PATCH  | `/:id/reschedule` | OWNER, ADMIN, RECEPTIONIST               | Reprograma                |

### Disponibilidad — `/api/v1/booking/professionals/:professionalId/availability`

Roles a nivel de clase: **OWNER, ADMIN, PROFESSIONAL**.

| Método | Ruta | Descripción                            |
| ------ | ---- | -------------------------------------- |
| GET    | `/`  | Disponibilidad semanal del profesional |
| POST   | `/`  | Reemplaza la semana completa           |

Al crearse un profesional en core-service, booking recibe
`core.professional.created` y le genera una disponibilidad por defecto de lunes a
domingo, 09:00–18:00.

### Bloqueos — `/api/v1/booking/professionals/:professionalId/blocked-slots`

Roles a nivel de clase: **OWNER, ADMIN**.

| Método | Ruta         | Descripción                                |
| ------ | ------------ | ------------------------------------------ |
| GET    | `/`          | Lista bloqueos                             |
| POST   | `/`          | Crea bloqueo; con repetición, uno por día  |
| DELETE | `/:id`       | Elimina un bloqueo (solo ese día)          |
| DELETE | `/:id/serie` | Elimina la serie entera a la que pertenece |

### Bloqueos del día — `/api/v1/booking/blocked-slots`

Roles a nivel de clase: **OWNER, ADMIN, RECEPTIONIST**. Los bloqueos de todo el
equipo un día concreto, que es lo que pinta la vista día de la agenda.

| Método | Ruta      | Descripción                 |
| ------ | --------- | --------------------------- |
| GET    | `/?date=` | Bloqueos del equipo ese día |

`POST` responde siempre con **una lista** de bloqueos, también cuando se crea uno
solo. Con `repeticion` (`DIARIA` o `SEMANAL`) hace falta `repetirHasta`, y se
crea un bloqueo por cada día que cubra el rango, hasta un tope de 366. Si alguno
de esos días tiene una cita viva bajo la franja no se guarda ninguno, y el error
nombra los días en conflicto.

### Reserva pública — `/api/v1/booking/public`

| Método | Ruta            | Roles   | Descripción                              |
| ------ | --------------- | ------- | ---------------------------------------- |
| POST   | `/appointments` | PÚBLICA | Reserva desde el marketplace, sin cuenta |

### Internos

| Método | Ruta                                                              | Descripción                       |
| ------ | ----------------------------------------------------------------- | --------------------------------- |
| GET    | `/internal/appointments/professional/:professionalId/has-history` | Si el profesional tiene historial |

---

## payment-service (3004)

Pagos manuales, facturas y caja. Base de datos `beautyspot_payment`. Usa el patrón
**Outbox**.

### Pagos — `/api/v1/payment/payments`

| Método | Ruta             | Roles                      | Descripción            |
| ------ | ---------------- | -------------------------- | ---------------------- |
| POST   | `/`              | ADMIN, RECEPTIONIST        | Registra pago          |
| GET    | `/`              | OWNER, ADMIN, RECEPTIONIST | Lista pagos (paginado) |
| GET    | `/daily-summary` | OWNER, ADMIN               | Resumen del día        |
| GET    | `/:id`           | OWNER, ADMIN, RECEPTIONIST | Detalle                |
| PATCH  | `/:id/status`    | OWNER, ADMIN               | Cambia el estado       |
| POST   | `/:id/refund`    | OWNER, ADMIN               | Procesa devolución     |

### Facturas — `/api/v1/payment/invoices`

Roles a nivel de clase: **OWNER, ADMIN**.

| Método | Ruta          | Roles                      | Descripción      |
| ------ | ------------- | -------------------------- | ---------------- |
| POST   | `/`           | OWNER, ADMIN               | Crea factura     |
| GET    | `/`           | OWNER, ADMIN, RECEPTIONIST | Lista facturas   |
| GET    | `/:id`        | OWNER, ADMIN               | Detalle          |
| PATCH  | `/:id/status` | OWNER, ADMIN               | Cambia el estado |
| GET    | `/:id/pdf`    | OWNER, ADMIN               | Descarga el PDF  |

### Caja — `/api/v1/payment/cash-register`

Roles a nivel de clase: **OWNER, ADMIN, RECEPTIONIST**.

| Método | Ruta             | Descripción           |
| ------ | ---------------- | --------------------- |
| POST   | `/open`          | Abre sesión de caja   |
| POST   | `/:id/close`     | Cierra con arqueo     |
| POST   | `/:id/movements` | Registra movimiento   |
| GET    | `/active`        | Sesión abierta actual |
| GET    | `/history`       | Histórico de sesiones |
| GET    | `/:id/summary`   | Resumen de una sesión |

> **Un negocio no puede tener dos cajas abiertas a la vez.** La garantía es del
> índice único parcial `uq_cash_sessions_open_per_business`
> (`WHERE closed_at IS NULL`), no sólo de la comprobación en código: esta última es
> un check-then-act y dos aperturas simultáneas podrían pasarla. Está declarado en
> la entidad y en la migración `CashSessionSingleOpen1700000000003`, y verificado
> por un test de integración contra Postgres real.

---

## notification-service (3005)

Notificaciones in-app, preferencias y correo. Base de datos `beautyspot_notification`.

### Notificaciones — `/api/v1/notification/notifications`

Roles a nivel de clase: **OWNER, ADMIN, PROFESSIONAL, CLIENT**.

| Método | Ruta             | Descripción                |
| ------ | ---------------- | -------------------------- |
| POST   | `/`              | Crea notificación          |
| GET    | `/`              | Notificaciones del usuario |
| GET    | `/unread-count`  | Número de no leídas        |
| POST   | `/:id/read`      | Marca una como leída       |
| POST   | `/mark-all-read` | Marca todas como leídas    |

### Preferencias — `/api/v1/notification/notification-preferences`

Roles a nivel de clase: **OWNER, ADMIN, PROFESSIONAL**.

| Método | Ruta | Descripción               |
| ------ | ---- | ------------------------- |
| GET    | `/`  | Preferencias del usuario  |
| POST   | `/`  | Crea o actualiza (upsert) |

### Correo (internos) — `/internal/emails`

Los disparan otros servicios; requieren `x-internal-secret`. SMTP configurado con
las `SMTP_*` del `.env`.

| Método | Ruta                        | Correo que envía           |
| ------ | --------------------------- | -------------------------- |
| POST   | `/appointment/confirmation` | Confirmación de cita       |
| POST   | `/appointment/reminder-24h` | Recordatorio 24 h antes    |
| POST   | `/appointment/reminder-1h`  | Recordatorio 1 h antes     |
| POST   | `/appointment/cancelled`    | Cita cancelada             |
| POST   | `/invoice`                  | Factura                    |
| POST   | `/password-reset`           | Recuperación de contraseña |
| POST   | `/welcome`                  | Bienvenida                 |
| POST   | `/monthly-report`           | Informe mensual            |

---

## marketplace-service (3006)

Perfiles públicos, búsqueda, feed y reseñas. Base de datos `beautyspot_marketplace`.

### Perfiles de negocio (gestión) — `/api/v1/marketplace/business-profiles`

| Método | Ruta              | Roles        | Descripción                 |
| ------ | ----------------- | ------------ | --------------------------- |
| GET    | `/`               | OWNER, ADMIN | Perfil del negocio propio   |
| PUT    | `/config`         | OWNER, ADMIN | Actualiza la configuración  |
| POST   | `/gallery`        | OWNER, ADMIN | Añade imágenes a la galería |
| PUT    | `/gallery`        | OWNER, ADMIN | Actualiza una imagen        |
| DELETE | `/gallery/:index` | OWNER, ADMIN | Quita una imagen            |
| POST   | `/publish`        | OWNER, ADMIN | Publica el perfil           |
| POST   | `/unpublish`      | OWNER, ADMIN | Lo retira del marketplace   |

### Perfiles públicos — `/api/v1/marketplace/profiles`

| Método | Ruta                                     | Descripción                      |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/:slug`                                 | Perfil público del negocio       |
| GET    | `/:slug/professionals/:professionalSlug` | Perfil público de un profesional |

### Perfiles de profesional — `/api/v1/marketplace/professional-profiles`

| Método | Ruta                          | Roles        | Descripción                |
| ------ | ----------------------------- | ------------ | -------------------------- |
| PUT    | `/:professionalId`            | OWNER, ADMIN | Actualiza el perfil        |
| PUT    | `/:professionalId/visibility` | OWNER, ADMIN | Muestra u oculta el perfil |

### Búsqueda y feed

| Método | Ruta      | Roles   | Descripción                       |
| ------ | --------- | ------- | --------------------------------- |
| GET    | `/search` | PÚBLICA | Búsqueda con filtros              |
| GET    | `/feed`   | PÚBLICA | Feed de actividad del marketplace |

### Reseñas — `/api/v1/marketplace/reviews`

| Método | Ruta                            | Roles        | Descripción                   |
| ------ | ------------------------------- | ------------ | ----------------------------- |
| POST   | `/`                             | PÚBLICA      | Crea reseña                   |
| GET    | `/business/:businessId`         | PÚBLICA      | Reseñas del negocio           |
| GET    | `/business/:businessId/summary` | PÚBLICA      | Resumen y media de valoración |
| GET    | `/:id`                          | PÚBLICA      | Detalle                       |
| POST   | `/:id/respond`                  | OWNER, ADMIN | Responde a una reseña         |
| POST   | `/:id/helpful`                  | PÚBLICA      | Marca como útil               |
| DELETE | `/:id/helpful`                  | PÚBLICA      | Quita la marca                |

### Internos

| Método | Ruta                                                   | Descripción                       |
| ------ | ------------------------------------------------------ | --------------------------------- |
| POST   | `/internal/business-profiles/sync`                     | Sincroniza el perfil desde core   |
| GET    | `/internal/business-profiles/id/:id`                   | Perfil por id                     |
| POST   | `/internal/professional-profiles/sync`                 | Sincroniza profesional desde core |
| POST   | `/internal/professional-profiles/deactivate`           | Desactiva profesional             |
| GET    | `/internal/professional-profiles/business/:businessId` | Profesionales de un negocio       |
| GET    | `/internal/professional-profiles/:id`                  | Profesional por id                |

---

## analytics-service (3007)

KPIs, métricas y reportes. Base de datos `beautyspot_analytics`. Todos los
controladores exigen **SUPER_ADMIN, OWNER o ADMIN**.

### Dashboard — `/api/v1/analytics/dashboard`

| Método | Ruta                 | Descripción                       |
| ------ | -------------------- | --------------------------------- |
| GET    | `/kpis`              | KPIs principales                  |
| GET    | `/top-professionals` | Ranking de profesionales          |
| GET    | `/revenue-chart`     | Serie de ingresos para la gráfica |

### Métricas — `/api/v1/analytics/metrics`

| Método | Ruta                      | Descripción                           |
| ------ | ------------------------- | ------------------------------------- |
| GET    | `/`                       | Consulta métricas                     |
| POST   | `/daily/increment`        | Incrementa una métrica diaria         |
| POST   | `/professional/increment` | Incrementa una métrica de profesional |

> Los endpoints de incremento son **INCREMENT**, no SET: se resuelven con upserts
> atómicos en SQL para que dos eventos concurrentes no se pisen.

### Reportes — `/api/v1/analytics/reports`

| Método | Ruta             | Descripción             |
| ------ | ---------------- | ----------------------- |
| GET    | `/revenue`       | Informe de ingresos     |
| GET    | `/professionals` | Informe por profesional |
| GET    | `/appointments`  | Informe de citas        |

---

## api-gateway (3000)

| Método | Ruta                      | Roles   | Descripción                                      |
| ------ | ------------------------- | ------- | ------------------------------------------------ |
| GET    | `/health`                 | PÚBLICA | Estado del gateway y de los 7 servicios          |
| ALL    | `/api/v1/:service/*splat` | —       | Reenvía al microservicio bajo el circuit breaker |

> La ruta comodín es `:service/*splat`, con el comodín **nombrado**: Express 5
> (path-to-regexp v8) ya no acepta un `*` suelto. Hay un test de regresión que lo
> cubre en `proxy.controller.spec.ts`.

El gateway también aplica **rate limiting** con Redis, configurable con
`RATE_LIMIT_AUTH_MAX` y `RATE_LIMIT_GENERAL_MAX`.

---

## Eventos de RabbitMQ

La API no es el único contrato entre servicios: hay 27 eventos de dominio
publicados en RabbitMQ, definidos como constantes en
`packages/event-types/src/`. Sus nombres siguen el patrón
`{servicio}.{agregado}.{acción}`:

| Familia          | Eventos                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `auth.*`         | `user.registered`, `user.logged-in`, `password-reset.requested`, `membership.created`, `membership.role-changed`       |
| `core.*`         | `business.created`, `business.updated`, `professional.created`, `service.created`, `service.updated`, `client.created` |
| `booking.*`      | `appointment.created`, `.confirmed`, `.cancelled`, `.completed`, `.no-showed`, `.rescheduled`, `.reminder-due`         |
| `payment.*`      | `payment.registered`, `invoice.generated`, `refund.processed`, `cash.session.closed`                                   |
| `marketplace.*`  | `review.created`, `review.updated`                                                                                     |
| `notification.*` | `email.queued`, `email.sent`, `email.failed`                                                                           |

Los servicios que publican eventos de forma crítica (booking, payment) usan el
patrón **Transactional Outbox**: el evento se escribe en la tabla `outbox_messages`
dentro de la misma transacción que el cambio de negocio, y un worker lo publica
después. Así nunca hay un cambio sin evento ni un evento sin cambio.

Ver [04-ARQUITECTURA.md](04-ARQUITECTURA.md) para la topología de exchanges y colas.
