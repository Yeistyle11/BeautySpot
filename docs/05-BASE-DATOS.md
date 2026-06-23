# BeautySpot SaaS - Documento de Base de Datos

## 1. Vision General

BeautySpot sigue el patron **database-per-service**: cada microservicio posee y gestiona su propia base de datos PostgreSQL. Ningun servicio puede acceder directamente a la base de datos de otro servicio. La comunicacion de datos entre servicios se realiza unicamente via API REST interna o eventos asincronos (RabbitMQ).

### Principios

1. **Propiedad de datos**: Cada servicio es el unico dueno y gestor de sus tablas
2. **Aislamiento multi-tenant**: Todas las tablas de negocio incluyen la columna `businessId` como filtro obligatorio
3. **Soft delete**: Las eliminaciones son logicas mediante la columna `deletedAt` (nullable)
4. **Auditoria**: Todas las tablas incluyen `createdAt` y `updatedAt`
5. **UUIDs**: Todos los identificadores primarios son UUIDs v4
6. **Nombres de tabla**: snake_case con plural (ej: `appointments`, `business_hours`)
7. **Columnas**: snake_case (ej: `business_id`, `first_name`, `created_at`)

### Convenciones de Columnas Comunes

Todas las tablas comparten estas columnas base:

| Columna     | Tipo         | Restriccion                    | Descripcion                               |
| ----------- | ------------ | ------------------------------ | ----------------------------------------- |
| `id`        | UUID         | PK, DEFAULT uuid_generate_v4() | Identificador unico                       |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()        | Fecha de creacion                         |
| `updatedAt` | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()        | Fecha de ultima actualizacion             |
| `deletedAt` | TIMESTAMP(3) | NULLABLE                       | Fecha de eliminacion logica (soft delete) |

---

## 2. Estrategia Database-per-Service

### Distribucion de Bases de Datos

```
PostgreSQL Instance
|
+-- beautyspot_auth          (Auth Service - Puerto 5432)
+-- beautyspot_core          (Core Service - Puerto 5434)
+-- beautyspot_booking       (Booking Service - Puerto 5435)
+-- beautyspot_payment       (Payment Service - Puerto 5436)
+-- beautyspot_notification  (Notification Service - Puerto 5437)
+-- beautyspot_marketplace   (Marketplace Service - Puerto 5438)
+-- beautyspot_analytics     (Analytics Service - Puerto 5439)
```

### Reglas de Aislamiento

- Cada servicio tiene su propio usuario de base de datos con acceso exclusivo a su BD
- Las migraciones se ejecutan de forma independiente por servicio
- No existen foreign keys entre bases de datos de diferentes servicios
- Las referencias a entidades de otros servicios se almacenan como UUID sin constraint de FK

---

## 3. Auth Service (auth_db)

### 3.1 Tabla: users

Almacena las cuentas de usuario de toda la plataforma.

| Columna                 | Tipo         | Restricciones              | Descripcion                             |
| ----------------------- | ------------ | -------------------------- | --------------------------------------- |
| `id`                    | UUID         | PK                         | Identificador del usuario               |
| `email`                 | VARCHAR(255) | UNIQUE, NOT NULL           | Email del usuario (login)               |
| `password_hash`         | VARCHAR(255) | NOT NULL                   | Hash bcrypt de la contrasena            |
| `first_name`            | VARCHAR(100) | NOT NULL                   | Nombre del usuario                      |
| `last_name`             | VARCHAR(100) | NOT NULL                   | Apellido del usuario                    |
| `phone`                 | VARCHAR(20)  | NULLABLE                   | Telefono del usuario                    |
| `avatar_url`            | VARCHAR(500) | NULLABLE                   | URL de la foto de perfil                |
| `email_verified_at`     | TIMESTAMP(3) | NULLABLE                   | Fecha de verificacion de email          |
| `status`                | VARCHAR(20)  | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, SUSPENDED, PENDING_VERIFICATION |
| `last_login_at`         | TIMESTAMP(3) | NULLABLE                   | Fecha del ultimo inicio de sesion       |
| `failed_login_attempts` | INTEGER      | NOT NULL, DEFAULT 0        | Contador de intentos fallidos           |
| `locked_until`          | TIMESTAMP(3) | NULLABLE                   | Fecha de desbloqueo de cuenta           |
| `google_id`             | VARCHAR(255) | NULLABLE, UNIQUE           | ID de Google OAuth                      |
| `createdAt`             | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de creacion                       |
| `updatedAt`             | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                  |
| `deletedAt`             | TIMESTAMP(3) | NULLABLE                   | Fecha de eliminacion logica             |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_status ON users(status);
```

### 3.2 Tabla: memberships

Relacion entre usuarios y negocios con el rol asignado. Un usuario puede pertenecer a multiples negocios con diferentes roles.

| Columna       | Tipo         | Restricciones              | Descripcion                                      |
| ------------- | ------------ | -------------------------- | ------------------------------------------------ |
| `id`          | UUID         | PK                         | Identificador de la membresia                    |
| `user_id`     | UUID         | NOT NULL, FK -> users(id)  | Usuario miembro                                  |
| `business_id` | UUID         | NOT NULL                   | Negocio al que pertenece (ref a core_db)         |
| `role`        | VARCHAR(20)  | NOT NULL                   | OWNER, ADMIN, PROFESSIONAL, RECEPTIONIST, CLIENT |
| `status`      | VARCHAR(20)  | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, PENDING                        |
| `invited_by`  | UUID         | NULLABLE                   | ID del usuario que invito                        |
| `invited_at`  | TIMESTAMP(3) | NULLABLE                   | Fecha de invitacion                              |
| `accepted_at` | TIMESTAMP(3) | NULLABLE                   | Fecha de aceptacion                              |
| `createdAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de creacion                                |
| `updatedAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                           |
| `deletedAt`   | TIMESTAMP(3) | NULLABLE                   | Fecha de eliminacion logica                      |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_memberships_user_business ON memberships(user_id, business_id) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_memberships_business_id ON memberships(business_id);
CREATE INDEX idx_memberships_role ON memberships(role);
```

### 3.3 Tabla: password_resets

Tokens temporales para recuperacion de contrasena.

| Columna      | Tipo         | Restricciones             | Descripcion                           |
| ------------ | ------------ | ------------------------- | ------------------------------------- |
| `id`         | UUID         | PK                        | Identificador del token               |
| `user_id`    | UUID         | NOT NULL, FK -> users(id) | Usuario que solicita el reset         |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE          | Hash del token de reset               |
| `expires_at` | TIMESTAMP(3) | NOT NULL                  | Fecha de expiracion (15 min)          |
| `used_at`    | TIMESTAMP(3) | NULLABLE                  | Fecha de uso (null si no se ha usado) |
| `ip_address` | VARCHAR(45)  | NULLABLE                  | Direccion IP desde donde se solicito  |
| `createdAt`  | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()   | Fecha de creacion                     |

**Indices**:

```sql
CREATE INDEX idx_password_resets_token ON password_resets(token_hash) WHERE used_at IS NULL;
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
```

### 3.4 Tabla: audit_logs

Registro de todas las operaciones sensibles realizadas en la plataforma.

| Columna         | Tipo         | Restricciones           | Descripcion                                           |
| --------------- | ------------ | ----------------------- | ----------------------------------------------------- |
| `id`            | UUID         | PK                      | Identificador del log                                 |
| `user_id`       | UUID         | NULLABLE                | Usuario que realizo la accion                         |
| `action`        | VARCHAR(50)  | NOT NULL                | Tipo de accion (LOGIN, LOGOUT, PASSWORD_CHANGE, etc.) |
| `resource_type` | VARCHAR(50)  | NOT NULL                | Tipo de recurso (USER, BUSINESS, APPOINTMENT, etc.)   |
| `resource_id`   | UUID         | NULLABLE                | ID del recurso afectado                               |
| `business_id`   | UUID         | NULLABLE                | Negocio relacionado (si aplica)                       |
| `details`       | JSONB        | NULLABLE                | Detalles adicionales de la accion                     |
| `ip_address`    | VARCHAR(45)  | NOT NULL                | Direccion IP del cliente                              |
| `user_agent`    | VARCHAR(500) | NULLABLE                | User-Agent del cliente                                |
| `status`        | VARCHAR(20)  | NOT NULL                | SUCCESS, FAILURE                                      |
| `createdAt`     | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha del evento                                      |

**Indices**:

```sql
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs("createdAt");
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

---

## 4. Core Service (core_db)

### 4.1 Tabla: businesses

Datos maestros de cada negocio (tenant) registrado en la plataforma.

| Columna                   | Tipo           | Restricciones                      | Descripcion                                  |
| ------------------------- | -------------- | ---------------------------------- | -------------------------------------------- |
| `id`                      | UUID           | PK                                 | Identificador del negocio                    |
| `owner_id`                | UUID           | NOT NULL                           | ID del usuario OWNER (ref a auth_db)         |
| `name`                    | VARCHAR(100)   | NOT NULL                           | Nombre del negocio                           |
| `slug`                    | VARCHAR(100)   | NOT NULL, UNIQUE                   | Slug para subdominio ({slug}.beautyspot.co)  |
| `description`             | TEXT           | NULLABLE                           | Descripcion del negocio                      |
| `type`                    | VARCHAR(30)    | NOT NULL                           | BARBERSHOP, SALON, SPA, AESTHETIC_CENTER     |
| `email`                   | VARCHAR(255)   | NULLABLE                           | Email de contacto del negocio                |
| `phone`                   | VARCHAR(20)    | NULLABLE                           | Telefono de contacto                         |
| `address`                 | VARCHAR(500)   | NULLABLE                           | Direccion fisica                             |
| `city`                    | VARCHAR(100)   | NULLABLE                           | Ciudad                                       |
| `state`                   | VARCHAR(100)   | NULLABLE                           | Departamento/Estado                          |
| `country`                 | VARCHAR(2)     | NOT NULL, DEFAULT 'CO'             | Codigo de pais ISO 3166-1 alpha-2            |
| `latitude`                | DECIMAL(10, 8) | NULLABLE                           | Latitud geografica                           |
| `longitude`               | DECIMAL(11, 8) | NULLABLE                           | Longitud geografica                          |
| `logo_url`                | VARCHAR(500)   | NULLABLE                           | URL del logo del negocio                     |
| `cover_image_url`         | VARCHAR(500)   | NULLABLE                           | URL de la imagen de portada                  |
| `timezone`                | VARCHAR(50)    | NOT NULL, DEFAULT 'America/Bogota' | Zona horaria IANA                            |
| `currency`                | VARCHAR(3)     | NOT NULL, DEFAULT 'COP'            | Codigo de moneda ISO 4217                    |
| `locale`                  | VARCHAR(5)     | NOT NULL, DEFAULT 'es-CO'          | Locale del negocio                           |
| `appointment_interval`    | INTEGER        | NOT NULL, DEFAULT 30               | Intervalo de citas en minutos                |
| `cancel_min_hours`        | INTEGER        | NOT NULL, DEFAULT 2                | Horas minimas para cancelar                  |
| `allow_online_booking`    | BOOLEAN        | NOT NULL, DEFAULT true             | Permitir reservas online                     |
| `status`                  | VARCHAR(20)    | NOT NULL, DEFAULT 'ACTIVE'         | ACTIVE, SUSPENDED, INACTIVE                  |
| `onboarding_completed`    | BOOLEAN        | NOT NULL, DEFAULT false            | Wizard de onboarding completado              |
| `onboarding_step`         | INTEGER        | NOT NULL, DEFAULT 0                | Paso actual del wizard (0-4)                 |
| `subscription_plan`       | VARCHAR(30)    | NOT NULL, DEFAULT 'FREE'           | FREE, BASIC, PREMIUM, ENTERPRISE             |
| `subscription_expires_at` | TIMESTAMP(3)   | NULLABLE                           | Fecha de expiracion de suscripcion           |
| `profile_completeness`    | INTEGER        | NOT NULL, DEFAULT 0                | Porcentaje de completitud del perfil (0-100) |
| `createdAt`               | TIMESTAMP(3)   | NOT NULL, DEFAULT NOW()            | Fecha de creacion                            |
| `updatedAt`               | TIMESTAMP(3)   | NOT NULL, DEFAULT NOW()            | Fecha de actualizacion                       |
| `deletedAt`               | TIMESTAMP(3)   | NULLABLE                           | Fecha de eliminacion logica                  |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_businesses_slug ON businesses(slug) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_type ON businesses(type);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_name ON businesses USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_businesses_location ON businesses(latitude, longitude) WHERE latitude IS NOT NULL;
```

### 4.2 Tabla: branches

Sucursales de cada negocio.

| Columna       | Tipo           | Restricciones              | Descripcion                  |
| ------------- | -------------- | -------------------------- | ---------------------------- |
| `id`          | UUID           | PK                         | Identificador de la sucursal |
| `business_id` | UUID           | NOT NULL                   | Negocio al que pertenece     |
| `name`        | VARCHAR(100)   | NOT NULL                   | Nombre de la sucursal        |
| `address`     | VARCHAR(500)   | NULLABLE                   | Direccion de la sucursal     |
| `phone`       | VARCHAR(20)    | NULLABLE                   | Telefono de la sucursal      |
| `city`        | VARCHAR(100)   | NULLABLE                   | Ciudad                       |
| `latitude`    | DECIMAL(10, 8) | NULLABLE                   | Latitud                      |
| `longitude`   | DECIMAL(11, 8) | NULLABLE                   | Longitud                     |
| `is_main`     | BOOLEAN        | NOT NULL, DEFAULT false    | Sucursal principal           |
| `status`      | VARCHAR(20)    | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE             |
| `createdAt`   | TIMESTAMP(3)   | NOT NULL, DEFAULT NOW()    | Fecha de creacion            |
| `updatedAt`   | TIMESTAMP(3)   | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion       |
| `deletedAt`   | TIMESTAMP(3)   | NULLABLE                   | Fecha de eliminacion logica  |

**Indices**:

```sql
CREATE INDEX idx_branches_business_id ON branches(business_id);
CREATE INDEX idx_branches_status ON branches(status) WHERE "deletedAt" IS NULL;
```

### 4.3 Tabla: professionals

Perfiles de los profesionales que trabajan en un negocio.

| Columna        | Tipo          | Restricciones              | Descripcion                                       |
| -------------- | ------------- | -------------------------- | ------------------------------------------------- |
| `id`           | UUID          | PK                         | Identificador del profesional                     |
| `business_id`  | UUID          | NOT NULL                   | Negocio al que pertenece                          |
| `branch_id`    | UUID          | NULLABLE                   | Sucursal principal (ref a branches)               |
| `user_id`      | UUID          | NULLABLE                   | Vinculacion con cuenta de usuario (ref a auth_db) |
| `first_name`   | VARCHAR(100)  | NOT NULL                   | Nombre                                            |
| `last_name`    | VARCHAR(100)  | NOT NULL                   | Apellido                                          |
| `display_name` | VARCHAR(200)  | NULLABLE                   | Nombre para mostrar (si difiere del real)         |
| `bio`          | TEXT          | NULLABLE                   | Biografia del profesional                         |
| `specialties`  | TEXT[]        | NULLABLE                   | Lista de especialidades                           |
| `avatar_url`   | VARCHAR(500)  | NULLABLE                   | URL de la foto de perfil                          |
| `phone`        | VARCHAR(20)   | NULLABLE                   | Telefono de contacto                              |
| `email`        | VARCHAR(255)  | NULLABLE                   | Email de contacto                                 |
| `rating_avg`   | DECIMAL(3, 2) | NULLABLE                   | Calificacion promedio (1.00-5.00)                 |
| `review_count` | INTEGER       | NOT NULL, DEFAULT 0        | Total de resenas recibidas                        |
| `sort_order`   | INTEGER       | NOT NULL, DEFAULT 0        | Orden de prioridad                                |
| `status`       | VARCHAR(20)   | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE                                  |
| `createdAt`    | TIMESTAMP(3)  | NOT NULL, DEFAULT NOW()    | Fecha de creacion                                 |
| `updatedAt`    | TIMESTAMP(3)  | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                            |
| `deletedAt`    | TIMESTAMP(3)  | NULLABLE                   | Fecha de eliminacion logica                       |

**Indices**:

```sql
CREATE INDEX idx_professionals_business_id ON professionals(business_id);
CREATE INDEX idx_professionals_branch_id ON professionals(branch_id);
CREATE INDEX idx_professionals_user_id ON professionals(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_professionals_status ON professionals(status, business_id) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_professionals_name ON professionals USING gin(to_tsvector('spanish', first_name || ' ' || last_name));
```

### 4.4 Tabla: services

Catalogo de servicios ofrecidos por un negocio.

| Columna       | Tipo         | Restricciones              | Descripcion                                                                                  |
| ------------- | ------------ | -------------------------- | -------------------------------------------------------------------------------------------- |
| `id`          | UUID         | PK                         | Identificador del servicio                                                                   |
| `business_id` | UUID         | NOT NULL                   | Negocio al que pertenece                                                                     |
| `name`        | VARCHAR(150) | NOT NULL                   | Nombre del servicio                                                                          |
| `description` | TEXT         | NULLABLE                   | Descripcion detallada                                                                        |
| `category`    | VARCHAR(50)  | NOT NULL                   | Categoria: Cortes, Barba, Paquetes, Tratamientos, Otros                                      |
| `base_price`  | INTEGER      | NOT NULL                   | Precio base en centavos (ej: 25000 COP = 2500000 centavos, o valor directo en unidad minima) |
| `duration`    | INTEGER      | NOT NULL                   | Duracion en minutos                                                                          |
| `image_url`   | VARCHAR(500) | NULLABLE                   | URL de imagen del servicio                                                                   |
| `tags`        | TEXT[]       | NULLABLE                   | Etiquetas para busqueda                                                                      |
| `sort_order`  | INTEGER      | NOT NULL, DEFAULT 0        | Orden de visualizacion                                                                       |
| `status`      | VARCHAR(20)  | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE                                                                             |
| `createdAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de creacion                                                                            |
| `updatedAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                                                                       |
| `deletedAt`   | TIMESTAMP(3) | NULLABLE                   | Fecha de eliminacion logica                                                                  |

**Indices**:

```sql
CREATE INDEX idx_services_business_id ON services(business_id);
CREATE INDEX idx_services_category ON services(business_id, category);
CREATE INDEX idx_services_status ON services(status, business_id) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_services_name ON services USING gin(to_tsvector('spanish', name));
CREATE UNIQUE INDEX idx_services_business_name ON services(business_id, name) WHERE "deletedAt" IS NULL;
```

### 4.5 Tabla: professional_services

Tabla join que relaciona profesionales con los servicios que pueden realizar, con precio y duracion personalizados.

| Columna           | Tipo         | Restricciones                     | Descripcion                                    |
| ----------------- | ------------ | --------------------------------- | ---------------------------------------------- |
| `id`              | UUID         | PK                                | Identificador de la relacion                   |
| `professional_id` | UUID         | NOT NULL, FK -> professionals(id) | Profesional                                    |
| `service_id`      | UUID         | NOT NULL, FK -> services(id)      | Servicio                                       |
| `custom_price`    | INTEGER      | NULLABLE                          | Precio personalizado (sobreescribe base_price) |
| `custom_duration` | INTEGER      | NULLABLE                          | Duracion personalizada en minutos              |
| `is_active`       | BOOLEAN      | NOT NULL, DEFAULT true            | Relacion activa                                |
| `createdAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()           | Fecha de creacion                              |
| `updatedAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()           | Fecha de actualizacion                         |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_prof_svc_prof_service ON professional_services(professional_id, service_id);
CREATE INDEX idx_prof_svc_service ON professional_services(service_id);
CREATE INDEX idx_prof_svc_active ON professional_services(professional_id, is_active);
```

### 4.6 Tabla: clients

Clientes registrados en cada negocio. Los datos son privados del negocio (no compartidos).

| Columna         | Tipo         | Restricciones              | Descripcion                                         |
| --------------- | ------------ | -------------------------- | --------------------------------------------------- |
| `id`            | UUID         | PK                         | Identificador del cliente                           |
| `business_id`   | UUID         | NOT NULL                   | Negocio al que pertenece                            |
| `user_id`       | UUID         | NULLABLE                   | Vinculacion con usuario del sistema (ref a auth_db) |
| `first_name`    | VARCHAR(100) | NOT NULL                   | Nombre                                              |
| `last_name`     | VARCHAR(100) | NULLABLE                   | Apellido                                            |
| `email`         | VARCHAR(255) | NULLABLE                   | Email del cliente                                   |
| `phone`         | VARCHAR(20)  | NOT NULL                   | Telefono del cliente                                |
| `birth_date`    | DATE         | NULLABLE                   | Fecha de nacimiento                                 |
| `notes`         | TEXT         | NULLABLE                   | Notas internas del negocio                          |
| `tags`          | TEXT[]       | NULLABLE                   | Etiquetas de segmentacion (VIP, nuevo, frecuente)   |
| `total_visits`  | INTEGER      | NOT NULL, DEFAULT 0        | Total de visitas (citas completadas)                |
| `total_spent`   | BIGINT       | NOT NULL, DEFAULT 0        | Total gastado en centavos                           |
| `last_visit_at` | TIMESTAMP(3) | NULLABLE                   | Fecha de ultima visita                              |
| `status`        | VARCHAR(20)  | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, INACTIVE                                    |
| `createdAt`     | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de creacion                                   |
| `updatedAt`     | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                              |
| `deletedAt`     | TIMESTAMP(3) | NULLABLE                   | Fecha de eliminacion logica                         |

**Indices**:

```sql
CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_phone ON clients(business_id, phone) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_clients_email ON clients(business_id, email) WHERE email IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX idx_clients_name ON clients USING gin(to_tsvector('spanish', first_name || ' ' || COALESCE(last_name, '')));
CREATE INDEX idx_clients_user_id ON clients(user_id) WHERE user_id IS NOT NULL;
```

### 4.7 Tabla: business_hours

Horarios de operacion del negocio por dia de la semana.

| Columna       | Tipo         | Restricciones           | Descripcion                                         |
| ------------- | ------------ | ----------------------- | --------------------------------------------------- |
| `id`          | UUID         | PK                      | Identificador                                       |
| `business_id` | UUID         | NOT NULL                | Negocio                                             |
| `branch_id`   | UUID         | NULLABLE                | Sucursal (null = aplica al negocio general)         |
| `day_of_week` | INTEGER      | NOT NULL                | Dia de la semana: 0=Domingo, 1=Lunes, ..., 6=Sabado |
| `is_closed`   | BOOLEAN      | NOT NULL, DEFAULT false | Dia cerrado                                         |
| `open_time`   | TIME         | NULLABLE                | Hora de apertura (ej: 09:00)                        |
| `close_time`  | TIME         | NULLABLE                | Hora de cierre (ej: 18:00)                          |
| `break_start` | TIME         | NULLABLE                | Inicio del almuerzo/descanso                        |
| `break_end`   | TIME         | NULLABLE                | Fin del almuerzo/descanso                           |
| `createdAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de creacion                                   |
| `updatedAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de actualizacion                              |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_bh_business_day ON business_hours(business_id, branch_id, day_of_week);
CREATE INDEX idx_bh_branch ON business_hours(branch_id);
```

### 4.8 Tabla: business_config

Configuracion avanzada del negocio (key-value).

| Columna       | Tipo         | Restricciones           | Descripcion               |
| ------------- | ------------ | ----------------------- | ------------------------- |
| `id`          | UUID         | PK                      | Identificador             |
| `business_id` | UUID         | NOT NULL                | Negocio                   |
| `key`         | VARCHAR(100) | NOT NULL                | Clave de configuracion    |
| `value`       | JSONB        | NOT NULL                | Valor de la configuracion |
| `createdAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de creacion         |
| `updatedAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de actualizacion    |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_bconfig_business_key ON business_config(business_id, key);
```

**Claves de configuracion predefinidas**:

- `payment_methods`: Array de metodos aceptados ["CASH", "TRANSFER", "CARD"]
- `auto_confirm_appointments`: Boolean (confirmar automaticamente citas del cliente)
- `reminder_24h_enabled`: Boolean
- `reminder_1h_enabled`: Boolean
- `allow_reviews`: Boolean
- `moderate_reviews`: Boolean

---

## 5. Booking Service (booking_db)

### 5.1 Tabla: appointments

Citas agendadas en el sistema. Entidad central del flujo de reservas.

| Columna                   | Tipo         | Restricciones               | Descripcion                                       |
| ------------------------- | ------------ | --------------------------- | ------------------------------------------------- |
| `id`                      | UUID         | PK                          | Identificador de la cita                          |
| `business_id`             | UUID         | NOT NULL                    | Negocio                                           |
| `branch_id`               | UUID         | NULLABLE                    | Sucursal                                          |
| `client_id`               | UUID         | NOT NULL                    | Cliente (ref a core_db)                           |
| `professional_id`         | UUID         | NOT NULL                    | Profesional (ref a core_db)                       |
| `status`                  | VARCHAR(20)  | NOT NULL, DEFAULT 'PENDING' | PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW |
| `start_time`              | TIMESTAMP(3) | NOT NULL                    | Hora de inicio de la cita                         |
| `end_time`                | TIMESTAMP(3) | NOT NULL                    | Hora de fin de la cita (calculada)                |
| `total_duration`          | INTEGER      | NOT NULL                    | Duracion total en minutos                         |
| `total_price`             | BIGINT       | NOT NULL                    | Precio total en centavos                          |
| `client_notes`            | TEXT         | NULLABLE                    | Notas visibles para el cliente                    |
| `internal_notes`          | TEXT         | NULLABLE                    | Notas internas del negocio                        |
| `cancellation_reason`     | TEXT         | NULLABLE                    | Motivo de cancelacion                             |
| `cancelled_by`            | UUID         | NULLABLE                    | ID del usuario que cancelo                        |
| `cancelled_at`            | TIMESTAMP(3) | NULLABLE                    | Fecha de cancelacion                              |
| `completed_at`            | TIMESTAMP(3) | NULLABLE                    | Fecha de completado                               |
| `no_show_at`              | TIMESTAMP(3) | NULLABLE                    | Fecha de marcacion de no-show                     |
| `no_show_marked_by`       | UUID         | NULLABLE                    | ID del usuario que marco no-show                  |
| `confirmed_at`            | TIMESTAMP(3) | NULLABLE                    | Fecha de confirmacion                             |
| `confirmed_by`            | UUID         | NULLABLE                    | ID del usuario que confirmo                       |
| `created_by`              | UUID         | NULLABLE                    | ID del usuario que creo la cita                   |
| `source`                  | VARCHAR(20)  | NOT NULL, DEFAULT 'MANUAL'  | MANUAL, ONLINE (web), MARKETPLACE                 |
| `original_appointment_id` | UUID         | NULLABLE                    | ID de la cita original (si es reagendamiento)     |
| `createdAt`               | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()     | Fecha de creacion                                 |
| `updatedAt`               | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()     | Fecha de actualizacion                            |
| `deletedAt`               | TIMESTAMP(3) | NULLABLE                    | Fecha de eliminacion logica                       |

**Indices**:

```sql
CREATE INDEX idx_appt_business_id ON appointments(business_id);
CREATE INDEX idx_appt_professional ON appointments(professional_id, start_time);
CREATE INDEX idx_appt_client ON appointments(client_id);
CREATE INDEX idx_appt_status ON appointments(business_id, status);
CREATE INDEX idx_appt_date ON appointments(business_id, start_time);
CREATE INDEX idx_appt_start_time ON appointments(start_time);
CREATE INDEX idx_appt_prof_date_status ON appointments(professional_id, start_time, status) WHERE "deletedAt" IS NULL AND status IN ('PENDING', 'CONFIRMED');
-- Indice critico para prevencion de solapamiento
CREATE INDEX idx_appt_overlap ON appointments(professional_id, start_time, end_time) WHERE "deletedAt" IS NULL AND status IN ('PENDING', 'CONFIRMED');
```

### 5.2 Tabla: appointment_services

Servicios incluidos en cada cita (relacion many-to-many).

| Columna           | Tipo         | Restricciones                                      | Descripcion                             |
| ----------------- | ------------ | -------------------------------------------------- | --------------------------------------- |
| `id`              | UUID         | PK                                                 | Identificador                           |
| `appointment_id`  | UUID         | NOT NULL, FK -> appointments(id) ON DELETE CASCADE | Cita                                    |
| `service_id`      | UUID         | NOT NULL                                           | Servicio (ref a core_db)                |
| `service_name`    | VARCHAR(150) | NOT NULL                                           | Nombre del servicio (snapshot)          |
| `professional_id` | UUID         | NOT NULL                                           | Profesional que lo realiza              |
| `price`           | BIGINT       | NOT NULL                                           | Precio al momento de la cita (snapshot) |
| `duration`        | INTEGER      | NOT NULL                                           | Duracion en minutos (snapshot)          |
| `sort_order`      | INTEGER      | NOT NULL, DEFAULT 0                                | Orden de ejecucion                      |
| `createdAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()                            | Fecha de creacion                       |

**Indices**:

```sql
CREATE INDEX idx_appt_svc_appointment ON appointment_services(appointment_id);
CREATE INDEX idx_appt_svc_service ON appointment_services(service_id);
```

### 5.3 Tabla: availabilities

Horarios regulares de disponibilidad de cada profesional.

| Columna           | Tipo         | Restricciones           | Descripcion                                         |
| ----------------- | ------------ | ----------------------- | --------------------------------------------------- |
| `id`              | UUID         | PK                      | Identificador                                       |
| `business_id`     | UUID         | NOT NULL                | Negocio                                             |
| `professional_id` | UUID         | NOT NULL                | Profesional (ref a core_db)                         |
| `day_of_week`     | INTEGER      | NOT NULL                | Dia de la semana: 0=Domingo, 1=Lunes, ..., 6=Sabado |
| `start_time`      | TIME         | NOT NULL                | Hora de inicio de disponibilidad                    |
| `end_time`        | TIME         | NOT NULL                | Hora de fin de disponibilidad                       |
| `is_active`       | BOOLEAN      | NOT NULL, DEFAULT true  | Disponibilidad activa                               |
| `valid_from`      | DATE         | NULLABLE                | Fecha desde la que aplica (null = siempre)          |
| `valid_until`     | DATE         | NULLABLE                | Fecha hasta la que aplica (null = siempre)          |
| `createdAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de creacion                                   |
| `updatedAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de actualizacion                              |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_avail_prof_day ON availabilities(professional_id, day_of_week) WHERE is_active = true;
CREATE INDEX idx_avail_business ON availabilities(business_id);
CREATE INDEX idx_avail_professional ON availabilities(professional_id);
```

### 5.4 Tabla: blocked_slots

Bloqueos de disponibilidad de un profesional (vacaciones, ausencias, slots especificos).

| Columna           | Tipo         | Restricciones               | Descripcion                                     |
| ----------------- | ------------ | --------------------------- | ----------------------------------------------- |
| `id`              | UUID         | PK                          | Identificador                                   |
| `business_id`     | UUID         | NOT NULL                    | Negocio                                         |
| `professional_id` | UUID         | NOT NULL                    | Profesional (ref a core_db)                     |
| `start_time`      | TIMESTAMP(3) | NOT NULL                    | Inicio del bloqueo                              |
| `end_time`        | TIMESTAMP(3) | NOT NULL                    | Fin del bloqueo                                 |
| `reason`          | VARCHAR(200) | NULLABLE                    | Motivo del bloqueo                              |
| `type`            | VARCHAR(20)  | NOT NULL, DEFAULT 'BLOCKED' | VACATION, SICK_LEAVE, PERSONAL, BLOCKED, BUFFER |
| `created_by`      | UUID         | NULLABLE                    | Usuario que creo el bloqueo                     |
| `createdAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()     | Fecha de creacion                               |
| `updatedAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()     | Fecha de actualizacion                          |
| `deletedAt`       | TIMESTAMP(3) | NULLABLE                    | Fecha de eliminacion logica                     |

**Indices**:

```sql
CREATE INDEX idx_blocked_prof_date ON blocked_slots(professional_id, start_time, end_time) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_blocked_business ON blocked_slots(business_id);
CREATE INDEX idx_blocked_start ON blocked_slots(start_time) WHERE "deletedAt" IS NULL;
```

---

## 6. Payment Service (payment_db)

### 6.1 Tabla: payments

Registro de pagos asociados a citas.

| Columna           | Tipo         | Restricciones                 | Descripcion                           |
| ----------------- | ------------ | ----------------------------- | ------------------------------------- |
| `id`              | UUID         | PK                            | Identificador                         |
| `business_id`     | UUID         | NOT NULL                      | Negocio                               |
| `appointment_id`  | UUID         | NOT NULL                      | Cita asociada (ref a booking_db)      |
| `client_id`       | UUID         | NOT NULL                      | Cliente (ref a core_db)               |
| `professional_id` | UUID         | NOT NULL                      | Profesional (ref a core_db)           |
| `amount`          | BIGINT       | NOT NULL, CHECK(amount > 0)   | Monto del pago en centavos            |
| `tip`             | BIGINT       | NOT NULL, DEFAULT 0           | Propina en centavos                   |
| `method`          | VARCHAR(20)  | NOT NULL                      | CASH, TRANSFER, CARD, OTHER           |
| `status`          | VARCHAR(20)  | NOT NULL, DEFAULT 'COMPLETED' | PENDING, COMPLETED, REFUNDED, PARTIAL |
| `reference`       | VARCHAR(100) | NULLABLE                      | Numero de referencia (transferencia)  |
| `notes`           | TEXT         | NULLABLE                      | Notas del pago                        |
| `registered_by`   | UUID         | NOT NULL                      | Usuario que registro el pago          |
| `registered_at`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()       | Fecha de registro                     |
| `createdAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()       | Fecha de creacion                     |
| `updatedAt`       | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()       | Fecha de actualizacion                |
| `deletedAt`       | TIMESTAMP(3) | NULLABLE                      | Fecha de eliminacion logica           |

**Indices**:

```sql
CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_payments_appointment ON payments(appointment_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_professional ON payments(professional_id);
CREATE INDEX idx_payments_date ON payments(business_id, registered_at);
CREATE INDEX idx_payments_method ON payments(business_id, method);
```

### 6.2 Tabla: invoices

Recibos/facturas generados para los pagos.

| Columna          | Tipo         | Restricciones              | Descripcion                                |
| ---------------- | ------------ | -------------------------- | ------------------------------------------ |
| `id`             | UUID         | PK                         | Identificador                              |
| `business_id`    | UUID         | NOT NULL                   | Negocio                                    |
| `invoice_number` | VARCHAR(50)  | NOT NULL                   | Numero de recibo (consecutivo por negocio) |
| `client_id`      | UUID         | NOT NULL                   | Cliente (ref a core_db)                    |
| `appointment_id` | UUID         | NOT NULL                   | Cita asociada                              |
| `subtotal`       | BIGINT       | NOT NULL                   | Subtotal en centavos                       |
| `tax`            | BIGINT       | NOT NULL, DEFAULT 0        | Impuesto en centavos                       |
| `total`          | BIGINT       | NOT NULL                   | Total en centavos                          |
| `status`         | VARCHAR(20)  | NOT NULL, DEFAULT 'ISSUED' | ISSUED, CANCELLED, VOID                    |
| `issued_at`      | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de emision                           |
| `pdf_url`        | VARCHAR(500) | NULLABLE                   | URL del PDF generado                       |
| `cancelled_at`   | TIMESTAMP(3) | NULLABLE                   | Fecha de anulacion                         |
| `cancel_reason`  | TEXT         | NULLABLE                   | Motivo de anulacion                        |
| `createdAt`      | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de creacion                          |
| `updatedAt`      | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                     |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_invoices_number ON invoices(business_id, invoice_number);
CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_appointment ON invoices(appointment_id);
CREATE INDEX idx_invoices_date ON invoices(business_id, issued_at);
```

### 6.3 Tabla: invoice_items

Items detallados de cada factura.

| Columna       | Tipo         | Restricciones                                  | Descripcion                   |
| ------------- | ------------ | ---------------------------------------------- | ----------------------------- |
| `id`          | UUID         | PK                                             | Identificador                 |
| `invoice_id`  | UUID         | NOT NULL, FK -> invoices(id) ON DELETE CASCADE | Factura                       |
| `description` | VARCHAR(200) | NOT NULL                                       | Descripcion del item          |
| `quantity`    | INTEGER      | NOT NULL, DEFAULT 1                            | Cantidad                      |
| `unit_price`  | BIGINT       | NOT NULL                                       | Precio unitario en centavos   |
| `total`       | BIGINT       | NOT NULL                                       | Total del item en centavos    |
| `type`        | VARCHAR(20)  | NOT NULL, DEFAULT 'SERVICE'                    | SERVICE, TIP, DISCOUNT, OTHER |
| `sort_order`  | INTEGER      | NOT NULL, DEFAULT 0                            | Orden                         |
| `createdAt`   | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()                        | Fecha de creacion             |

**Indices**:

```sql
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
```

### 6.4 Tabla: cash_sessions

Sesiones de caja (apertura y cierre diario).

| Columna             | Tipo         | Restricciones            | Descripcion                             |
| ------------------- | ------------ | ------------------------ | --------------------------------------- |
| `id`                | UUID         | PK                       | Identificador                           |
| `business_id`       | UUID         | NOT NULL                 | Negocio                                 |
| `branch_id`         | UUID         | NULLABLE                 | Sucursal                                |
| `opened_by`         | UUID         | NOT NULL                 | Usuario que abrio la caja               |
| `opened_at`         | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()  | Fecha/hora de apertura                  |
| `opening_amount`    | BIGINT       | NOT NULL, DEFAULT 0      | Monto inicial en caja (centavos)        |
| `closed_by`         | UUID         | NULLABLE                 | Usuario que cerro la caja               |
| `closed_at`         | TIMESTAMP(3) | NULLABLE                 | Fecha/hora de cierre                    |
| `expected_amount`   | BIGINT       | NULLABLE                 | Monto esperado al cierre (centavos)     |
| `actual_amount`     | BIGINT       | NULLABLE                 | Monto real contado al cierre (centavos) |
| `difference`        | BIGINT       | NULLABLE                 | Diferencia (real - esperado, centavos)  |
| `difference_reason` | TEXT         | NULLABLE                 | Motivo de la diferencia                 |
| `total_income`      | BIGINT       | NULLABLE                 | Total ingresos del dia (centavos)       |
| `total_expense`     | BIGINT       | NULLABLE                 | Total egresos del dia (centavos)        |
| `status`            | VARCHAR(20)  | NOT NULL, DEFAULT 'OPEN' | OPEN, CLOSED                            |
| `notes`             | TEXT         | NULLABLE                 | Notas generales                         |
| `createdAt`         | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()  | Fecha de creacion                       |
| `updatedAt`         | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()  | Fecha de actualizacion                  |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_cash_session_open ON cash_sessions(business_id, branch_id) WHERE status = 'OPEN';
CREATE INDEX idx_cash_session_business ON cash_sessions(business_id);
CREATE INDEX idx_cash_session_date ON cash_sessions(business_id, opened_at);
CREATE INDEX idx_cash_session_branch ON cash_sessions(branch_id);
```

### 6.5 Tabla: cash_movements

Movimientos de caja (ingresos y egresos) durante una sesion.

| Columna         | Tipo         | Restricciones                     | Descripcion                                           |
| --------------- | ------------ | --------------------------------- | ----------------------------------------------------- |
| `id`            | UUID         | PK                                | Identificador                                         |
| `session_id`    | UUID         | NOT NULL, FK -> cash_sessions(id) | Sesion de caja                                        |
| `business_id`   | UUID         | NOT NULL                          | Negocio                                               |
| `type`          | VARCHAR(20)  | NOT NULL                          | INCOME, EXPENSE                                       |
| `amount`        | BIGINT       | NOT NULL, CHECK(amount > 0)       | Monto en centavos                                     |
| `description`   | VARCHAR(200) | NOT NULL                          | Descripcion del movimiento                            |
| `category`      | VARCHAR(50)  | NULLABLE                          | Categoria (PAYMENT, TIP, PURCHASE, WITHDRAWAL, OTHER) |
| `payment_id`    | UUID         | NULLABLE                          | Pago asociado (si es ingreso automatico)              |
| `registered_by` | UUID         | NOT NULL                          | Usuario que registro el movimiento                    |
| `createdAt`     | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()           | Fecha de creacion                                     |

**Indices**:

```sql
CREATE INDEX idx_cash_mov_session ON cash_movements(session_id);
CREATE INDEX idx_cash_mov_business ON cash_movements(business_id);
CREATE INDEX idx_cash_mov_type ON cash_movements(session_id, type);
CREATE INDEX idx_cash_mov_date ON cash_movements(business_id, "createdAt");
```

---

## 7. Notification Service (notification_db)

### 7.1 Tabla: notifications

Notificaciones in-app para los usuarios.

| Columna          | Tipo         | Restricciones              | Descripcion                                               |
| ---------------- | ------------ | -------------------------- | --------------------------------------------------------- |
| `id`             | UUID         | PK                         | Identificador                                             |
| `user_id`        | UUID         | NOT NULL                   | Usuario destinatario (ref a auth_db)                      |
| `business_id`    | UUID         | NULLABLE                   | Negocio relacionado                                       |
| `type`           | VARCHAR(50)  | NOT NULL                   | Tipo de notificacion                                      |
| `title`          | VARCHAR(200) | NOT NULL                   | Titulo de la notificacion                                 |
| `message`        | TEXT         | NOT NULL                   | Mensaje de la notificacion                                |
| `data`           | JSONB        | NULLABLE                   | Datos adicionales (IDs, URLs)                             |
| `is_read`        | BOOLEAN      | NOT NULL, DEFAULT false    | Leida por el usuario                                      |
| `read_at`        | TIMESTAMP(3) | NULLABLE                   | Fecha de lectura                                          |
| `channel`        | VARCHAR(20)  | NOT NULL, DEFAULT 'IN_APP' | IN_APP, EMAIL, PUSH                                       |
| `sent_at`        | TIMESTAMP(3) | NULLABLE                   | Fecha de envio real                                       |
| `reference_type` | VARCHAR(50)  | NULLABLE                   | Tipo de entidad referenciada (APPOINTMENT, PAYMENT, etc.) |
| `reference_id`   | UUID         | NULLABLE                   | ID de la entidad referenciada                             |
| `expires_at`     | TIMESTAMP(3) | NULLABLE                   | Fecha de expiracion (auto-eliminacion)                    |
| `createdAt`      | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de creacion                                         |
| `updatedAt`      | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()    | Fecha de actualizacion                                    |

**Indices**:

```sql
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notif_user ON notifications(user_id, "createdAt" DESC);
CREATE INDEX idx_notif_business ON notifications(business_id);
CREATE INDEX idx_notif_type ON notifications(type);
CREATE INDEX idx_notif_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;
```

### 7.2 Tabla: notification_preferences

Preferencias de notificacion de cada usuario, configurables por tipo y canal.

| Columna             | Tipo         | Restricciones           | Descripcion                         |
| ------------------- | ------------ | ----------------------- | ----------------------------------- |
| `id`                | UUID         | PK                      | Identificador                       |
| `user_id`           | UUID         | NOT NULL                | Usuario                             |
| `business_id`       | UUID         | NULLABLE                | Negocio (null = preferencia global) |
| `event_type`        | VARCHAR(50)  | NOT NULL                | Tipo de evento                      |
| `in_app_enabled`    | BOOLEAN      | NOT NULL, DEFAULT true  | Notificacion in-app habilitada      |
| `email_enabled`     | BOOLEAN      | NOT NULL, DEFAULT true  | Notificacion por email habilitada   |
| `push_enabled`      | BOOLEAN      | NOT NULL, DEFAULT true  | Notificacion push habilitada        |
| `quiet_hours_start` | TIME         | NULLABLE                | Inicio de horario de silencio       |
| `quiet_hours_end`   | TIME         | NULLABLE                | Fin de horario de silencio          |
| `createdAt`         | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de creacion                   |
| `updatedAt`         | TIMESTAMP(3) | NOT NULL, DEFAULT NOW() | Fecha de actualizacion              |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_notif_pref_user_event ON notification_preferences(user_id, business_id, event_type);
CREATE INDEX idx_notif_pref_user ON notification_preferences(user_id);
```

---

## 8. Marketplace Service (marketplace_db)

### 8.1 Tabla: business_profiles

Perfil publico del negocio, optimizado para busqueda y visualizacion publica. Este es un modelo de lectura que se sincroniza desde los datos del Core Service via eventos.

| Columna                 | Tipo           | Restricciones           | Descripcion                                        |
| ----------------------- | -------------- | ----------------------- | -------------------------------------------------- |
| `id`                    | UUID           | PK                      | Identificador (mismo ID que businesses en core_db) |
| `business_id`           | UUID           | NOT NULL, UNIQUE        | ID del negocio en core_db                          |
| `name`                  | VARCHAR(100)   | NOT NULL                | Nombre del negocio                                 |
| `slug`                  | VARCHAR(100)   | NOT NULL, UNIQUE        | Slug para URL                                      |
| `description`           | TEXT           | NULLABLE                | Descripcion publica                                |
| `type`                  | VARCHAR(30)    | NOT NULL                | Tipo de negocio                                    |
| `address`               | VARCHAR(500)   | NULLABLE                | Direccion                                          |
| `city`                  | VARCHAR(100)   | NULLABLE                | Ciudad                                             |
| `latitude`              | DECIMAL(10, 8) | NULLABLE                | Latitud                                            |
| `longitude`             | DECIMAL(11, 8) | NULLABLE                | Longitud                                           |
| `logo_url`              | VARCHAR(500)   | NULLABLE                | Logo                                               |
| `cover_image_url`       | VARCHAR(500)   | NULLABLE                | Imagen de portada                                  |
| `phone`                 | VARCHAR(20)    | NULLABLE                | Telefono                                           |
| `timezone`              | VARCHAR(50)    | NOT NULL                | Zona horaria                                       |
| `currency`              | VARCHAR(3)     | NOT NULL                | Moneda                                             |
| `rating_avg`            | DECIMAL(3, 2)  | NULLABLE                | Calificacion promedio                              |
| `review_count`          | INTEGER        | NOT NULL, DEFAULT 0     | Total de resenas                                   |
| `appointment_count`     | INTEGER        | NOT NULL, DEFAULT 0     | Total de citas (para popularidad)                  |
| `price_range_min`       | INTEGER        | NULLABLE                | Precio minimo de servicios                         |
| `price_range_max`       | INTEGER        | NULLABLE                | Precio maximo de servicios                         |
| `services_summary`      | JSONB          | NULLABLE                | Resumen de servicios para busqueda                 |
| `professionals_summary` | JSONB          | NULLABLE                | Resumen de profesionales para display              |
| `business_hours`        | JSONB          | NULLABLE                | Horarios de operacion (denormalizados)             |
| `allow_online_booking`  | BOOLEAN        | NOT NULL, DEFAULT true  | Permite reservas online                            |
| `is_active`             | BOOLEAN        | NOT NULL, DEFAULT true  | Negocio activo                                     |
| `is_featured`           | BOOLEAN        | NOT NULL, DEFAULT false | Negocio destacado                                  |
| `search_vector`         | TSVECTOR       | NULLABLE                | Vector de busqueda full-text                       |
| `last_synced_at`        | TIMESTAMP(3)   | NOT NULL                | Ultima sincronizacion con core_db                  |
| `createdAt`             | TIMESTAMP(3)   | NOT NULL, DEFAULT NOW() | Fecha de creacion                                  |
| `updatedAt`             | TIMESTAMP(3)   | NOT NULL, DEFAULT NOW() | Fecha de actualizacion                             |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_bprofile_slug ON business_profiles(slug);
CREATE INDEX idx_bprofile_type ON business_profiles(type) WHERE is_active = true;
CREATE INDEX idx_bprofile_city ON business_profiles(city) WHERE is_active = true;
CREATE INDEX idx_bprofile_rating ON business_profiles(rating_avg DESC) WHERE is_active = true AND rating_avg IS NOT NULL;
CREATE INDEX idx_bprofile_location ON business_profiles(latitude, longitude) WHERE latitude IS NOT NULL AND is_active = true;
CREATE INDEX idx_bprofile_search ON business_profiles USING gin(search_vector);
CREATE INDEX idx_bprofile_active ON business_profiles(is_active);
CREATE INDEX idx_bprofile_featured ON business_profiles(is_featured) WHERE is_featured = true AND is_active = true;
```

### 8.2 Tabla: reviews

Resenas y calificaciones de los clientes sobre negocios y profesionales.

| Columna                | Tipo         | Restricciones                                        | Descripcion                                           |
| ---------------------- | ------------ | ---------------------------------------------------- | ----------------------------------------------------- |
| `id`                   | UUID         | PK                                                   | Identificador                                         |
| `business_id`          | UUID         | NOT NULL                                             | Negocio resenado                                      |
| `appointment_id`       | UUID         | NOT NULL, UNIQUE                                     | Cita asociada (ref a booking_db, una resena por cita) |
| `client_id`            | UUID         | NOT NULL                                             | Cliente que escribe la resena (ref a core_db)         |
| `client_name`          | VARCHAR(200) | NOT NULL                                             | Nombre del cliente (snapshot)                         |
| `professional_id`      | UUID         | NULLABLE                                             | Profesional resenado (ref a core_db)                  |
| `business_rating`      | INTEGER      | NOT NULL, CHECK(business_rating BETWEEN 1 AND 5)     | Calificacion del negocio                              |
| `professional_rating`  | INTEGER      | NULLABLE, CHECK(professional_rating BETWEEN 1 AND 5) | Calificacion del profesional                          |
| `comment`              | TEXT         | NULLABLE                                             | Comentario de texto                                   |
| `status`               | VARCHAR(20)  | NOT NULL, DEFAULT 'PENDING'                          | PENDING, APPROVED, REJECTED, MODERATED                |
| `business_response`    | TEXT         | NULLABLE                                             | Respuesta del negocio                                 |
| `business_response_at` | TIMESTAMP(3) | NULLABLE                                             | Fecha de la respuesta                                 |
| `business_response_by` | UUID         | NULLABLE                                             | Usuario que respondio                                 |
| `rejection_reason`     | VARCHAR(200) | NULLABLE                                             | Motivo de rechazo (moderacion)                        |
| `is_anonymous`         | BOOLEAN      | NOT NULL, DEFAULT false                              | Resena anonima                                        |
| `createdAt`            | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()                              | Fecha de creacion                                     |
| `updatedAt`            | TIMESTAMP(3) | NOT NULL, DEFAULT NOW()                              | Fecha de actualizacion                                |
| `deletedAt`            | TIMESTAMP(3) | NULLABLE                                             | Fecha de eliminacion logica                           |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_reviews_appointment ON reviews(appointment_id) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_reviews_business ON reviews(business_id, status);
CREATE INDEX idx_reviews_professional ON reviews(professional_id) WHERE professional_id IS NOT NULL;
CREATE INDEX idx_reviews_client ON reviews(client_id);
CREATE INDEX idx_reviews_rating ON reviews(business_rating);
CREATE INDEX idx_reviews_created ON reviews(business_id, "createdAt" DESC);
CREATE INDEX idx_reviews_status ON reviews(status);
```

---

## 9. Analytics Service (analytics_db)

### 9.1 Tabla: daily_metrics

Metricas agregadas diarias por negocio, pre-calculadas para consultas rapidas del dashboard y reportes.

| Columna                  | Tipo          | Restricciones           | Descripcion                          |
| ------------------------ | ------------- | ----------------------- | ------------------------------------ |
| `id`                     | UUID          | PK                      | Identificador                        |
| `business_id`            | UUID          | NOT NULL                | Negocio                              |
| `branch_id`              | UUID          | NULLABLE                | Sucursal (null = global del negocio) |
| `date`                   | DATE          | NOT NULL                | Fecha de las metricas                |
| `total_appointments`     | INTEGER       | NOT NULL, DEFAULT 0     | Total de citas del dia               |
| `completed_appointments` | INTEGER       | NOT NULL, DEFAULT 0     | Citas completadas                    |
| `cancelled_appointments` | INTEGER       | NOT NULL, DEFAULT 0     | Citas canceladas                     |
| `no_show_appointments`   | INTEGER       | NOT NULL, DEFAULT 0     | No-shows                             |
| `pending_appointments`   | INTEGER       | NOT NULL, DEFAULT 0     | Citas pendientes al final del dia    |
| `new_clients`            | INTEGER       | NOT NULL, DEFAULT 0     | Clientes nuevos registrados          |
| `returning_clients`      | INTEGER       | NOT NULL, DEFAULT 0     | Clientes recurrentes con cita        |
| `total_revenue`          | BIGINT        | NOT NULL, DEFAULT 0     | Ingresos totales en centavos         |
| `average_ticket`         | BIGINT        | NOT NULL, DEFAULT 0     | Ticket promedio en centavos          |
| `cash_payments`          | BIGINT        | NOT NULL, DEFAULT 0     | Total pagos en efectivo              |
| `transfer_payments`      | BIGINT        | NOT NULL, DEFAULT 0     | Total pagos por transferencia        |
| `card_payments`          | BIGINT        | NOT NULL, DEFAULT 0     | Total pagos con tarjeta              |
| `total_tips`             | BIGINT        | NOT NULL, DEFAULT 0     | Total propinas en centavos           |
| `occupancy_rate`         | DECIMAL(5, 2) | NULLABLE                | Tasa de ocupacion (0.00-100.00%)     |
| `cancellation_rate`      | DECIMAL(5, 2) | NULLABLE                | Tasa de cancelacion (%)              |
| `no_show_rate`           | DECIMAL(5, 2) | NULLABLE                | Tasa de no-show (%)                  |
| `top_service_id`         | UUID          | NULLABLE                | ID del servicio mas solicitado       |
| `top_professional_id`    | UUID          | NULLABLE                | ID del profesional con mas citas     |
| `metadata`               | JSONB         | NULLABLE                | Datos adicionales                    |
| `calculated_at`          | TIMESTAMP(3)  | NOT NULL                | Fecha de calculo de las metricas     |
| `createdAt`              | TIMESTAMP(3)  | NOT NULL, DEFAULT NOW() | Fecha de creacion                    |
| `updatedAt`              | TIMESTAMP(3)  | NOT NULL, DEFAULT NOW() | Fecha de actualizacion               |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_daily_metrics_business_date ON daily_metrics(business_id, branch_id, date);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX idx_daily_metrics_business ON daily_metrics(business_id, date DESC);
CREATE INDEX idx_daily_metrics_revenue ON daily_metrics(business_id, total_revenue DESC);
```

### 9.2 Tabla: professional_metrics

Metricas agregadas por profesional y periodo, para ranking y desempeno.

| Columna                  | Tipo          | Restricciones           | Descripcion                        |
| ------------------------ | ------------- | ----------------------- | ---------------------------------- |
| `id`                     | UUID          | PK                      | Identificador                      |
| `business_id`            | UUID          | NOT NULL                | Negocio                            |
| `professional_id`        | UUID          | NOT NULL                | Profesional (ref a core_db)        |
| `period_type`            | VARCHAR(10)   | NOT NULL                | DAILY, WEEKLY, MONTHLY             |
| `period_start`           | DATE          | NOT NULL                | Fecha inicio del periodo           |
| `period_end`             | DATE          | NOT NULL                | Fecha fin del periodo              |
| `total_appointments`     | INTEGER       | NOT NULL, DEFAULT 0     | Total citas en el periodo          |
| `completed_appointments` | INTEGER       | NOT NULL, DEFAULT 0     | Citas completadas                  |
| `cancelled_appointments` | INTEGER       | NOT NULL, DEFAULT 0     | Citas canceladas                   |
| `no_show_appointments`   | INTEGER       | NOT NULL, DEFAULT 0     | No-shows                           |
| `total_revenue`          | BIGINT        | NOT NULL, DEFAULT 0     | Ingresos generados en centavos     |
| `total_tips`             | BIGINT        | NOT NULL, DEFAULT 0     | Propinas recibidas en centavos     |
| `average_rating`         | DECIMAL(3, 2) | NULLABLE                | Calificacion promedio del periodo  |
| `review_count`           | INTEGER       | NOT NULL, DEFAULT 0     | Resenas recibidas                  |
| `occupancy_rate`         | DECIMAL(5, 2) | NULLABLE                | Tasa de ocupacion (%)              |
| `unique_clients`         | INTEGER       | NOT NULL, DEFAULT 0     | Clientes unicos atendidos          |
| `top_service_id`         | UUID          | NULLABLE                | Servicio mas realizado             |
| `total_hours_worked`     | DECIMAL(6, 2) | NULLABLE                | Horas trabajadas (basado en citas) |
| `metadata`               | JSONB         | NULLABLE                | Datos adicionales                  |
| `calculated_at`          | TIMESTAMP(3)  | NOT NULL                | Fecha de calculo                   |
| `createdAt`              | TIMESTAMP(3)  | NOT NULL, DEFAULT NOW() | Fecha de creacion                  |
| `updatedAt`              | TIMESTAMP(3)  | NOT NULL, DEFAULT NOW() | Fecha de actualizacion             |

**Indices**:

```sql
CREATE UNIQUE INDEX idx_prof_metrics_period ON professional_metrics(professional_id, period_type, period_start);
CREATE INDEX idx_prof_metrics_business ON professional_metrics(business_id, period_start DESC);
CREATE INDEX idx_prof_metrics_prof ON professional_metrics(professional_id, period_start DESC);
CREATE INDEX idx_prof_metrics_revenue ON professional_metrics(business_id, total_revenue DESC);
CREATE INDEX idx_prof_metrics_rating ON professional_metrics(business_id, average_rating DESC);
```

---

## 10. Relaciones entre Entidades

### 10.1 Diagrama Entidad-Relacion (por servicio)

```
AUTH SERVICE (auth_db)
========================

users 1 ---- * memberships
users 1 ---- * password_resets
users 1 ---- * audit_logs


CORE SERVICE (core_db)
========================

businesses 1 ---- * branches
businesses 1 ---- * professionals
businesses 1 ---- * services
businesses 1 ---- * clients
businesses 1 ---- * business_hours
businesses 1 ---- * business_config

professionals * ---- * services  (via professional_services)
branches 1 ---- * business_hours


BOOKING SERVICE (booking_db)
==============================

appointments 1 ---- * appointment_services
professionals 1 ---- * appointments  (por referencia, sin FK)
professionals 1 ---- * availabilities
professionals 1 ---- * blocked_slots
clients 1 ---- * appointments  (por referencia, sin FK)


PAYMENT SERVICE (payment_db)
==============================

appointments 1 ---- * payments  (por referencia, sin FK)
payments 1 ---- 0..1 invoices
invoices 1 ---- * invoice_items
cash_sessions 1 ---- * cash_movements
payments 0..1 ---- cash_movements


NOTIFICATION SERVICE (notification_db)
========================================

users 1 ---- * notifications  (por referencia, sin FK)
users 1 ---- * notification_preferences


MARKETPLACE SERVICE (marketplace_db)
=======================================

business_profiles 1 ---- * reviews
clients 1 ---- * reviews  (por referencia, sin FK)


ANALYTICS SERVICE (analytics_db)
===================================

businesses 1 ---- * daily_metrics  (por referencia, sin FK)
professionals 1 ---- * professional_metrics  (por referencia, sin FK)
```

### 10.2 Relaciones Cross-Service (por referencia)

Las siguientes relaciones son por referencia (UUID almacenado sin foreign key), ya que los datos residen en bases de datos diferentes:

| Tabla (Service A)                | Columna         | Referencia a (Service B) | Tabla destino |
| -------------------------------- | --------------- | ------------------------ | ------------- |
| memberships (Auth)               | business_id     | Core                     | businesses    |
| memberships (Auth)               | user_id         | Auth                     | users         |
| appointments (Booking)           | client_id       | Core                     | clients       |
| appointments (Booking)           | professional_id | Core                     | professionals |
| appointment_services (Booking)   | service_id      | Core                     | services      |
| payments (Payment)               | appointment_id  | Booking                  | appointments  |
| payments (Payment)               | client_id       | Core                     | clients       |
| payments (Payment)               | professional_id | Core                     | professionals |
| invoices (Payment)               | appointment_id  | Booking                  | appointments  |
| invoices (Payment)               | client_id       | Core                     | clients       |
| notifications (Notification)     | user_id         | Auth                     | users         |
| notifications (Notification)     | business_id     | Core                     | businesses    |
| business_profiles (Marketplace)  | business_id     | Core                     | businesses    |
| reviews (Marketplace)            | appointment_id  | Booking                  | appointments  |
| reviews (Marketplace)            | client_id       | Core                     | clients       |
| reviews (Marketplace)            | professional_id | Core                     | professionals |
| daily_metrics (Analytics)        | business_id     | Core                     | businesses    |
| professional_metrics (Analytics) | professional_id | Core                     | professionals |

---

## 11. Estrategia de Indexacion

### 11.1 Principios de Indexacion

1. **Primary Key**: Todas las tablas usan UUID como PK con indice B-Tree automatico
2. **Foreign Keys**: Se crean indices en todas las columnas de foreign key para optimizar JOINs
3. **Multi-tenancy**: La columna `business_id` es el primer campo de todos los indices compuestos en tablas de negocio
4. **Consultas frecuentes**: Se crean indices para los patrones de consulta mas comunes (fecha, estado, nombre)
5. **Full-text search**: Se usan indices GIN con tsvector para busqueda en texto
6. **Soft delete**: Los indices unicos incluyen la condicion `WHERE "deletedAt" IS NULL` para permitir reuso de valores unicos
7. **Parcial**: Se usan indices parciales para optimizar consultas frecuentes con filtros constantes (status = 'ACTIVE')

### 11.2 Indices Criticos de Performance

| Tabla             | Indice                                                                                                   | Justificacion                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| appointments      | `(professional_id, start_time, end_time) WHERE deletedAt IS NULL AND status IN ('PENDING', 'CONFIRMED')` | Prevencion de solapamiento de citas - la query mas critica del sistema |
| business_profiles | `USING gin(search_vector)`                                                                               | Busqueda full-text en marketplace                                      |
| daily_metrics     | `(business_id, branch_id, date) UNIQUE`                                                                  | Upsert de metricas diarias                                             |
| notifications     | `(user_id, is_read) WHERE is_read = false`                                                               | Conteo de no leidas                                                    |
| cash_sessions     | `(business_id, branch_id) WHERE status = 'OPEN' UNIQUE`                                                  | Verificar si hay caja abierta                                          |
| businesses        | `(slug) WHERE deletedAt IS NULL UNIQUE`                                                                  | Resolucion de tenant por subdominio                                    |
| clients           | `(business_id, phone) WHERE deletedAt IS NULL`                                                           | Busqueda rapida de clientes por telefono                               |

---

## 12. Estrategia de Migraciones

### 12.1 Herramienta

Se usa **Prisma Migrate** para gestionar las migraciones de cada servicio de forma independiente.

### 12.2 Flujo de Migracion

```
1. Desarrollador modifica schema.prisma del servicio correspondiente
2. Ejecuta: npx prisma migrate dev --name descripcion_del_cambio
3. Prisma genera el archivo SQL de migracion en prisma/migrations/
4. El archivo SQL se revisa y commitea al repositorio
5. En CI/CD se ejecuta: npx prisma migrate deploy (aplica migraciones pendientes)
```

### 12.3 Reglas de Migracion

1. **Siempre hacia adelante**: No se generan migraciones reversas en produccion. Las reversiones requieren una nueva migracion que deshaga los cambios.
2. **Sin destruccion**: Las migraciones en produccion nunca deben eliminar columnas o tablas sin un periodo de transicion.
3. **Datos por defecto**: Toda nueva columna NOT NULL debe tener un valor DEFAULT o ser manejada en multiples pasos (agregar nullable -> llenar datos -> cambiar a NOT NULL).
4. **Renombrar en dos fases**: Crear nueva columna -> Migrar datos -> Eliminar columna vieja.
5. **Por servicio**: Cada servicio tiene sus propias migraciones, nunca se comparten.
6. **Idempotentes**: Las migraciones deben ser seguras para ejecutarse multiples veces.

### 12.4 Inicializacion de Base de Datos

El script `infra/docker/init-scripts/01-create-databases.sql` crea las 7 bases de datos al levantar el entorno de desarrollo:

```sql
-- Ejecutado por el contenedor PostgreSQL al iniciar
CREATE DATABASE beautyspot_auth;
CREATE DATABASE beautyspot_core;
CREATE DATABASE beautyspot_booking;
CREATE DATABASE beautyspot_payment;
CREATE DATABASE beautyspot_notification;
CREATE DATABASE beautyspot_marketplace;
CREATE DATABASE beautyspot_analytics;

-- Extensiones necesarias
\c beautyspot_auth;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c beautyspot_core;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- (repetir para cada base de datos)
```

---

## 13. Estrategia de Backup y Recuperacion

### 13.1 Backups

| Tipo        | Frecuencia       | Retencion | Herramienta   |
| ----------- | ---------------- | --------- | ------------- |
| Completo    | Diario (2:00 AM) | 30 dias   | pg_dump       |
| Incremental | Cada 6 horas     | 7 dias    | WAL archiving |
| Snapshot    | Semanal          | 90 dias   | pg_basebackup |

### 13.2 Restauracion

| Escenario                       | RTO     | RPO      | Procedimiento                                  |
| ------------------------------- | ------- | -------- | ---------------------------------------------- |
| Tabla accidentalmente eliminada | 1 hora  | 6 horas  | Restaurar backup puntual de la tabla           |
| Base de datos corrupta          | 4 horas | 6 horas  | Restaurar ultimo backup completo + WAL         |
| Desastre completo               | 8 horas | 24 horas | Restaurar todos los backups en nueva instancia |

---

## 14. Consideraciones de Seguridad de Datos

### 14.1 Datos Sensibles

| Dato           | Tabla                      | Proteccion                  |
| -------------- | -------------------------- | --------------------------- |
| Contrasena     | users.password_hash        | Hash bcrypt (12 rounds)     |
| Email          | users.email, clients.email | Indice, acceso via servicio |
| Telefono       | users.phone, clients.phone | Acceso via servicio         |
| Token de reset | password_resets.token_hash | Hash, expiracion 15 min     |
| IP             | audit_logs.ip_address      | Solo en audit logs          |

### 14.2 Encriptacion

- **En transito**: TLS 1.3 para todas las conexiones (app <-> API, servicio <-> DB)
- **En reposo**: PostgreSQL con encriptacion a nivel de tabla (post-MVP para datos PII)
- **Backups**: Encriptados con AES-256 antes de almacenarlos en almacenamiento externo
- **Variables de entorno**: El string de conexion a la BD usa contrasena encriptada

### 14.3 Aislamiento Multi-Tenant

Toda consulta en las tablas de negocio debe incluir el filtro `business_id`. Para garantizar esto a nivel de aplicacion:

1. **Prisma Middleware**: Un middleware global en cada servicio inyecta `where: { businessId }` en todas las queries de tablas de negocio
2. **Tenant Guard**: Un guard de NestJS verifica que el `X-Business-Id` header este presente y que el usuario tenga acceso
3. **Test de verificacion**: Tests automaticos que verifican que ningun endpoint retorne datos de otro negocio
