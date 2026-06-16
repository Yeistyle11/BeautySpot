# BeautySpot SaaS - Documento de Requisitos

## 1. Vision General

BeautySpot es una plataforma SaaS multi-tenant disenada para digitalizar la gestion de barberias, salones de belleza, spas y centros esteticos en America Latina. La plataforma permite a cada negocio gestionar citas, profesionales, servicios, clientes y analitica desde una unica interfaz, con aislamiento completo de datos entre tenants.

### 1.1 Objetivos del Producto

- Democratizar el acceso a herramientas de gestion profesional para negocios de belleza y cuidado personal en Latinoamerica.
- Reducir la complejidad operativa mediante una plataforma unificada de reservas, gestion y analitica.
- Ofrecer una experiencia de usuario movil-first que funcione tanto para duenos de negocio como para clientes finales.
- Crear un marketplace donde los clientes puedan descubrir, comparar y reservar servicios de multiples negocios.

### 1.2 Alcance del MVP

El MVP se enfoca en la gestion integral de un negocio individual (barberia, salon, spa o centro estetico) con funcionalidades de reservas, profesionales, servicios y dashboard basico. No incluye pagos online ni integraciones con pasarelas de pago; el registro de pagos es manual.

### 1.3 Publico Objetivo

| Segmento | Descripcion | Ejemplos |
|----------|-------------|----------|
| Barberias | Negocios de corte de cabello y barba | Barberias tradicionales, barberias modernas |
| Salones de belleza | Negocios de estetica capilar, facial y corporal | Salones de manicura, peluquerias, estetica |
| Spas | Centros de relajacion y tratamientos corporales | Spas de dia, centros de masajes |
| Centros esteticos | Clínicas de tratamientos esteticos especializados | Centros de dermatologia estetica, depilacion |

### 1.4 Roles del Sistema

| Rol | Descripcion | Ambito |
|-----|-------------|--------|
| SUPER_ADMIN | Administrador global de la plataforma | Toda la plataforma |
| OWNER | Dueno del negocio | Su negocio |
| ADMIN | Administrador del negocio designado por el OWNER | Su negocio |
| PROFESSIONAL | Profesional que presta servicios | Su perfil y agenda |
| RECEPTIONIST | Recepcionista que gestiona citas y pagos | Su sucursal |
| CLIENT | Cliente final que reserva servicios | Su perfil e historial |

---

## 2. Requisitos Funcionales

### 2.1 Modulo de Autenticacion (Auth)

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| AUTH-001 | Registro de usuarios con email y contrasena | P0 |
| AUTH-002 | Inicio de sesion con email/contrasena | P0 |
| AUTH-003 | Autenticacion mediante Google OAuth 2.0 | P1 |
| AUTH-004 | Recuperacion de contrasena via email con token temporal (15 min de expiracion) | P0 |
| AUTH-005 | Verificacion de email al registrarse | P1 |
| AUTH-006 | Refresco de tokens JWT (access token: 15 min, refresh token: 7 dias) | P0 |
| AUTH-007 | Cierre de sesion con invalidacion de refresh token | P0 |
| AUTH-008 | Gestion de sesiones activas por usuario (maximo 5 dispositivos) | P2 |
| AUTH-009 | Rate limiting en intentos de login (5 intentos, bloqueo 15 min) | P0 |
| AUTH-010 | Log de auditoria de eventos de autenticacion (login, logout, password reset) | P0 |

### 2.2 Modulo de Gestion de Negocios (Core - Businesses)

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| BIZ-001 | Onboarding guiado para crear un nuevo negocio (nombre, tipo, direccion, horarios) | P0 |
| BIZ-002 | Edicion de datos del negocio (nombre, descripcion, telefono, email, direccion, logo) | P0 |
| BIZ-003 | Configuracion de horarios de funcionamiento por dia de la semana | P0 |
| BIZ-004 | Configuracion de zonas horarias por negocio | P0 |
| BIZ-005 | Gestion de sucursales (CRUD completo) | P1 |
| BIZ-006 | Configuracion de moneda local por negocio (por defecto COP para Colombia) | P0 |
| BIZ-007 | Activacion/desactivacion de negocio (soft delete) | P0 |
| BIZ-008 | Configuracion de intervalos de citas (15, 30, 45, 60 min) | P0 |
| BIZ-009 | Configuracion de reglas de cancelacion (tiempo minimo de aviso) | P1 |
| BIZ-010 | Subdominio personalizado para cada negocio ({slug}.beautyspot.co) | P0 |

### 2.3 Modulo de Profesionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| PRO-001 | Registro de profesionales vinculados a un negocio | P0 |
| PRO-002 | Perfil profesional con nombre, especialidades, foto, biografia | P0 |
| PRO-003 | Asignacion de servicios a cada profesional con duracion y precio personalizable | P0 |
| PRO-004 | Configuracion de horarios de disponibilidad por profesional y dia de semana | P0 |
| PRO-005 | Configuracion de bloques de tiempo no disponible (vacaciones, feriados) | P0 |
| PRO-006 | Activacion/desactivacion de profesionales | P0 |
| PRO-007 | Vinculacion de un usuario del sistema al perfil profesional | P0 |
| PRO-008 | Orden de prioridad de profesionales para asignacion automatica | P2 |
| PRO-009 | Rating promedio calculado a partir de las resenas recibidas | P1 |
| PRO-010 | Historial de servicios realizados por profesional | P1 |

### 2.4 Modulo de Servicios

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| SRV-001 | CRUD de servicios (nombre, descripcion, categoria, precio base, duracion) | P0 |
| SRV-002 | Categorias de servicios predefinidas (Cortes, Barba, Paquetes, Tratamientos, Otros) con opcion de personalizadas | P0 |
| SRV-003 | Asignacion de servicios a profesionales (tabla join) | P0 |
| SRV-004 | Precios personalizados por profesional para un mismo servicio | P1 |
| SRV-005 | Activacion/desactivacion de servicios | P0 |
| SRV-006 | Ordenamiento de servicios por categoria y nombre | P0 |
| SRV-007 | Duracion variable del servicio segun el profesional | P1 |
| SRV-008 | Etiquetas/tags para facilitar la busqueda de servicios | P2 |

### 2.5 Modulo de Clientes

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| CLI-001 | Registro manual de clientes por parte del negocio (recepcionista/admin) | P0 |
| CLI-002 | Perfil del cliente con nombre, telefono, email, notas | P0 |
| CLI-003 | Historial de citas del cliente en el negocio | P0 |
| CLI-004 | Historial de pagos del cliente | P1 |
| CLI-005 | Busqueda de clientes por nombre, telefono o email | P0 |
| CLI-006 | Notas y observaciones internas sobre el cliente (visibles solo al negocio) | P1 |
| CLI-007 | Importacion masiva de clientes via CSV | P2 |
| CLI-008 | Vinculacion automatica de cliente con usuario del sistema si existe | P1 |

### 2.6 Modulo de Citas (Booking)

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| BKG-001 | Creacion manual de citas por parte del personal (recepcionista/admin) | P0 |
| BKG-002 | Creacion de citas por parte del cliente a traves del marketplace/perfil del negocio | P0 |
| BKG-003 | Seleccion de servicio, profesional, fecha y hora para la cita | P0 |
| BKG-004 | Verificacion de disponibilidad en tiempo real antes de confirmar la cita | P0 |
| BKG-005 | Prevencion de solapamiento de citas para un mismo profesional | P0 |
| BKG-006 | Ciclo de vida de estados: PENDING, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW | P0 |
| BKG-007 | Confirmacion de cita por parte del profesional o recepcionista | P0 |
| BKG-008 | Cancelacion de cita con reglas de tiempo minimo de aviso configurable | P0 |
| BKG-009 | Reagendamiento de citas | P1 |
| BKG-010 | Marcacion de no-show (cliente no asistio) | P0 |
| BKG-011 | Registro de multiples servicios en una sola cita | P0 |
| BKG-012 | Notas internas y notas para el cliente en la cita | P1 |
| BKG-013 | Calculo automatico de la duracion total basado en los servicios seleccionados | P0 |
| BKG-014 | Calculo automatico del precio total basado en los servicios y el profesional | P0 |
| BKG-015 | Vista de calendario diaria, semanal y mensual para profesionales y recepcionistas | P0 |
| BKG-016 | Vista de lista de citas con filtros (fecha, estado, profesional, cliente) | P0 |
| BKG-017 | Recordatorios automaticos de citas (24h antes, 1h antes) via notificacion | P1 |

### 2.7 Modulo de Disponibilidad

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| AVA-001 | Configuracion de horarios regulares por profesional y dia de la semana | P0 |
| AVA-002 | Creacion de excepciones a la disponibilidad (dias libres, vacaciones) | P0 |
| AVA-003 | Visualizacion de slots disponibles para una fecha dada | P0 |
| AVA-004 | Bloqueo de slots especificos por profesional | P0 |
| AVA-005 | Resolucion de conflictos cuando se solapan disponibilidad y citas existentes | P0 |
| AVA-006 | Configuracion de tiempo buffer entre citas (descanso) | P1 |

### 2.8 Modulo de Pagos y Facturacion (Payment)

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| PAY-001 | Registro manual de pagos asociados a una cita (efectivo, transferencia, tarjeta presencial) | P0 |
| PAY-002 | Registro de pagos parciales y pagos multiples para una misma cita | P1 |
| PAY-003 | Generacion de recibos/facturas simplificadas en PDF | P1 |
| PAY-004 | Calculo automatico del total basado en servicios de la cita | P0 |
| PAY-005 | Registro de propinas | P2 |
| PAY-006 | Apertura y cierre de caja con calculo de ingresos del dia | P0 |
| PAY-007 | Registro de movimientos de caja (ingresos y egresos) | P0 |
| PAY-008 | Reporte de ingresos por periodo (diario, semanal, mensual) | P1 |
| PAY-009 | Integracion con pasarelas de pago online (post-MVP) | P2 |
| PAY-010 | Historial de pagos por cliente | P1 |
| PAY-011 | Conciliacion de pagos vs citas completadas | P1 |

### 2.9 Modulo de Notificaciones

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| NOT-001 | Notificaciones in-app (campana de notificaciones en el dashboard) | P0 |
| NOT-002 | Notificaciones por email (cita confirmada, recordatorio, cancelacion) | P1 |
| NOT-003 | Notificaciones push (post-MVP, via service worker) | P2 |
| NOT-004 | Preferencias de notificacion configurables por usuario | P1 |
| NOT-005 | Notificacion al profesional cuando se agenda una nueva cita | P0 |
| NOT-006 | Notificacion al cliente cuando se confirma/rechaza/cancela una cita | P0 |
| NOT-007 | Recordatorio de cita 24 horas antes | P1 |
| NOT-008 | Recordatorio de cita 1 hora antes | P1 |
| NOT-009 | Notificacion al OWNER/ADMIN sobre metricas diarias | P2 |
| NOT-010 | Marcaje de notificaciones como leidas/no leidas | P0 |

### 2.10 Modulo de Marketplace

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| MKT-001 | Perfil publico del negocio accesible via subdominio ({slug}.beautyspot.co) | P0 |
| MKT-002 | Listado de servicios publicos con precios y duracion | P0 |
| MKT-003 | Listado de profesionales con foto, especialidades y calificacion | P0 |
| MKT-004 | Busqueda de negocios por nombre, ubicacion, tipo de servicio | P1 |
| MKT-005 | Filtros de busqueda (tipo de negocio, servicios, calificacion, ubicacion) | P1 |
| MKT-006 | Resenas y calificaciones de clientes sobre el negocio y profesionales | P1 |
| MKT-007 | Galeria de imagenes del negocio | P2 |
| MKT-008 | Flujo de reserva directa desde el perfil publico del negocio | P0 |
| MKT-009 | Pagina de inicio del marketplace con negocios destacados | P2 |
| MKT-010 | SEO basico para perfiles publicos de negocios | P2 |

### 2.11 Modulo de Analitica y Reportes (Analytics)

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| ANA-001 | Dashboard con KPIs principales (citas hoy, ingresos del dia, clientes nuevos) | P0 |
| ANA-002 | Grafico de citas por dia/semana/mes | P0 |
| ANA-003 | Grafico de ingresos por dia/semana/mes | P1 |
| ANA-004 | Ranking de servicios mas solicitados | P1 |
| ANA-005 | Ranking de profesionales por cantidad de citas y facturacion | P1 |
| ANA-006 | Tasa de no-show y cancelaciones | P1 |
| ANA-007 | Metricas de clientes (nuevos vs recurrentes) | P1 |
| ANA-008 | Exportacion de reportes en CSV/Excel | P2 |
| ANA-009 | Dashboard de SUPER_ADMIN con metricas globales de la plataforma | P1 |
| ANA-010 | Metricas de ocupacion por profesional | P2 |
| ANA-011 | Comparativo periodos (mes actual vs mes anterior) | P2 |

---

## 3. Requisitos No Funcionales

### 3.1 Rendimiento

| ID | Requisito | Metrica | Objetivo |
|----|-----------|---------|----------|
| NFR-PERF-001 | Tiempo de respuesta de API | P95 latency | < 200 ms |
| NFR-PERF-002 | Tiempo de carga de pagina inicial | First Contentful Paint | < 1.5 s |
| NFR-PERF-003 | Tiempo de consulta de disponibilidad | P99 latency | < 500 ms |
| NFR-PERF-004 | Capacidad de usuarios concurrentes | Usuarios simultaneos | 1,000 |
| NFR-PERF-005 | Tiempo de generacion de reportes | Duracion | < 5 s para reporte mensual |
| NFR-PERF-006 | Tiempo de busqueda en marketplace | P95 latency | < 300 ms |

### 3.2 Seguridad

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| NFR-SEC-001 | Encriptacion en transito | TLS 1.3 para todas las comunicaciones |
| NFR-SEC-002 | Encriptacion en reposo | AES-256 para datos sensibles en la base de datos |
| NFR-SEC-003 | Hash de contrasenas | bcrypt con salt rounds >= 12 |
| NFR-SEC-004 | Tokens JWT | Access token firmado con RS256, rotacion de claves |
| NFR-SEC-005 | RBAC | Control de acceso basado en roles en cada endpoint |
| NFR-SEC-006 | Aislamiento multi-tenant | Filtro obligatorio de businessId en todas las queries de negocio |
| NFR-SEC-007 | Proteccion contra inyeccion SQL | Uso exclusivo de ORM (Prisma) con queries parametrizadas |
| NFR-SEC-008 | Proteccion XSS | Sanitizacion de inputs, CSP headers |
| NFR-SEC-009 | Rate limiting | Limites por IP y por usuario en endpoints sensibles |
| NFR-SEC-010 | Logs de auditoria | Registro de todas las operaciones sensibles (creacion, modificacion, eliminacion) |
| NFR-SEC-011 | Politica de contrasenas | Minimo 8 caracteres, 1 mayuscula, 1 numero, 1 especial |
| NFR-SEC-012 | Headers de seguridad | HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| NFR-SEC-013 | Validacion de input | Esquemas Zod en todas las entradas de API |
| NFR-SEC-014 | CORS | Configuracion restrictiva de origenes permitidos |

### 3.3 Escalabilidad

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| NFR-SCA-001 | Escalado horizontal | Cada microservicio debe poder escalarse independientemente |
| NFR-SCA-002 | Base de datos por servicio | Patron database-per-service para isolamiento y escalabilidad |
| NFR-SCA-003 | Caching | Redis para sesiones, disponibilidad, y datos frecuentemente consultados |
| NFR-SCA-004 | Paginacion | Todas las APIs de listado deben soportar paginacion (cursor-based) |
| NFR-SCA-005 | Compresion | Gzip/Brotli en respuestas API |
| NFR-SCA-006 | Conexion pooling | Pool de conexiones a base de datos configurado por servicio |
| NFR-SCA-007 | Soporte de carga | Disenar para soportar 10,000 negocios y 500,000 citas/mes en fase inicial |

### 3.4 Disponibilidad

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| NFR-AVA-001 | Uptime | 99.9% de disponibilidad (excluyendo ventanas de mantenimiento) |
| NFR-AVA-002 | Health checks | Endpoints de salud por servicio para monitoreo |
| NFR-AVA-003 | Graceful degradation | Si un servicio no critico cae, el resto debe seguir funcionando |
| NFR-AVA-004 | Backups | Backups automaticos diarios de todas las bases de datos |
| NFR-AVA-005 | Recovery | RTO < 4 horas, RPO < 1 hora |

### 3.5 Mantenibilidad

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| NFR-MAIN-001 | Cobertura de tests | Minimo 70% de cobertura en tests unitarios |
| NFR-MAIN-002 | CI/CD | Pipeline automatizado para tests, build y deploy |
| NFR-MAIN-003 | Logging estructurado | Logs en formato JSON con correlation IDs |
| NFR-MAIN-004 | Documentacion de API | OpenAPI/Swagger para todos los endpoints |
| NFR-MAIN-005 | Versionamiento | Versionado semantico en APIs (v1, v2) |
| NFR-MAIN-006 | Monitoreo | Dashboards de metricas de aplicacion e infraestructura |

---

## 4. Requisitos Tecnicos

### 4.1 Stack Tecnologico

| Componente | Tecnologia | Version | Justificacion |
|------------|-----------|---------|---------------|
| Lenguaje | TypeScript | 5.x | Tipado estatico, ecosistema amplio, productividad |
| Backend Framework | NestJS | 10.x | Arquitectura modular, DI, decorators, escalable |
| ORM | Prisma | 5.x | Type-safe, migraciones, excelente DX |
| Base de datos | PostgreSQL | 16.x | Relacional robusta, JSON support, performance |
| Cache | Redis | 7.x | Cache, sesiones, rate limiting, pub/sub |
| Message Broker | RabbitMQ | 3.13.x | Comunicacion async entre servicios, reliable delivery |
| Contenedores | Docker | 24.x | Estandar de contenedores, reproducibilidad |
| Orquestacion | Docker Compose | 2.x | Desarrollo local multi-contenedor |
| Monorepo | Turborepo | Latest | Build caching, gestion de dependencias |
| Package Manager | pnpm | 8.x | Eficiente, workspace support, strict mode |
| Validacion | Zod | 3.x | Runtime type validation, inferencia TS |
| Testing | Jest | 29.x | Standard de testing en JS/TS |
| Linting | ESLint | 8.x | Calidad de codigo |
| Formateo | Prettier | 3.x | Consistencia de estilo |

### 4.2 Requisitos de Infraestructura

| Componente | Requisito |
|------------|-----------|
| CPU minima por servicio | 0.5 cores (requests), 1 core (limits) |
| RAM minima por servicio | 256 MB (requests), 512 MB (limits) |
| Almacenamiento PostgreSQL | 20 GB iniciales con auto-escalado |
| Redis | Instancia dedicada con persistencia AOF |
| RabbitMQ | Cluster de 3 nodos para alta disponibilidad (produccion) |
| Certificados SSL | Let's Encrypt con renovacion automatica |
| CDN | Para assets estaticos (post-MVP) |

### 4.3 Requisitos de Red

| Componente | Configuracion |
|------------|---------------|
| DNS | Wildcard DNS para *.beautyspot.co |
| Load Balancer | Reverse proxy (Nginx/Traefik) con terminacion SSL |
| Service Discovery | Docker networking para desarrollo, DNS para produccion |
| Puertos internos | Cada servicio en puerto propio (3001-3008) |
| Puerto publico | API Gateway en puerto 80/443 |

---

## 5. Requisitos de UX

### 5.1 Diseno Responsivo

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| UX-RES-001 | Mobile-first | Disenar primero para movil, luego escalar a desktop |
| UX-RES-002 | Breakpoints | Mobile (<640px), Tablet (640-1024px), Desktop (>1024px) |
| UX-RES-003 | Touch-friendly | Botones con area de toque minima de 44x44px |
| UX-RES-004 | Navegacion adaptable | Menu hamburguesa en movil, sidebar en desktop |

### 5.2 Accesibilidad

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| UX-ACC-001 | WCAG 2.1 AA | Cumplimiento del nivel AA de las pautas WCAG |
| UX-ACC-002 | Contraste | Ratio de contraste minimo 4.5:1 para texto normal |
| UX-ACC-003 | Navegacion por teclado | Todos los elementos interactivos accesibles via teclado |
| UX-ACC-004 | Labels | Todos los campos de formulario con labels asociados |
| UX-ACC-005 | ARIA | Atributos ARIA en componentes interactivos complejos |

### 5.3 Idioma y Localizacion

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| UX-L10N-001 | Idioma principal | Espanol (es) como idioma por defecto |
| UX-L10N-002 | Formato de moneda | Pesos colombianos (COP) por defecto, configurable por negocio |
| UX-L10N-003 | Formato de fecha | DD/MM/AAAA para el pais del negocio |
| UX-L10N-004 | Zona horaria | Configurable por negocio, por defecto America/Bogota |
| UX-L10N-005 | Internacionalizacion | Arquitectura preparada para i18n (post-MVP) |

### 5.4 Performance Percibida

| ID | Requisito | Descripcion |
|----|-----------|-------------|
| UX-PERF-001 | Skeleton loading | Placeholders visuales durante la carga de datos |
| UX-PERF-002 | Optimistic updates | Actualizaciones optimistas en acciones criticas (reservar cita) |
| UX-PERF-003 | Feedback inmediato | Indicador de carga en acciones que tardan mas de 300ms |
| UX-PERF-004 | Offline fallback | Mensaje claro cuando no hay conexion a internet |

---

## 6. Requisitos de Escalabilidad

### 6.1 Estrategia de Escalado

| Nivel | Componentes | Estrategia |
|-------|-------------|------------|
| Aplicacion | Microservicios NestJS | Escalado horizontal via replicas |
| Base de datos | PostgreSQL | Read replicas, connection pooling (PgBouncer) |
| Cache | Redis | Redis Cluster para particionamiento |
| Mensajeria | RabbitMQ | Quorum queues, cluster de nodos |
| Archivos estaticos | CDN | Distribucion geografica (post-MVP) |

### 6.2 Estrategia de Caching

| Capa | Tecnologia | TTL | Datos |
|------|-----------|-----|-------|
| Nivel 1 - API | Cache HTTP | 60s | Respuestas GET de listados |
| Nivel 2 - Aplicacion | Redis | 5-15 min | Disponibilidad, perfiles, configuracion |
| Nivel 3 - Base de datos | PostgreSQL | N/A | Query plan cache, shared buffers |
| Invalidacion | Event-driven | Inmediato | Los eventos de RabbitMQ invalidan cache |

### 6.3 Limites y Cuotas

| Recurso | Limite por Negocio | Limite Global |
|---------|-------------------|---------------|
| Profesionales | 50 | N/A |
| Servicios | 200 | N/A |
| Citas por dia | 500 | N/A |
| Clientes | 10,000 | N/A |
| Sucursales | 10 | N/A |
| Solicitudes API | 1,000/min | 10,000/min por IP |

---

## 7. Restricciones y Supuestos

### 7.1 Restricciones

- No se procesan pagos online en el MVP; todos los pagos se registran manualmente.
- No se requiere integracion con sistemas de punto de venta externos en el MVP.
- La plataforma no gestionara inventario de productos en el MVP.
- No se soportaran citas recurrentes/periodicas en el MVP.
- La app movil nativa esta fuera del alcance del MVP; se usara una PWA.

### 7.2 Supuestos

- Los negocios tienen acceso a internet estable.
- Los profesionales tienen un smartphone para recibir notificaciones.
- Los clientes estan familiarizados con reservas online.
- El volumen inicial sera de maximo 1,000 negocios concurrentes.
- Los duenos de negocio usaran principalmente el celular para gestionar.

---

## 8. Dependencias Externas

| Servicio | Proveedor | Uso | Fase |
|----------|-----------|-----|------|
| Email transaccional | Resend / AWS SES | Confirmaciones, notificaciones | MVP |
| Almacenamiento de archivos | AWS S3 / MinIO | Logos, fotos de perfil | MVP |
| DNS | Cloudflare | Wildcard DNS, CDN | MVP |
| SSL | Let's Encrypt | Certificados TLS | MVP |
| Pasarela de pago | Mercado Pago / Stripe | Pagos online | Post-MVP |
| SMS | Twilio / MessageBird | Notificaciones SMS | Post-MVP |
| Push notifications | Firebase Cloud Messaging | Notificaciones push | Post-MVP |
| Maps | Google Maps API | Ubicacion de negocios | Post-MVP |

---

## 9. Glosario

| Termino | Definicion |
|---------|------------|
| Tenant | Un negocio registrado en la plataforma, con datos completamente aislados |
| Slug | Identificador URL-amigable unico de un negocio (ej: "elite-barbershop") |
| Slot | Intervalo de tiempo disponible para agendar una cita |
| Profesional | Persona que presta servicios dentro de un negocio (barbero, estilista, masajista) |
| No-show | Situacion donde un cliente no asiste a su cita sin cancelar previamente |
| Caja | Registro de ingresos y egresos de un dia operativo |
| Marketplace | Seccion publica donde los clientes descubren negocios y reservan citas |
| Multi-tenancy | Arquitectura donde multiples negocios comparten la misma instancia con datos aislados |
