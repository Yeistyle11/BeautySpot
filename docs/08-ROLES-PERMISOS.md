# 08 - Roles y Permisos - BeautySpot SaaS

## Resumen

Este documento define el modelo de roles y permisos de BeautySpot: los seis roles,
la matriz de permisos, el modelo de membresía multi-tenant y cómo se ejecutan los
permisos en los microservicios.

> **Qué es realidad y qué es intención.** El permiso que se aplica de verdad es el
> `@Roles(...)` de cada controlador, y está enumerado ruta por ruta en
> [API.md](API.md). Este documento explica el **porqué** de ese reparto y describe
> el modelo completo, que en algunos puntos va por delante de lo construido —lo
> más visible: `SUPER_ADMIN` se comprueba en los guards pero **hoy no se puede
> asignar a nadie** (ver [13-SCHEMA-BASEDATOS.md](13-SCHEMA-BASEDATOS.md#datos-iniciales))—.
> Ante una discrepancia entre una tabla de aquí y API.md, manda API.md.

---

## Modelo de Roles

### Visión General

BeautySpot implementa un sistema de control de acceso basado en roles (RBAC) con 6 roles
definidos que operan dentro de un contexto multi-tenant. Los permisos se evalúan siempre
en el contexto de un negocio específico, excepto para el rol SUPER_ADMIN que opera a
nivel de plataforma.

### Jerarquía de Roles

```
SUPER_ADMIN
    |
    v
  OWNER
    |
    v
  ADMIN
    |
    +---> PROFESSIONAL
    |
    +---> RECEPTIONIST
              |
              v
           CLIENT
```

**Regla de jerarquía**: Un rol superior hereda implícitamente los permisos de los roles
inferiores dentro de su propio negocio, con las siguientes excepciones:

- PROFESSIONAL y RECEPTIONIST son roles hermanos (no hay herencia entre ellos)
- CLIENT es un rol transversal que no pertenece a la jerarquía de gestión del negocio
- SUPER_ADMIN no pertenece a ningún negocio específico; gestiona la plataforma entera

---

## Descripción Detallada de Roles

### SUPER_ADMIN (Administrador de Plataforma)

**Proposito**: Gestiona la plataforma BeautySpot a nivel global. No pertenece a ningún
negocio específico.

**Contexto**: Opera fuera del multi-tenancy. Tiene acceso a todos los negocios y datos
de la plataforma para administración, soporte y monitoreo.

**Casos de uso tipicos**:

- Aprobar o suspender negocios en la plataforma
- Gestionar suscripciones y facturación de la plataforma
- Monitorear la salud del sistema y resolver incidentes
- Dar soporte técnico avanzado a owners y admins
- Configurar parámetros globales del sistema
- Gestionar features flags para despliegues graduales
- Acceder a métricas agregadas de la plataforma

**Restricciones**:

- No realiza reservas ni gestiona citas directamente
- No interactúa con clientes finales excepto para soporte
- Sus acciones son auditadas con mayor granularidad

### OWNER (Propietario del Negocio)

**Proposito**: Es el dueño o propietario del negocio. Tiene control total sobre su
negocio dentro de la plataforma.

**Contexto**: Pertenece a uno o más negocios como propietario. Es el rol más alto dentro
del contexto de un negocio.

**Casos de uso tipicos**:

- Crear y configurar su negocio (onboarding inicial)
- Gestionar sucursales del negocio
- Contratar y dar de baja a profesionales y recepcionistas
- Configurar servicios, precios y horarios
- Acceder a todas las métricas y reportes financieros
- Gestionar el perfil público en el marketplace
- Configurar integraciones (WhatsApp, notificaciones)
- Responder reseñas y gestionar la reputación online
- Delegar funciones administrativas a un ADMIN

**Restricciones**:

- Solo puede gestionar sus propios negocios
- No puede gestionar otros negocios ni datos de la plataforma
- No puede cambiar su propio rol (siempre es OWNER de su negocio)

### ADMIN (Administrador del Negocio)

**Proposito**: Administra el día a día del negocio por delegación del OWNER. Tiene
acceso completo a la gestión operativa del negocio.

**Contexto**: Pertenece a uno o más negocios como administrador. Puede ser asignado por
el OWNER.

**Casos de uso tipicos**:

- Gestionar citas (crear, confirmar, cancelar, editar, reagendar)
- Gestionar servicios (CRUD completo)
- Gestionar profesionales y recepcionistas
- Gestionar la caja registradora y registrar pagos
- Acceder a reportes operativos y financieros
- Responder reseñas
- Configurar horarios del negocio
- Gestionar clientes del negocio

**Restricciones**:

- No puede eliminar el negocio ni cambiar su configuración fundamental
- No puede cambiar el rol del OWNER
- No puede gestionar sucursales (crear, eliminar)
- No puede configurar integraciones del negocio (WhatsApp)
- No puede gestionar la suscripción de la plataforma

### PROFESSIONAL (Profesional / Barbero / Estilista)

**Proposito**: Es el profesional que atiende a los clientes. Gestiona su propia agenda
y disponibilidad.

**Contexto**: Pertenece a uno o más negocios como profesional. Está vinculado a los
servicios que ofrece.

**Casos de uso tipicos**:

- Ver su agenda personal (citas asignadas)
- Confirmar, completar y marcar no-show en sus citas
- Gestionar su disponibilidad (horarios, bloqueos, vacaciones)
- Ver información de sus clientes (nombre, historial de citas con él)
- Editar su perfil profesional (foto, bio, especialidades)
- Recibir notificaciones de nuevas citas y cambios
- Ver sus estadísticas personales (citas, calificación, ingresos generados)

**Restricciones**:

- Solo puede ver y actuar sobre sus propias citas
- No puede crear citas (eso lo hace el cliente o recepcionista)
- No puede ver citas de otros profesionales
- No puede acceder a datos financieros del negocio
- No puede gestionar servicios ni otros usuarios
- No puede cambiar sus servicios asignados (lo hace el ADMIN/OWNER)

### RECEPTIONIST (Recepcionista)

**Proposito**: Gestiona la recepción del negocio. Crea citas, registra pagos y maneja
la caja registradora.

**Contexto**: Pertenece a un negocio como recepcionista. Opera en el contexto de una
sucursal específica.

**Casos de uso tipicos**:

- Crear citas para clientes (walk-in o agendadas)
- Ver la agenda general del negocio (todos los profesionales)
- Registrar pagos (efectivo, tarjeta presencial, transferencia)
- Gestionar la caja registradora (apertura, movimientos, cierre)
- Buscar y ver información básica de clientes
- Cancelar o reagendar citas (con restricciones)
- Confirmar citas telefónicas

**Restricciones**:

- No puede editar servicios ni precios
- No puede gestionar profesionales ni equipos
- No puede acceder a reportes financieros detallados
- No puede configurar el negocio
- No puede responder reseñas
- No puede editar el perfil del marketplace

### CLIENT (Cliente)

**Proposito**: Es el usuario final que busca y reserva servicios en los negocios de
la plataforma.

**Contexto**: No pertenece a ningún negocio. Es un usuario transversal que puede
interactuar con múltiples negocios.

**Casos de uso tipicos**:

- Buscar negocios en el marketplace
- Ver perfiles públicos de negocios
- Reservar citas en cualquier negocio
- Cancelar o reagendar sus propias citas
- Ver su historial de citas
- Dejar reseñas en citas completadas
- Gestionar sus favoritos
- Ver y canjear puntos de fidelización
- Configurar sus preferencias de notificación

**Restricciones**:

- Solo puede ver y gestionar sus propias citas
- Solo puede dejar reseñas en citas que completó
- No puede acceder a ningún dato administrativo de los negocios
- No puede ver información de otros clientes

---

## Matriz de Permisos

### Leyenda

- **C** = Create (Crear)
- **R** = Read (Leer)
- **U** = Update (Actualizar)
- **D** = Delete (Eliminar)
- **-** = Sin acceso
- **O** = Solo propios (own data)
- **S** = Scope del negocio (dentro del contexto del negocio)

### Permisos sobre Recursos

| Recurso           | SUPER_ADMIN   | OWNER             | ADMIN          | PROFESSIONAL          | RECEPTIONIST             | CLIENT               |
| ----------------- | ------------- | ----------------- | -------------- | --------------------- | ------------------------ | -------------------- |
| **Users**         | CRUD (global) | R (negocio)       | R (negocio)    | R (O: perfil propio)  | R (clientes del negocio) | R (O: perfil propio) |
| **Businesses**    | CRUD (global) | CRUD (O: propios) | RU (asignado)  | R (asignado)          | -                        | R (perfil público)   |
| **Branches**      | R (global)    | CRUD (negocio)    | R (negocio)    | -                     | -                        | -                    |
| **Professionals** | R (global)    | CRUD (negocio)    | CRUD (negocio) | RU (O: perfil propio) | R (negocio)              | R (perfil público)   |
| **Services**      | R (global)    | CRUD (negocio)    | CRUD (negocio) | R (asignados)         | R (negocio)              | R (públicos)         |
| **Clients**       | R (global)    | R (negocio)       | R (negocio)    | R (O: propios)        | R (negocio)              | R (O: datos propios) |
| **Appointments**  | R (global)    | CRUD (negocio)    | CRUD (negocio) | RU (O: propias)       | CRU (negocio)            | CRU (O: propias)     |
| **Payments**      | R (global)    | R (negocio)       | CR (negocio)   | -                     | CR (negocio)             | R (O: propios)       |
| **Invoices**      | R (global)    | R (negocio)       | CR (negocio)   | -                     | R (negocio)              | R (O: propias)       |
| **Cash Register** | R (global)    | R (negocio)       | CRU (negocio)  | -                     | CRU (negocio)            | -                    |
| **Notifications** | R (global)    | R (negocio)       | R (negocio)    | R (O: propias)        | -                        | R (O: propias)       |
| **Reviews**       | RUD (global)  | RUD (negocio)     | RUD (negocio)  | R (negocio)           | R (negocio)              | CR (O: propias)      |
| **Analytics**     | R (global)    | R (negocio)       | R (negocio)    | R (O: propias)        | -                        | -                    |
| **Configuration** | RU (global)   | RU (negocio)      | R (negocio)    | -                     | -                        | R (O: preferencias)  |

### Detalle de Permisos por Recurso

#### Users

| Operación        | SUPER_ADMIN   | OWNER                   | ADMIN                   | PROFESSIONAL   | RECEPTIONIST         | CLIENT                   |
| ---------------- | ------------- | ----------------------- | ----------------------- | -------------- | -------------------- | ------------------------ |
| Crear usuario    | Cualquier rol | Invitar a negocio       | Invitar a negocio       | -              | -                    | Auto-registro            |
| Ver perfil       | Todos         | Usuarios de su negocio  | Usuarios de su negocio  | Solo el propio | Clientes del negocio | Solo el propio           |
| Editar perfil    | Todos         | -                       | -                       | Solo el propio | -                    | Solo el propio           |
| Eliminar usuario | Todos         | Desvincular del negocio | Desvincular del negocio | -              | -                    | Desactivar propia cuenta |
| Bloquear usuario | Si            | No                      | No                      | No             | No                   | No                       |

#### Businesses

| Operación             | SUPER_ADMIN        | OWNER            | ADMIN    | PROFESSIONAL | RECEPTIONIST | CLIENT         |
| --------------------- | ------------------ | ---------------- | -------- | ------------ | ------------ | -------------- |
| Crear negocio         | No (auto-registro) | Si (propios)     | No       | No           | No           | No             |
| Ver negocio           | Todos              | Propios          | Asignado | Asignado     | -            | Perfil público |
| Editar negocio        | Datos básicos      | Propios completo | Limitado | No           | No           | No             |
| Eliminar negocio      | Suspender          | Propios          | No       | No           | No           | No             |
| Gestionar suscripción | Si                 | Propios          | No       | No           | No           | No             |

#### Appointments

| Operación            | SUPER_ADMIN | OWNER            | ADMIN            | PROFESSIONAL | RECEPTIONIST     | CLIENT                  |
| -------------------- | ----------- | ---------------- | ---------------- | ------------ | ---------------- | ----------------------- |
| Crear cita           | No          | Si               | Si               | No           | Si               | Si (propias)            |
| Ver cita             | Todas       | Negocio completo | Negocio completo | Solo propias | Negocio completo | Solo propias            |
| Confirmar cita       | No          | Si               | Si               | Solo propias | No               | No                      |
| Completar cita       | No          | Si               | Si               | Solo propias | No               | No                      |
| Marcar no-show       | No          | Si               | Si               | Solo propias | No               | No                      |
| Cancelar cita        | No          | Si               | Si               | Solo propias | Si (con reglas)  | Solo propias (2h aviso) |
| Reagendar cita       | No          | Si               | Si               | No           | Si (con reglas)  | Solo propias (2h aviso) |
| Editar cita completa | No          | Si               | Si               | No           | No               | No                      |

#### Payments

| Operación         | SUPER_ADMIN | OWNER | ADMIN | PROFESSIONAL | RECEPTIONIST | CLIENT       |
| ----------------- | ----------- | ----- | ----- | ------------ | ------------ | ------------ |
| Registrar pago    | No          | Si    | Si    | No           | Si           | No           |
| Ver pagos         | No          | Si    | Si    | No           | Si           | No           |
| Resumen del día   | No          | Si    | Si    | No           | No           | No           |
| Cambiar el estado | No          | Si    | Si    | No           | No           | No           |
| Devolver un pago  | No          | Si    | Si    | No           | No           | No           |
| Crear factura     | No          | Si    | Si    | No           | No           | No           |
| Ver facturas      | No          | Si    | Si    | No           | Si           | Solo propias |

#### Reviews

| Operación                                     | SUPER_ADMIN                                       | OWNER | ADMIN | PROFESSIONAL | RECEPTIONIST | CLIENT                          |
| --------------------------------------------- | ------------------------------------------------- | ----- | ----- | ------------ | ------------ | ------------------------------- |
| Crear reseña                                  | No                                                | No    | No    | No           | No           | Solo en citas atendidas propias |
| Ver reseñas                                   | Público: cualquiera, con o sin cuenta             |       |       |              |              |                                 |
| Editar / borrar la suya                       | No                                                | No    | No    | No           | No           | Si                              |
| Responder / reescribir / retirar la respuesta | No                                                | Si    | Si    | No           | No           | No                              |
| Ocultar o republicar                          | No                                                | Si    | Si    | No           | No           | No                              |
| Denunciar                                     | Cualquier usuario autenticado, una vez por reseña |       |       |              |              |                                 |
| Marcar como útil                              | Cualquier usuario autenticado, un voto por reseña |       |       |              |              |                                 |

**No hay moderación de plataforma.** `SUPER_ADMIN` no tiene ninguna ruta de
reseñas: quien oculta una reseña es el propio negocio (`PATCH /:id/moderar`), y al
ocultarla deja de contar en su media. Denunciar no oculta nada, solo incrementa
`report_count`.

#### Analytics

| Operación               | SUPER_ADMIN | OWNER | ADMIN | PROFESSIONAL | RECEPTIONIST | CLIENT |
| ----------------------- | ----------- | ----- | ----- | ------------ | ------------ | ------ |
| Ver métricas globales   | Si          | No    | No    | No           | No           | No     |
| Ver métricas de negocio | Si          | Si    | Si    | No           | No           | No     |
| Ver métricas personales | No          | No    | No    | Si           | No           | No     |
| Exportar reportes       | Si          | Si    | Si    | No           | No           | No     |
| Ver predicciones        | Si          | Si    | Si    | No           | No           | No     |

---

## Modelo de Membresía

### Concepto

Un usuario puede tener diferentes roles en diferentes negocios simultáneamente. La
relación usuario-negocio-rol se gestiona a través del modelo `Membership`.

### Estructura del Modelo

```typescript
model Membership {
  id          String   @id @default(uuid())
  userId      String
  businessId  String
  branchId    String?  // null = aplica a todas las sucursales
  role        Role     // OWNER, ADMIN, PROFESSIONAL, RECEPTIONIST
  isActive    Boolean  @default(true)
  invitedAt   DateTime @default(now())
  acceptedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User      @relation(fields: [userId], references: [id])
  business    Business  @relation(fields: [businessId], references: [id])
  branch      Branch?   @relation(fields: [branchId], references: [id])

  @@unique([userId, businessId, branchId])
  @@map("memberships")
}
```

### Ejemplos de Membresía Multi-Rol

| Usuario | Negocio A                  | Negocio B    | Marketplace     |
| ------- | -------------------------- | ------------ | --------------- |
| Juan    | OWNER                      | CLIENT       | Siempre cliente |
| Maria   | PROFESSIONAL               | PROFESSIONAL | Siempre cliente |
| Carlos  | ADMIN                      | -            | Siempre cliente |
| Ana     | RECEPTIONIST en Sucursal 1 | -            | Siempre cliente |

### Reglas de Membresía

1. **Un usuario tiene exactamente un rol por negocio** (no se puede ser ADMIN y
   PROFESSIONAL simultáneamente en el mismo negocio)
2. **El rol CLIENT es global** y no requiere membresía; todo usuario es potencialmente
   cliente de cualquier negocio
3. **Solo puede existir un OWNER por negocio** (transferible por SUPER_ADMIN)
4. **Un PROFESSIONAL puede pertenecer a múltiples negocios** con el mismo o diferente rol
5. **La membresía puede estar limitada a una sucursal** o aplicarse a todas (`branchId` null)
6. **Desactivar una membresía no elimina el historial** del usuario en el negocio

### Flujo de Invitación

```
OWNER/ADMIN invita por email
    |
    v
Sistema crea Membership con isActive=false
    |
    v
Email de invitación enviado con enlace único
    |
    v
Usuario acepta invitación (registro o login)
    |
    v
Membership actualizada: isActive=true, acceptedAt=now()
    |
    v
Usuario accede al negocio con el rol asignado
```

### Cambio de Contexto

Cuando un usuario con membresías en múltiples negocios inicia sesión:

1. El dashboard muestra un selector de negocio/sucursal
2. Al cambiar de contexto, se actualiza el `businessId` en el JWT
3. Todas las consultas se ejecutan en el contexto del negocio seleccionado
4. El usuario puede cambiar de negocio sin cerrar sesión
5. Los permisos se reevalúan en cada cambio de contexto

---

## Ejecución de Permisos

### Arquitectura de Autorización

La autorización en BeautySpot se implementa en tres capas:

```
Peticion HTTP
    |
    v
[1] JWT Validation (AuthGuard)
    - Verifica firma y expiración del token
    - Extrae claims: userId, email, role, businessId
    |
    v
[2] BusinessScopeGuard
    - Verifica que el usuario tenga membresía activa en el negocio
    - Inyecta businessId en el contexto de ejecución
    - Aplica filtro de tenant a todas las consultas
    |
    v
[3] RolesGuard
    - Verifica que el rol del usuario tenga permiso para la acción
    - Evalúa permisos específicos del recurso
    - Puede aplicar filtros adicionales (solo propios, etc.)
    |
    v
Handler del Controller
```

### Lo que lleva el JWT

```json
{
  "sub": "uuid-del-usuario",
  "email": "usuario@email.com",
  "role": "ADMIN",
  "businessId": "uuid-del-negocio",
  "businessIds": ["uuid-1", "uuid-2"],
  "memberships": [{ "businessId": "uuid-1", "role": "ADMIN" }],
  "tokenVersion": 3,
  "iat": 1715299200,
  "exp": 1715385600
}
```

Tres cosas que suelen darse por hechas y no son así:

- **No hay un arreglo `permissions`.** El permiso se deriva del rol; no existen
  permisos sueltos por usuario ni un decorador `@RequirePermissions`.
- **No hay `branchId` en el token.** La sede activa la elige el panel y viaja en
  la cabecera `x-branch-id`, porque es una preferencia de la sesión y no una
  propiedad de la identidad.
- **`memberships` va entero**, no un `membershipId`: es lo que permite a quien
  trabaja en dos negocios cambiar de contexto sin volver a identificarse.

`tokenVersion` es lo que hace revocable un JWT: se compara con la versión vigente
en Redis y, si no coinciden, el token está muerto aunque no haya expirado.

### Los guards, en orden

Los tres viven en `packages/nest-common` y se registran globalmente en cada
servicio (`createMicroserviceApp`):

| Guard                | Qué comprueba                                                         | Cómo se salta                                                 |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `JwtAuthGuard`       | Firma, expiración y `tokenVersion`. Deja el payload en `request.user` | `@Public()`                                                   |
| `BusinessScopeGuard` | `x-business-id` presente, UUID válido y **entre los del token**       | `@Public()`, `@SkipBusinessScope()`, `/health`, `/internal/*` |
| `RolesGuard`         | Que `user.role` esté entre los de `@Roles(...)`                       | Sin `@Roles`, pasa                                            |

```typescript
// Lo que se escribe en un controlador real
@Roles(Role.OWNER, Role.ADMIN)
@Delete(":id")
async remove(@Param("id") id: string, @BusinessId() businessId: string) {
  // Solo OWNER y ADMIN llegan aquí, y solo con su propio negocio
}
```

`@Roles` se puede poner en la clase —vale para todas sus rutas— o en un método,
que entonces manda sobre el de la clase. `@BusinessId()` lee lo que dejó
`BusinessScopeGuard`, y `@CurrentUser()` lo que dejó `JwtAuthGuard`.

### El frontend no autoriza, solo pinta

`apps/frontend/src/lib/permissions.ts` tiene su propio catálogo `PAGES` y
`ACTIONS` con los roles que ven cada página y cada botón, más `canAccess` y
`getDefaultPath`. Y `src/middleware.ts` redirige en el Edge cuando el rol no
puede ver una ruta.

**Las dos cosas son experiencia de usuario, no seguridad.** Duplican
intencionadamente lo que decide el backend para no enseñar botones que van a dar
403; quien decide sigue siendo `@Roles` en el controlador. La consecuencia
práctica es que **al cambiar los roles de una ruta hay que tocar los dos sitios**,
y que si se olvida uno el fallo es cosmético, no un agujero.

### Filtro de Tenant

El aislamiento entre negocios descansa en tres piezas:

**1. La cabecera la pone el gateway, no el cliente.** El API Gateway lee el
`businessId` del JWT (o el primero de `businessIds`) y lo reenvía al backend como
`x-business-id`. Un cliente no puede falsificar el tenant porque la cabecera se
construye a partir del token verificado.

**2. La columna la aporta la entidad base.** Las tablas de negocio heredan de
`TenantEntity` (`packages/database`), que añade `business_id` indexada:

```typescript
export abstract class TenantEntity extends BaseEntity {
  @Column({ type: "uuid", name: "business_id" })
  @Index()
  businessId!: string;
}
```

**3. Cada consulta filtra explícitamente.** Los servicios incluyen `businessId` en
el `where` de las consultas de negocio:

```typescript
async findAll(businessId: string, paginacion: PaginationDto) {
  return this.repo.findAndCount({
    where: { businessId },
    skip: (paginacion.page - 1) * paginacion.limit,
    take: paginacion.limit,
  });
}
```

> Nota: el filtro es **explícito**, no automático. No hay un interceptor global que
> lo inyecte, así que olvidarlo en una consulta nueva es un fallo de aislamiento
> entre tenants que ninguna comprobación detecta hoy. Es el punto que más conviene
> reforzar con tests de integración.

---

## Casos Especiales

### Profesional Viendo Sus Propias Citas

**Regla**: Un profesional solo puede ver y actuar sobre las citas que le están asignadas.

**Implementación**:

```typescript
// En el servicio de citas
async getAppointments(user: RequestUser, filters: AppointmentFilters) {
  if (user.role === 'PROFESSIONAL') {
    // Forzar filtro por professionalId = userId
    filters.professionalId = user.id;
  }
  // Para OWNER, ADMIN, RECEPTIONIST: mostrar todas las del negocio
  // El BusinessScopeGuard ya filtró por businessId
  return this.appointmentRepo.findMany({ where: filters });
}
```

**Transiciones de estado permitidas al profesional**:

- `PENDING` -> `CONFIRMED` (confirmar cita)
- `CONFIRMED` -> `COMPLETED` (completar cita)
- `CONFIRMED` -> `NO_SHOW` (marcar inasistencia)
- No puede: crear citas, cancelar, reagendar, editar

### Cliente Viendo Su Propio Historial

**Regla**: Un cliente solo puede ver sus propias citas, pagos y reseñas.

**Implementación**:

```typescript
// En el servicio de citas
async getClientAppointments(user: RequestUser) {
  if (user.role === 'CLIENT') {
    // Forzar filtro por clientId = userId
    return this.appointmentRepo.findMany({
      where: {
        clientId: user.id,
        // No filtrar por businessId: el cliente es global
      },
    });
  }
}
```

**Acciones permitidas al cliente sobre sus citas**:

- Cancelar (mínimo 2 horas antes de la cita)
- Reagendar (mínimo 2 horas antes de la cita)
- Ver detalle completo de su cita
- Dejar reseña solo si la cita está en estado `COMPLETED`

### Recepcionista Creando Cita

**Regla**: La recepcionista puede crear citas para cualquier profesional del negocio,
pero no puede editar servicios ni configuraciones.

**Implementación**:

```typescript
@Roles('RECEPTIONIST', 'ADMIN', 'OWNER')
@UseGuards(AuthGuard, BusinessScopeGuard, RolesGuard)
@Post('/')
async createAppointment(
  @Body() dto: CreateAppointmentDto,
  @CurrentUser() user: RequestUser
) {
  // businessId se toma del contexto del usuario, no del body
  dto.businessId = user.businessId;
  // Validar que el profesional pertenezca al mismo negocio
  await this.validateProfessionalBelongsToBusiness(dto.professionalId, user.businessId);
  return this.bookingService.create(dto);
}
```

### SUPER_ADMIN Accediendo a Datos de Negocio

**Regla**: SUPER_ADMIN puede leer cualquier dato pero no crear citas ni registrar pagos.

**Implementación**:

```typescript
// El SUPER_ADMIN no tiene businessId en su JWT
// Para acceder a datos de un negocio específico, debe especificarlo
@Roles('SUPER_ADMIN')
@Get('/business/:businessId/appointments')
async getBusinessAppointments(
  @Param('businessId') businessId: string,
  @CurrentUser() user: RequestUser
) {
  // SUPER_ADMIN puede ver pero no modificar
  if (user.role === 'SUPER_ADMIN') {
    return this.appointmentRepo.findMany({
      where: { businessId },
    });
  }
}
```

### Acción Destructiva con Confirmación

**Regla**: Las acciones destructivas requieren confirmación explícita del usuario.

**Acciones que requieren confirmación**:

- Cancelar cita (CLIENT, PROFESSIONAL, RECEPTIONIST, ADMIN, OWNER)
- Eliminar servicio (ADMIN, OWNER)
- Desvincular profesional (ADMIN, OWNER)
- Eliminar negocio (OWNER)
- Suspender negocio (SUPER_ADMIN)

**Implementación**:

```typescript
@Delete('/appointments/:id')
async cancelAppointment(
  @Param('id') id: string,
  @Body() dto: { reason: string }, // Motivo obligatorio
  @CurrentUser() user: RequestUser
) {
  const appointment = await this.appointmentRepo.findById(id);

  // Validaciones según rol
  if (user.role === 'CLIENT') {
    if (appointment.clientId !== user.id) throw new ForbiddenException();
    if (!this.isMoreThan2HoursBefore(appointment.startTime)) {
      throw new BadRequestException(
        'Solo puedes cancelar con al menos 2 horas de anticipación'
      );
    }
  }

  if (user.role === 'PROFESSIONAL') {
    if (appointment.professionalId !== user.id) throw new ForbiddenException();
  }

  // Registrar motivo de cancelación
  appointment.cancellationReason = dto.reason;
  appointment.cancelledBy = user.role;
  appointment.status = 'CANCELLED';

  return this.appointmentRepo.save(appointment);
}
```

### Cambio de Rol por OWNER

**Regla**: El OWNER puede cambiar roles de los miembros de su negocio, excepto su propio
rol y el de otros OWNERs.

```typescript
@Roles('OWNER')
@Patch('/members/:membershipId/role')
async changeMemberRole(
  @Param('membershipId') membershipId: string,
  @Body() dto: { newRole: Role },
  @CurrentUser() user: RequestUser
) {
  const membership = await this.membershipRepo.findById(membershipId);

  // Validar que la membresía pertenezca al negocio del OWNER
  if (membership.businessId !== user.businessId) {
    throw new ForbiddenException();
  }

  // No puede cambiar el rol de otro OWNER
  if (membership.role === 'OWNER') {
    throw new ForbiddenException('No puedes modificar el rol de otro propietario');
  }

  // No puede asignar el rol OWNER (solo SUPER_ADMIN puede)
  if (dto.newRole === 'OWNER') {
    throw new ForbiddenException('Solo el administrador de plataforma puede asignar el rol de propietario');
  }

  // No puede cambiar su propio rol
  if (membership.userId === user.id) {
    throw new ForbiddenException('No puedes cambiar tu propio rol');
  }

  membership.role = dto.newRole;
  return this.membershipRepo.save(membership);
}
```

---

## Auditoría de Permisos

### Log de Auditoría

Todas las acciones sensibles se registran en una tabla de auditoría:

```typescript
model AuditLog {
  id          String   @id @default(uuid())
  userId      String
  businessId  String?
  action      String   // CREATE, READ, UPDATE, DELETE
  resource    String   // appointments, services, users, etc.
  resourceId  String?
  details     Json?    // Datos adicionales de la acción
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@map("audit_logs")
}
```

### Acciones Auditadas

| Recurso       | Acciones Auditadas                       | Nivel              |
| ------------- | ---------------------------------------- | ------------------ |
| Users         | Crear, editar rol, bloquear, desbloquear | Negocio            |
| Businesses    | Crear, editar, suspender, eliminar       | Plataforma         |
| Appointments  | Cancelar, reagendar, cambiar estado      | Negocio            |
| Payments      | Registrar, anular                        | Negocio            |
| Reviews       | Eliminar (moderación), reportar          | Negocio/Plataforma |
| Configuration | Cambios en configuración                 | Negocio/Plataforma |
| Memberships   | Crear, cambiar rol, desactivar           | Negocio            |

### Consultas de Auditoría

```typescript
// Obtener auditoría de un negocio (OWNER, ADMIN)
GET /api/audit?businessId={id}&resource=appointments&from=2024-01-01

// Obtener auditoría global (SUPER_ADMIN)
GET /api/audit?from=2024-01-01&action=DELETE
```

---

## Matriz de Permisos Simplificada (Resumen Visual)

```
                    SUPER_ADMIN  OWNER  ADMIN  PROF  RECP  CLIENT
                    -----------  -----  -----  ----  ----  ------
Negocios              FULL      OWN     READ   -     -     PUBLIC
Sucursales            READ      FULL    READ   -     -     -
Profesionales         READ      FULL    FULL   OWN   READ  PUBLIC
Servicios             READ      FULL    FULL   READ  READ  PUBLIC
Citas                 READ      FULL    FULL   OWN   CREATE OWN
Pagos                 READ      READ    CREATE -     CREATE OWN
Facturas              READ      READ    CREATE -     READ  OWN
Caja registradora     READ      READ    FULL   -     FULL  -
Notificaciones        READ      READ    READ   OWN   -     OWN
Reseñas               FULL      RESPOND RESPOND READ  READ  CREATE
Analíticas            FULL      FULL    FULL   OWN   -     -
Configuración         FULL      FULL    READ   -     -     OWN
Usuarios              FULL      READ    READ   OWN   READ  OWN
```

**Leyenda**:

- FULL: CRUD completo dentro del scope
- OWN: Solo datos propios
- READ: Solo lectura dentro del scope
- CREATE: Puede crear
- RESPOND: Puede responder
- PUBLIC: Datos públicos del marketplace
- -: Sin acceso
