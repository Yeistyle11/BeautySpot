# 13. Schema de Base de Datos — BeautySpot

## Visión General

7 bases de datos PostgreSQL independientes, una por microservicio. Todas las tablas business-scoped incluyen columna `business_id` (UUID) para aislamiento multi-tenant.

---

## Enums Compartidos

```sql
-- Roles de usuario
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN', 'OWNER', 'ADMIN',
  'PROFESSIONAL', 'RECEPTIONIST', 'CLIENT'
);

-- Estado de cita
CREATE TYPE appointment_status AS ENUM (
  'PENDING', 'CONFIRMED', 'IN_PROGRESS',
  'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

-- Método de pago
CREATE TYPE payment_method AS ENUM (
  'CASH', 'CARD', 'TRANSFER', 'OTHER'
);

-- Estado de pago
CREATE TYPE payment_status AS ENUM (
  'PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED'
);

-- Estado de factura
CREATE TYPE invoice_status AS ENUM (
  'DRAFT', 'SENT', 'PAID', 'CANCELLED'
);

-- Tipo de movimiento de caja
CREATE TYPE cash_movement_type AS ENUM ('IN', 'OUT');

-- Tipo de notificación
CREATE TYPE notification_type AS ENUM (
  'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REMINDER',
  'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_COMPLETED', 'REVIEW_RECEIVED',
  'MEMBERSHIP_INVITATION'
);

-- Canal de notificación
CREATE TYPE notification_channel AS ENUM (
  'IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP'
);
```

---

## 1. beautyspot_auth (Auth Service)

### users

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  phone           VARCHAR(30),
  avatar          VARCHAR(500),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  lockout_count   INTEGER NOT NULL DEFAULT 0,
  current_business_id UUID,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
```

### memberships

```sql
CREATE TABLE memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  role        user_role NOT NULL DEFAULT 'CLIENT',
  permissions JSONB,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by  UUID,
  invited_at  TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_business ON memberships(business_id);
CREATE INDEX idx_memberships_role ON memberships(role);
```

### password_resets

```sql
CREATE TABLE password_resets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
```

### email_verifications

Confirmación del correo del alta. Como en `password_resets`, solo se guarda el
hash del token; el enlace vale 24 h y un solo uso.

```sql
CREATE TABLE email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  action     VARCHAR(100) NOT NULL,
  entity     VARCHAR(100) NOT NULL,
  entity_id  UUID,
  changes    JSONB,
  ip         VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

---

## 2. beautyspot_core (Core Service)

### businesses

```sql
CREATE TABLE businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  logo          VARCHAR(500),
  cover_image   VARCHAR(500),
  phone         VARCHAR(30),
  email         VARCHAR(255),
  website       VARCHAR(500),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'Colombia',
  lat           DECIMAL(10, 7),
  lng           DECIMAL(10, 7),
  timezone      VARCHAR(50) NOT NULL DEFAULT 'America/Bogota',
  currency      VARCHAR(3) NOT NULL DEFAULT 'COP',
  locale        VARCHAR(5) NOT NULL DEFAULT 'es',
  business_type VARCHAR(50),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  plan_id       UUID,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_city ON businesses(city);
CREATE INDEX idx_businesses_active ON businesses(active);
CREATE INDEX idx_businesses_latlng ON businesses(lat, lng);
```

### branches

```sql
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  address     TEXT,
  city        VARCHAR(100),
  state       VARCHAR(100),
  country     VARCHAR(100) DEFAULT 'Colombia',
  lat         DECIMAL(10, 7),
  lng         DECIMAL(10, 7),
  phone       VARCHAR(30),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_business ON branches(business_id);
```

### professionals

```sql
CREATE TABLE professionals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL,
  branch_id     UUID REFERENCES branches(id),
  user_id       UUID,
  bio           TEXT,
  specialties   VARCHAR(500),
  years_exp     INTEGER,
  rating        DECIMAL(3, 2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  portfolio     JSONB,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professionals_business ON professionals(business_id);
CREATE INDEX idx_professionals_branch ON professionals(branch_id);
CREATE INDEX idx_professionals_active ON professionals(active);
```

### services

```sql
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  price       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  duration    INTEGER NOT NULL,
  category    VARCHAR(100),
  image       VARCHAR(500),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_business ON services(business_id);
CREATE INDEX idx_services_category ON services(business_id, category);
CREATE INDEX idx_services_active ON services(active);
```

### professional_services

```sql
CREATE TABLE professional_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  custom_price    DECIMAL(10, 2),
  custom_duration INTEGER,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(professional_id, service_id)
);

CREATE INDEX idx_prof_services_prof ON professional_services(professional_id);
CREATE INDEX idx_prof_services_svc ON professional_services(service_id);
```

### clients

```sql
CREATE TABLE clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL,
  user_id        UUID,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  phone          VARCHAR(30),
  documento      VARCHAR(30),
  notes          TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  tags           VARCHAR(500),
  ficha          JSONB,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  anonymized_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_business ON clients(business_id);
CREATE INDEX idx_clients_email ON clients(business_id, email);
CREATE INDEX idx_clients_phone ON clients(business_id, phone);
CREATE INDEX idx_clients_name ON clients(business_id, name);
```

`anonymized_at` marca el ejercicio del derecho de supresión: la fila se conserva
con los datos personales vaciados porque sus citas y facturas la referencian.

### campos_de_ficha

Campos que cada negocio añade a la ficha de sus clientes; sus valores viven en
`clients.ficha`, indexados por el id del campo. Son configurables y no columnas
fijas porque una barbería y un centro estético no preguntan lo mismo.

```sql
CREATE TABLE campos_de_ficha (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  etiqueta    VARCHAR(255) NOT NULL,
  -- texto | numero | fecha | si_no | opciones
  tipo        VARCHAR(255) NOT NULL DEFAULT 'texto',
  opciones    JSONB,
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  orden       INTEGER NOT NULL DEFAULT 0,
  -- vacío o nulo = el campo aplica a todo cliente del negocio
  service_ids JSONB,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON campos_de_ficha(business_id);
CREATE INDEX ON campos_de_ficha(business_id, active);
```

### business_hours

```sql
CREATE TABLE business_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  branch_id   UUID REFERENCES branches(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time   TIME NOT NULL,
  close_time  TIME NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hours_business ON business_hours(business_id);
CREATE INDEX idx_hours_branch ON business_hours(branch_id);
```

### business_config

```sql
CREATE TABLE business_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  key         VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, key)
);

CREATE INDEX idx_config_business ON business_config(business_id);
```

---

## 3. beautyspot_booking (Booking Service)

### appointments

```sql
CREATE TABLE appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL,
  branch_id      UUID,
  client_id      UUID NOT NULL,
  professional_id UUID NOT NULL,
  date           DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  status         appointment_status NOT NULL DEFAULT 'PENDING',
  notes          TEXT,
  cancel_reason  VARCHAR(255),
  points_earned  INTEGER NOT NULL DEFAULT 0,
  total_amount   DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_by     UUID,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appt_business ON appointments(business_id);
CREATE INDEX idx_appt_prof ON appointments(professional_id, date);
CREATE INDEX idx_appt_client ON appointments(client_id);
CREATE INDEX idx_appt_date ON appointments(business_id, date);
CREATE INDEX idx_appt_status ON appointments(business_id, status);
CREATE INDEX idx_appt_conflict ON appointments(professional_id, date, start_time, end_time);
```

### appointment_services

```sql
CREATE TABLE appointment_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL,
  service_name  VARCHAR(255) NOT NULL,
  price         DECIMAL(10, 2) NOT NULL,
  duration      INTEGER NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appt_svc_appt ON appointment_services(appointment_id);
```

### availabilities

```sql
CREATE TABLE availabilities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL,
  professional_id UUID NOT NULL,
  day_of_week    INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_avail_prof ON availabilities(professional_id);
CREATE INDEX idx_avail_prof_day ON availabilities(professional_id, day_of_week);
```

### blocked_slots

```sql
CREATE TABLE blocked_slots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL,
  professional_id UUID NOT NULL,
  date           DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blocked_prof ON blocked_slots(professional_id, date);
CREATE INDEX idx_blocked_date ON blocked_slots(business_id, date);
```

---

## 4. beautyspot_payment (Payment Service)

### payments

```sql
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL,
  appointment_id UUID,
  client_id     UUID NOT NULL,
  amount        DECIMAL(10, 2) NOT NULL,
  method        payment_method NOT NULL,
  status        payment_status NOT NULL DEFAULT 'COMPLETED',
  reference     VARCHAR(255),
  notes         TEXT,
  registered_by UUID NOT NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_business ON payments(business_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_date ON payments(business_id, registered_at);
CREATE INDEX idx_payments_method ON payments(business_id, method);
```

### invoices

```sql
CREATE TABLE invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  client_id   UUID NOT NULL,
  number      VARCHAR(50) NOT NULL UNIQUE,
  date        DATE NOT NULL,
  due_date    DATE,
  total       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status      invoice_status NOT NULL DEFAULT 'DRAFT',
  notes       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(business_id, status);
```

### invoice_items

```sql
CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10, 2) NOT NULL,
  total       DECIMAL(10, 2) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_items_invoice ON invoice_items(invoice_id);
```

### cash_sessions

```sql
CREATE TABLE cash_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL,
  branch_id       UUID,
  opened_by       UUID NOT NULL,
  closed_by       UUID,
  opening_amount  DECIMAL(10, 2) NOT NULL DEFAULT 0,
  closing_amount  DECIMAL(10, 2),
  opened_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMP,
  notes           TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_business ON cash_sessions(business_id);
CREATE INDEX idx_cash_active ON cash_sessions(business_id, closed_at) WHERE closed_at IS NULL;
```

### cash_movements

```sql
CREATE TABLE cash_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type            cash_movement_type NOT NULL,
  amount          DECIMAL(10, 2) NOT NULL,
  concept         TEXT NOT NULL,
  registered_by   UUID NOT NULL,
  registered_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_mov_session ON cash_movements(cash_session_id);
```

---

## 5. beautyspot_notification (Notification Service)

### notifications

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  user_id     UUID NOT NULL,
  type        notification_type NOT NULL,
  channel     notification_channel NOT NULL DEFAULT 'IN_APP',
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  data        JSONB,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, business_id);
CREATE INDEX idx_notif_unread ON notifications(user_id, business_id, read) WHERE read = FALSE;
CREATE INDEX idx_notif_type ON notifications(business_id, type);
```

### notification_preferences

```sql
CREATE TABLE notification_preferences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  user_id     UUID NOT NULL,
  type        VARCHAR(100) NOT NULL,
  channel     VARCHAR(50) NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id, type, channel)
);

CREATE INDEX idx_notif_pref_user ON notification_preferences(user_id, business_id);
```

---

## 6. beautyspot_marketplace (Marketplace Service)

### business_profiles

```sql
CREATE TABLE business_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL UNIQUE,
  slug          VARCHAR(100) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  logo          VARCHAR(500),
  cover_image   VARCHAR(500),
  phone         VARCHAR(30),
  email         VARCHAR(255),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100),
  lat           DECIMAL(10, 7),
  lng           DECIMAL(10, 7),
  rating        DECIMAL(3, 2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  business_type VARCHAR(50),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bprofile_slug ON business_profiles(slug);
CREATE INDEX idx_bprofile_city ON business_profiles(city);
CREATE INDEX idx_bprofile_active ON business_profiles(active);
CREATE INDEX idx_bprofile_latlng ON business_profiles(lat, lng);
CREATE INDEX idx_bprofile_rating ON business_profiles(rating DESC);
CREATE INDEX idx_bprofile_type ON business_profiles(business_type);
```

### reviews

```sql
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL,
  appointment_id  UUID,
  client_id       UUID NOT NULL,
  professional_id UUID,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  response        TEXT,
  responded_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_business ON reviews(business_id);
CREATE INDEX idx_reviews_client ON reviews(client_id);
CREATE INDEX idx_reviews_prof ON reviews(professional_id);
CREATE INDEX idx_reviews_rating ON reviews(business_id, rating);
```

---

## 7. beautyspot_analytics (Analytics Service)

### daily_metrics

```sql
CREATE TABLE daily_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL,
  date                  DATE NOT NULL,
  total_appointments    INTEGER NOT NULL DEFAULT 0,
  completed_appointments INTEGER NOT NULL DEFAULT 0,
  cancelled_appointments INTEGER NOT NULL DEFAULT 0,
  no_show_appointments  INTEGER NOT NULL DEFAULT 0,
  total_revenue         DECIMAL(12, 2) NOT NULL DEFAULT 0,
  new_clients           INTEGER NOT NULL DEFAULT 0,
  returning_clients     INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, date)
);

CREATE INDEX idx_daily_business_date ON daily_metrics(business_id, date);
```

### professional_metrics

```sql
CREATE TABLE professional_metrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL,
  professional_id  UUID NOT NULL,
  date             DATE NOT NULL,
  appointments     INTEGER NOT NULL DEFAULT 0,
  revenue          DECIMAL(12, 2) NOT NULL DEFAULT 0,
  rating           DECIMAL(3, 2) NOT NULL DEFAULT 0,
  avg_service_time INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, professional_id, date)
);

CREATE INDEX idx_prof_metrics_prof ON professional_metrics(professional_id, date);
CREATE INDEX idx_prof_metrics_business ON professional_metrics(business_id, date);
```

---

## Datos iniciales

El sistema arranca **en blanco**. No se cargan negocios, profesionales, servicios,
clientes ni citas de ejemplo: sólo se crean las bases de datos vacías y, en
desarrollo, el esquema que genera `synchronize` a partir de las entidades.

Los **roles no se siembran**: son un `enum` de TypeScript
(`packages/shared-types/src/auth.types.ts`), no filas de una tabla. El rol efectivo
de cada usuario vive en la columna `role` de `memberships`.

La primera cuenta se crea con el registro normal (`POST /api/v1/auth/register`),
que da de alta al usuario junto con su negocio y le asigna el rol `OWNER`.

> **Pendiente**: no existe hoy ninguna cuenta de superadministrador ni forma de
> crearla. El rol `SUPER_ADMIN` está definido en el enum y se comprueba en los
> guards, pero no se puede asignar: `memberships` hereda de `TenantEntity`, así que
> `business_id` es NOT NULL, y el rol del JWT se deriva de la primera membresía
> activa. Un administrador de plataforma no pertenece a ningún negocio, de modo que
> asignarlo exigiría un cambio de modelo (una columna en `users`, hacer
> `business_id` nullable, o un negocio sentinela).

## Convenciones de Migración

Las migraciones se gestionan con TypeORM CLI:

```bash
# Generar migración
npm run typeorm migration:generate -- -n NombreMigracion

# Ejecutar migraciones
npm run typeorm migration:run

# Revertir última migración
npm run typeorm migration:revert
```

### Naming de migraciones

Formato: `{timestamp}-{descripcion_kebab_case}.ts`

Ejemplos:

- `1700000000000-create-auth-tables.ts`
- `1700000000001-add-business-config-table.ts`
- `1700000000002-add-cash-movements-index.ts`
