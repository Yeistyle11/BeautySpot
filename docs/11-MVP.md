# 11. Definicion del MVP - BeautySpot SaaS

## Tabla de Contenidos

- [Vision del MVP](#vision-del-mvp)
- [Que INCLUYE el MVP](#que-incluye-el-mvp)
- [Que EXCLUYE el MVP](#que-excluye-el-mvp)
- [Matriz de Priorizacion](#matriz-de-priorizacion)
- [Metricas de Exito del MVP](#metricas-de-exito-del-mvp)
- [Requisitos Tecnicos del MVP](#requisitos-tecnicos-del-mvp)
- [Roadmap Post-MVP](#roadmap-post-mvp)

---

## Vision del MVP

El MVP (Producto Minimo Viable) de BeautySpot busca validar la propuesta de valor central: **permitir que barberias, salones de belleza y spas en America Latina gestionen su negocio de forma digital y atraigan clientes a traves de un marketplace**.

El MVP se enfoca en el flujo critico: **registro, configuracion del negocio, reserva de citas y gestion manual de pagos**. Todo lo demas se pospone para iteraciones futuras.

### Principios del MVP

1. **Validar, no escalar**: Priorizar aprendizaje sobre funcionalidad completa
2. **Flujo completo, no features parciales**: Mejor un flujo de punta a punta que 10 features a medias
3. **Manual antes que automatizado**: Pagos manuales antes de integrar pasarelas
4. **Reglas de negocio simples**: Configuraciones basicas, sin personalizacion avanzada
5. **Mercado unico**: Lanzar en Colombia primero, luego expandir

### Duracion Estimada del Desarrollo del MVP

| Fase | Duracion | Entregable |
|------|----------|------------|
| Sprint 1-2: Fundamentos | 4 semanas | Infraestructura, auth, core service |
| Sprint 3-4: Reservas | 4 semanas | Booking service, flujo completo de citas |
| Sprint 5: Marketplace + Dashboard | 2 semanas | Busqueda, dashboard basico |
| Sprint 6: Pulido + Testing | 2 semanas | QA, correccion de bugs, deploy |
| **Total** | **12 semanas** | **MVP lanzado** |

---

## Que INCLUYE el MVP

### 1. Autenticacion y Usuarios (Auth Service - Puerto 3001)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Registro de cuenta | Email, nombre, telefono, contrasena | Critica |
| Inicio de sesion | Email + contrasena con JWT | Critica |
| Refresh token | Renovacion automatica de sesion | Alta |
| Recuperar contrasena | Flujo via email con token temporal | Alta |
| Verificacion de email | Confirmacion de correo al registrarse | Media |
| Roles de usuario | SUPER_ADMIN, BUSINESS_ADMIN, PROFESSIONAL, CLIENT, RECEPTIONIST, MARKETPLACE_USER | Critica |
| Gestion de perfil | Editar nombre, telefono, foto | Media |

### 2. Configuracion del Negocio (Core Service - Puerto 3002)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Crear negocio | Nombre, descripcion, direccion, tipo (barberia/salon/spa) | Critica |
| Configurar horarios | Horario de apertura/cierre por dia de la semana | Critica |
| Gestion de profesionales | Alta/baja de profesionales, especialidades | Critica |
| CRUD de servicios | Nombre, precio, duracion, categoria | Critica |
| Asignar servicios a profesionales | Vincular que servicios ofrece cada profesional | Critica |
| Configuracion de disponibilidad | Dias libres, bloques de horario | Alta |
| Logo y fotos del negocio | Subida de imagen del negocio (hasta 5) | Baja |

### 3. Flujo de Reservas (Booking Service - Puerto 3003)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Buscar disponibilidad | Ver slots disponibles por profesional y fecha | Critica |
| Crear cita | Seleccionar profesional, servicio, fecha y hora | Critica |
| Confirmar cita | El profesional/recepcionista confirma la cita | Critica |
| Cancelar cita | Cliente o negocio cancela con razon | Critica |
| Completar cita | Marcar como completada al terminar el servicio | Critica |
| Marcar no-show | Registrar cuando el cliente no asiste | Alta |
| Reagendar cita | Cambiar fecha/hora de una cita existente | Alta |
| Ver citas del dia | Vista de calendario/diaria para el profesional | Alta |
| Historial de citas | Listado pasado de citas por cliente/negocio | Media |
| Notas en la cita | Comentarios del cliente o profesional | Media |

### 4. Pagos Manuales (Payment Service - Puerto 3004)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Registrar pago manual | Registrar efectivo, transferencia, tarjeta fisica | Critica |
| Registro de precios | Precio total de la cita basado en servicios | Critica |
| Estado de pago | Pendiente, pagado, reembolsado | Critica |
| Comprobante simple | Registro basico de la transaccion | Alta |
| Reporte diario de ingresos | Total de ingresos del dia por negocio | Alta |

### 5. Notificaciones Basicas (Notification Service - Puerto 3005)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Email de bienvenida | Al registrarse un nuevo usuario | Alta |
| Email de confirmacion de cita | Al crear/confirmar una cita | Critica |
| Email de recordatorio | 2 horas antes de la cita | Alta |
| Email de cancelacion | Cuando se cancela una cita | Alta |
| Notificacion in-app | Lista de notificaciones dentro de la plataforma | Media |
| Recordatorio diario | Resumen de citas del dia para el profesional | Baja |

### 6. Marketplace (Marketplace Service - Puerto 3006)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Buscar negocios | Por nombre, ubicacion, tipo de servicio | Critica |
| Filtro por tipo | Barberia, salon de belleza, spa | Alta |
| Ver perfil del negocio | Nombre, servicios, profesionales, horarios | Critica |
| Ver profesionales del negocio | Lista con especialidades y calificacion | Alta |
| Reservar desde marketplace | Flujo de reserva publica | Critica |
| Pagina publica del negocio | URL unica: beautyspot.co/negocio/nombre | Alta |

### 7. Dashboard Basico (Analytics Service - Puerto 3007)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Citas de hoy | Contador y listado del dia | Critica |
| Citas pendientes | Cantidad de citas por confirmar | Alta |
| Ingresos del dia | Total de cobros registrados | Alta |
| Ingresos de la semana | Comparativa diaria | Media |
| Citas por estado | Distribucion (confirmadas, canceladas, etc.) | Media |
| Top servicios mas reservados | Ranking de servicios por volumen | Baja |

### 8. API Gateway (Puerto 3000)

| Funcionalidad | Descripcion | Prioridad |
|--------------|-------------|-----------|
| Enrutamiento | Proxy a microservicios internos | Critica |
| Autenticacion JWT | Validar token en cada request | Critica |
| Rate limiting | Proteccion contra abuso | Alta |
| Validacion de tenant | Aislar datos por negocio | Critica |

---

## Que EXCLUYE el MVP

Las siguientes funcionalidades se posponen deliberadamente para iteraciones post-MVP:

### Pagos Online
- Integracion con pasarelas (MercadoPago, Stripe, Wompi)
- Pagos con tarjeta en la app
- Links de pago
- Facturacion electronica
- **Razon**: Requiere integraciones complejas, compliance PCI y regulaciones financieras por pais.

### Integracion con WhatsApp
- Notificaciones por WhatsApp Business API
- Chat automatizado con clientes
- Confirmacion via WhatsApp
- **Razon**: Meta Business API requiere verificacion de negocio y proceso de aprobacion lento.

### Funcionalidades de IA
- Recomendacion inteligente de horarios
- Prediccion de demanda
- Optimizacion automatica de agenda
- Chatbot de reservas
- **Razon**: Requiere datos historicos que no existen al inicio, alto costo de infraestructura.

### Analytics Avanzado
- Reportes personalizados
- Exportacion a Excel/PDF
- Comparativas entre periodos
- Metricas de retencion de clientes
- Mapas de calor de ocupacion
- **Razon**: Necesitamos primero datos reales para que los reportes tengan valor.

### Programa de Fidelidad
- Puntos por visita
- Recompensas automaticas
- Cupones y promociones
- Descuentos por membresia
- **Razon**: Agrega complejidad al flujo de pago sin validar la propuesta base.

### Multi-Sucursal
- Gestion de multiples ubicaciones
- Transferencia entre sucursales
- Reportes consolidados
- **Razon**: La mayoria de negocios en LatAm son mono-sucursal. Se agrega en fase 2.

### Reportes Avanzados
- Reportes fiscales
- Reportes de RRHH
- Exportacion de datos
- Dashboard personalizable
- **Razon**: Requiere entender las necesidades especificas de cada tipo de negocio.

### Otras Exclusiones
- Integracion con calendarios externos (Google Calendar, Outlook)
- App movil nativa (el MVP es web responsive)
- Portal de empleados con login separado
- Sistema de inventario/productos
- Gestion de proveedores
- Soporte multi-idioma (solo espanol en MVP)
- Integracion con redes sociales para publicacion

---

## Matriz de Priorizacion

### Impacto vs. Esfuerzo

```
ALTO IMPACTO
    │
    │  ┌─────────────────────┐  ┌──────────────────────┐
    │  │ REGISTRO / LOGIN    │  │ FLUJO DE RESERVA     │
    │  │ Esfuerzo: Medio     │  │ Esfuerzo: Alto        │
    │  │ Sprint: 1-2         │  │ Sprint: 3-4           │
    │  └─────────────────────┘  └──────────────────────┘
    │  ┌─────────────────────┐  ┌──────────────────────┐
    │  │ CRUD SERVICIOS      │  │ MARKETPLACE           │
    │  │ Esfuerzo: Bajo      │  │ Esfuerzo: Alto        │
    │  │ Sprint: 2           │  │ Sprint: 5             │
    │  └─────────────────────┘  └──────────────────────┘
    │
    │  ┌─────────────────────┐  ┌──────────────────────┐
    │  │ PAGOS MANUALES      │  │ NOTIFICACIONES EMAIL  │
    │  │ Esfuerzo: Medio     │  │ Esfuerzo: Medio       │
    │  │ Sprint: 4           │  │ Sprint: 4-5           │
    │  └─────────────────────┘  └──────────────────────┘
    │
    │  ┌─────────────────────┐  ┌──────────────────────┐
    │  │ FOTOS NEGOCIO       │  │ DASHBOARD BASICO      │
    │  │ Esfuerzo: Bajo      │  │ Esfuerzo: Medio       │
    │  │ Sprint: 5           │  │ Sprint: 5             │
    │  └─────────────────────┘  └──────────────────────┘
    │
    │  ┌─────────────────────┐  ┌──────────────────────┐
    │  │ RECUPERAR CONTRASENA│  │ RECORDATORIO DIARIO   │
    │  │ Esfuerzo: Bajo      │  │ Esfuerzo: Bajo        │
    │  │ Sprint: 2           │  │ Sprint: 5             │
    │  └─────────────────────┘  └──────────────────────┘
    │
└───┴────────────────────────────────────────────────────────
     BAJO ESFUERZO                                  ALTO ESFUERZO
```

### Priorizacion Numerica por Feature

| # | Feature | Impacto (1-5) | Esfuerzo (1-5) | Ratio | Sprint |
|---|---------|:------------:|:-------------:|:-----:|:------:|
| 1 | Registro de usuarios | 5 | 2 | 2.50 | 1 |
| 2 | Login con JWT | 5 | 2 | 2.50 | 1 |
| 3 | Crear negocio | 5 | 3 | 1.67 | 1 |
| 4 | CRUD servicios | 5 | 2 | 2.50 | 2 |
| 5 | Gestion profesionales | 5 | 3 | 1.67 | 2 |
| 6 | Buscar disponibilidad | 5 | 3 | 1.67 | 3 |
| 7 | Crear cita | 5 | 3 | 1.67 | 3 |
| 8 | Confirmar/cancelar cita | 5 | 2 | 2.50 | 3 |
| 9 | Completar cita | 4 | 1 | 4.00 | 3 |
| 10 | Registrar pago manual | 4 | 2 | 2.00 | 4 |
| 11 | Email confirmacion cita | 4 | 2 | 2.00 | 4 |
| 12 | Email recordatorio | 3 | 2 | 1.50 | 4 |
| 13 | Buscar negocios (marketplace) | 5 | 4 | 1.25 | 5 |
| 14 | Perfil publico negocio | 5 | 3 | 1.67 | 5 |
| 15 | Reservar desde marketplace | 5 | 3 | 1.67 | 5 |
| 16 | Dashboard basico | 4 | 3 | 1.33 | 5 |
| 17 | Marcar no-show | 3 | 1 | 3.00 | 4 |
| 18 | Historial de citas | 3 | 2 | 1.50 | 4 |
| 19 | Recuperar contrasena | 3 | 1 | 3.00 | 2 |
| 20 | Notas en cita | 2 | 1 | 2.00 | 3 |

---

## Metricas de Exito del MVP

### KPIs Primarios (Criticos)

| Metrica | Objetivo a 3 meses | Medicion |
|---------|:------------------:|----------|
| Negocios registrados | 50 negocios activos | Conteo en DB |
| Usuarios registrados (clientes) | 500 usuarios | Conteo en DB |
| Citas creadas via plataforma | 1,000 citas totales | Conteo en DB |
| Tasa de completitud de reserva | > 70% de citas iniciadas se completan | Funnel de booking |
| Tasa de retencion semanal de negocios | > 60% de negocios activos semana a semana | DAU/MAU de negocios |

### KPIs Secundarios (Deseables)

| Metrica | Objetivo a 3 meses | Medicion |
|---------|:------------------:|----------|
| Net Promoter Score (NPS) | > 30 | Encuesta mensual |
| Tiempo promedio de reserva | < 3 minutos | Analytics |
| Tasa de cancelacion | < 15% de citas | Conteo de estados |
| Citas via marketplace | > 20% del total | Fuente de cita |
| Conversion de registro a primera cita | > 40% | Funnel |
| Ticket promedio por cita | $25,000 COP | Promedio pagos |

### Metricas Tecnicas

| Metrica | Objetivo | Medicion |
|---------|----------|----------|
| Uptime | > 99% mensual | Health checks |
| Latencia P95 API | < 500ms | Prometheus/Grafana |
| Tasa de errores 5xx | < 1% | Logs estructurados |
| Tiempo de build CI/CD | < 10 minutos | GitHub Actions |
| Cobertura de tests | > 70% | Jest coverage |

### Criterios de Validacion

El MVP sera considerado exitoso si cumple **al menos 4 de estas 5 condiciones** en los primeros 3 meses:

1. Al menos 30 negocios con uso semanal activo (crean o gestionan citas)
2. Tasa de completitud de reserva superior al 70%
3. Al menos 200 citas creadas por mes al final del periodo
4. NPS mayor a 20 en la encuesta de satisfaccion
5. Al menos 10 negocios que paguen por el plan Basico o superior

---

## Requisitos Tecnicos del MVP

### Checklist de Pre-Lanzamiento

#### Infraestructura
- [ ] Docker Compose levanta los 11 contenedores sin errores
- [ ] Las 7 bases de datos se crean correctamente con sus tablas
- [ ] Redis esta accesible desde todos los servicios
- [ ] RabbitMQ esta accesible y los exchanges/queues estan configurados
- [ ] Health checks responden OK en todos los servicios

#### Servicios
- [ ] API Gateway enruta correctamente a los 7 microservicios
- [ ] Auth Service permite registro, login, refresh y recuperar contrasena
- [ ] Core Service permite CRUD de negocios, servicios y profesionales
- [ ] Booking Service permite el flujo completo de citas (crear, confirmar, completar, cancelar)
- [ ] Payment Service permite registrar pagos manuales
- [ ] Notification Service envia emails de confirmacion y recordatorio
- [ ] Marketplace Service permite buscar negocios y ver perfiles publicos
- [ ] Analytics Service muestra dashboard con metricas basicas

#### Flujos Criticos E2E
- [ ] Registro de nuevo negocio completo
- [ ] Configuracion de servicios y profesionales
- [ ] Reserva de cita por parte de un cliente
- [ ] Confirmacion de cita por parte del profesional
- [ ] Completar cita y registrar pago
- [ ] Cancelacion de cita
- [ ] Busqueda en marketplace y reserva publica

#### Seguridad
- [ ] JWT funciona correctamente con expiracion y refresh
- [ ] Rate limiting activo en el API Gateway
- [ ] Validacion de input en todos los endpoints
- [ ] HTTPS configurado en produccion
- [ ] Variables sensibles fuera del codigo fuente
- [ ] Multi-tenancy: datos aislados por negocio

#### Calidad
- [ ] Tests unitarios con cobertura > 70% en logica de negocio
- [ ] Tests de integracion en flujos criticos (auth, booking, payment)
- [ ] No hay errores de TypeScript (tsc --noEmit limpia)
- [ ] Linting sin errores (ESLint)
- [ ] Formateo consistente (Prettier)

### Arquitectura del MVP

```
Cliente (Web Browser)
    │
    ▼
┌───────────────────────────────────────────┐
│           API Gateway (:3000)              │
│   - Autenticacion JWT                      │
│   - Rate Limiting                          │
│   - Enrutamiento                           │
│   - Validacion de Tenant                   │
└─────────┬─────────────────────────────────┘
          │
    ┌─────┼──────┬───────┬──────────┬──────────┬──────────┐
    ▼     ▼      ▼       ▼          ▼          ▼          ▼
  Auth  Core  Booking  Payment  Notif.  Marketplace  Analytics
  :3001 :3002  :3003   :3004    :3005    :3006       :3007
    │     │      │       │        │         │          │
    └─────┴──────┴───────┴────────┴─────────┴──────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          PostgreSQL   Redis    RabbitMQ
          (7 DBs)     (:6379)   (:5672)
```

---

## Roadmap Post-MVP

### Fase 2: Quick Wins (Meses 4-5)

Funcionalidades de alto impacto y esfuerzo moderado que se pueden entregar rapidamente:

| Feature | Esfuerzo | Impacto | Dependencia |
|---------|----------|---------|-------------|
| Programa de fidelidad basico | Medio | Alto | Datos de citas existentes |
| Calificaciones y resenas | Bajo | Alto | Citas completadas |
| Notificaciones push (web) | Bajo | Alto | Notification service ya existe |
| Perfil de profesional mejorado | Bajo | Medio | Core service |
| Editar cita existente | Bajo | Medio | Booking service |
| Reporte semanal por email | Bajo | Medio | Analytics + Notification |
| App PWA (installable) | Bajo | Alto | Web responsive ya existe |
| Integracion Google Calendar | Medio | Alto | Auth + Booking |

### Fase 3: Monetizacion (Meses 6-7)

Funcionalidades que generan revenue directo:

| Feature | Esfuerzo | Impacto | Dependencia |
|---------|----------|---------|-------------|
| Pagos online (MercadoPago) | Alto | Critico | Payment service |
| Suscripciones SaaS | Medio | Critico | Auth + Core |
| Marketplace comisiones | Medio | Alto | Marketplace + Payment |
| Cupones y promociones | Medio | Alto | Core + Booking |
| Integracion WhatsApp | Alto | Alto | Notification service |
| Facturacion electronica (Colombia) | Alto | Alto | Payment service |

### Fase 4: Escalar (Meses 8-12)

Funcionalidades para escalar el negocio:

| Feature | Esfuerzo | Impacto | Dependencia |
|---------|----------|---------|-------------|
| Multi-sucursal | Alto | Alto | Core service |
| App movil nativa | Alto | Alto | API completa |
| Analytics avanzado | Medio | Medio | Datos historicos |
| Recomendaciones IA | Alto | Medio | Datos + ML infra |
| Soporte multi-pais | Medio | Alto | Payment + Legal |
| API publica / Integraciones | Medio | Medio | API Gateway |
| Portal de empleados | Medio | Medio | Auth + Core |
| Inventario y productos | Alto | Medio | Core service |

### Timeline Visual

```
Mes  1  2  3  4  5  6  7  8  9  10  11  12
     ├─── MVP ───┤
                 ├── Quick Wins ──┤
                                  ├── Monetizacion ──┤
                                                       ├── Escalar ────────┤
```

### Criterios para Avanzar de Fase

| Transicion | Criterio de Entrada |
|------------|-------------------|
| MVP -> Quick Wins | 30+ negocios activos, flujo de reserva validado |
| Quick Wins -> Monetizacion | 100+ negocios registrados, demanda de pagos online |
| Monetizacion -> Escalar | Revenue recurrente > $2,000 USD/mes, 10+ clientes pagando |
