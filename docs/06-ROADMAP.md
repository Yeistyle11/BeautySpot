# 06 - Roadmap de Producto BeautySpot SaaS

## Resumen

Este documento define el roadmap de desarrollo del MVP de BeautySpot, plataforma SaaS
multi-tenant para barberías, salones de belleza y spas en América Latina. El plan se
divide en 5 fases distribuidas en 22 semanas de desarrollo iterativo e incremental.

---

## Definición del MVP

### Que incluye el MVP

- Registro y onboarding de negocios (barberías, salones, spas)
- Gestión multi-sucursal con aislamiento por subdominio
- Sistema de autenticación con 6 roles (SUPER_ADMIN, OWNER, ADMIN, PROFESSIONAL,
  RECEPTIONIST, CLIENT)
- Catálogo de servicios con categorías, precios y duración
- Gestión de profesionales con perfiles y especialidades
- Agenda y reservas en tiempo real con disponibilidad en vivo
- Notificaciones por correo electrónico y push
- Perfil público del negocio (marketplace) indexable por SEO
- Sistema de reseñas y calificaciones
- Dashboard administrativo con métricas básicas
- Búsqueda por geolocalización de negocios cercanos
- Integración WhatsApp para confirmaciones y recordatorios
- Programa de fidelización con puntos y niveles
- Analíticas avanzadas con predicciones
- Recordatorios inteligentes multi-canal

### Que NO incluye el MVP

- **Pagos en línea**: No se procesan transacciones electrónicas; los pagos se registran
  manualmente como efectivo, tarjeta presencial o transferencia
- **App nativa móvil**: Se prioriza una SPA responsive (PWA) sobre apps nativas
- **Integración con POS externos**: No hay sincronización con sistemas de punto de venta
  de terceros
- **Contabilidad avanzada**: Solo registro de ingresos/egresos básico
- **Multi-moneda**: Se maneja la moneda local del país de despliegue (COP por defecto)
- **Marketplace transaccional**: Los perfiles son informativos; no hay reserva directa
  desde el marketplace en la versión inicial
- **API pública para terceros**: No se expone API abierta a desarrolladores externos
- **Modo offline**: La aplicación requiere conexión a internet constante

---

## Fase 1: Infraestructura + Autenticación + Core Básico

### Semanas 1-5

### Objetivos

- Establecer la arquitectura base del monorepo Turborepo con los 8 microservicios
- Implementar el sistema de autenticación JWT con multi-tenancy
- Crear los modelos fundamentales del dominio (negocios, sucursales, usuarios)
- Configurar el pipeline de desarrollo (Docker Compose, linting, formateo)

### Entregables

#### Semana 1-2: Fundamentos

- Monorepo inicializado con Turborepo y configuración compartida
  - `tsconfig.base.json` con paths compartidos
  - `eslint.config.js` y `.prettierrc` centralizados
  - Scripts de build, lint y format integrados
- Docker Compose con servicios base:
  - PostgreSQL (una instancia por microservicio con bases separadas)
  - Redis para caché y sesiones
  - RabbitMQ para mensajería asíncrona
  - PgAdmin para administración de base de datos
- API Gateway (puerto 3000) con routing básico y health checks
- Servicio Auth (puerto 3001) esqueleto con NestJS

#### Semana 2-3: Autenticación Completa

- Servicio Auth funcional:
  - Registro con verificación de email
  - Login con JWT (access token + refresh token)
  - Recuperación de contraseña con flujo seguro
  - Revocación de tokens y logout
- Middleware de multi-tenancy:
  - Resolución de tenant por subdominio (`tunegocio.beautyspot.co`)
  - Inyección del `tenantId` en el contexto de la petición
  - Aislamiento de datos a nivel de consulta (columna `businessId`)
- Sistema de roles:
  - 6 roles definidos con jerarquía
  - Guards de autorización (`RolesGuard`, `BusinessScopeGuard`)
  - Claims JWT con rol, tenant y permisos
- Migraciones de base de datos con Prisma para Auth

#### Semana 3-4: Core Service Básico

- Servicio Core (puerto 3002):
  - Modelo `Business` con datos del negocio (nombre, dirección, logo, descripción)
  - Modelo `Branch` con soporte multi-sucursal
  - Modelo `User` extendido con perfiles por rol
  - CRUD completo de negocios y sucursales
  - Relación usuario-negocio-rol (membership)
- API Gateway integrado con Core:
  - Proxy reverso con validación de JWT
  - Rate limiting por tenant
  - Documentación Swagger/OpenAPI inicial

#### Semana 4-5: Integración y Pruebas

- Integración Gateway + Auth + Core end-to-end
- Seed data con datos de prueba por defecto
- Suite de pruebas unitarias para Auth (>70% cobertura)
- Suite de pruebas de integración para flujos de registro/login
- Documentación técnica de la arquitectura actualizada

### Milestones

| Milestone | Semana | Criterio de Aceptación |
|-----------|--------|----------------------|
| M1.1 Infraestructura levantada | 1 | `docker-compose up` levanta todos los servicios sin errores |
| M1.2 Auth funcional | 2 | Un usuario puede registrarse, loguearse y acceder a rutas protegidas |
| M1.3 Multi-tenancy operativo | 3 | Dos tenants en subdominios diferentes tienen datos aislados |
| M1.4 Core CRUD completo | 4 | Se puede crear, leer, actualizar y eliminar negocios y sucursales |
| M1.5 Integración continua | 5 | Pipeline CI ejecuta lint, tests y build en cada PR |

### Dependencias

- No hay dependencias externas críticas más allá de los servicios de infraestructura
- Las decisiones de diseño de Auth afectan a todos los servicios posteriores
- El modelo de datos de Core es la base para Booking, Payment y Analytics

### Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Complejidad del multi-tenancy por subdominio | Media | Alto | Proof of concept en semana 1 antes de construir todo |
| Sobrecarga del monorepo con Turborepo | Baja | Medio | Benchmark de build times; simplificar si es necesario |
| Modelado incorrecto de roles/permisos | Media | Alto | Revisión de diseño con el equipo antes de implementar |
| Retraso en configuración de Docker | Baja | Medio | Usar imágenes oficiales preconfiguradas |

---

## Fase 2: Core Completo + Reservas + Notificaciones

### Semanas 6-10

### Objetivos

- Completar el servicio Core con gestión de servicios, profesionales y horarios
- Implementar el motor de reservas completo con disponibilidad en tiempo real
- Desplegar el sistema de notificaciones multi-canal
- Establecer la comunicación asíncrona entre microservicios con RabbitMQ

### Entregables

#### Semana 6-7: Core Completo

- Modelo `Service` con categorías, precios, duración y estado activo/inactivo
- Modelo `Professional` con especialidades, portafolio y calificación promedio
- Tabla join `ProfessionalService` para asignar servicios a profesionales
- Modelo `Availability` con horarios recurrentes y excepciones
- Modelo `BlockedSlot` para bloqueos manuales de agenda
- CRUD completo para todos los modelos con validación Zod
- Importación/exportación de servicios y profesionales via CSV
- Gestión de horarios con interfaz visual de calendario semanal

#### Semana 7-9: Servicio de Reservas (Booking)

- Servicio Booking (puerto 3003):
  - Modelo `Appointment` con ciclo de estados:
    - `PENDING` -> `CONFIRMED` -> `COMPLETED` / `CANCELLED` / `NO_SHOW`
  - Verificación de disponibilidad en tiempo real:
    - Consulta de slots disponibles considerando horarios, bloqueos y citas existentes
    - Prevención de doble reserva con optimistic locking
  - Gestión de conflictos:
    - Detección de solapamientos
    - Resolución automática cuando es posible
    - Notificación al profesional cuando hay conflictos
  - Transiciones de estado con reglas de negocio:
    - Cliente: cancelar/reagendar con mínimo 2 horas de aviso
    - Profesional: confirmar, completar, marcar no-show
    - Admin/Owner: todas las acciones + edición completa
  - Soporte para citas recurrentes (semanal, quincenal, mensual)
  - Historial de cambios en las citas (audit log)

#### Semana 9-10: Notificaciones

- Servicio Notification (puerto 3005):
  - Sistema de plantillas de notificación:
    - Confirmación de reserva
    - Recordatorio (24h, 2h antes)
    - Cancelación
    - Reagendamiento
    - Bienvenida al nuevo usuario/negocio
  - Canal de correo electrónico via SendGrid/AWS SES
  - Canal de push notifications (Firebase Cloud Messaging)
  - Canal de SMS básico (Twilio, solo para críticos)
  - Cola de procesamiento con RabbitMQ:
    - Exchange tipo `topic` con routing keys por tipo de evento
    - Reintentos automáticos con backoff exponencial
    - Dead letter queue para notificaciones fallidas
  - Preferencias de notificación por usuario
  - Dashboard de notificaciones enviadas con estado

### Milestones

| Milestone | Semana | Criterio de Aceptación |
|-----------|--------|----------------------|
| M2.1 Catálogo de servicios funcional | 6 | Un negocio puede crear, editar y eliminar servicios con categorías |
| M2.2 Profesionales con agenda | 7 | Un profesional puede configurar su disponibilidad semanal |
| M2.3 Motor de reservas básico | 8 | Un cliente puede reservar una cita y ver disponibilidad en tiempo real |
| M2.4 Ciclo de vida de citas | 9 | Las citas pasan por todos los estados con las reglas correctas |
| M2.5 Notificaciones operativas | 10 | Se envían correos y push en cada transición de estado de cita |

### Dependencias

- Depende de los modelos de Core (Service, Professional, Availability)
- RabbitMQ debe estar configurado correctamente desde Fase 1
- Las notificaciones necesitan las plantillas diseñadas y aprobadas

### Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Concurrencia en reservas (doble booking) | Alta | Alto | Implementar optimistic locking y pruebas de concurrencia |
| Complejidad del motor de disponibilidad | Media | Alto | Diseñar algoritmo con tests exhaustivos antes de integrar |
| Retrasos en proveedores de email | Media | Medio | Cola con reintentos; no bloquear el flujo de reserva |
| Sobrecarga de notificaciones | Baja | Medio | Rate limiting por usuario y canal |

---

## Fase 3: Pagos + Marketplace + Reseñas

### Semanas 11-14

### Objetivos

- Implementar el registro de pagos offline (sin procesamiento electrónico)
- Crear los perfiles públicos de negocio (marketplace) con SEO
- Desplegar el sistema de reseñas y calificaciones
- Construir el frontend del dashboard administrativo

### Entregables

#### Semana 11-12: Servicio de Pagos (Offline)

- Servicio Payment (puerto 3004):
  - Modelo `Payment` con métodos: efectivo, tarjeta presencial, transferencia
  - Registro manual de pagos por parte del recepcionista o admin
  - Modelo `Invoice` con generación de recibos simples en PDF
  - Caja registradora (Cash Register):
    - Apertura y cierre de caja diarios
    - Registro de movimientos (ingresos, egresos, retiros)
    - Reporte de cierre con totales por método de pago
  - Conciliación básica: vincular pago con cita
  - Reportes financieros simples:
    - Ingresos diarios, semanales, mensuales
    - Desglose por profesional, servicio y método de pago
  - Sistema de puntos de fidelización:
    - Acumulación automática al registrar un pago (10% del valor)
    - Redención de puntos como descuento
    - Niveles: Bronce, Plata, Oro, Diamante

#### Semana 12-13: Marketplace y Perfiles Públicos

- Servicio Marketplace (puerto 3006):
  - Perfil público del negocio:
    - Nombre, descripción, fotos, dirección, horarios
    - Lista de servicios con precios
    - Lista de profesionales con calificaciones
    - Reseñas verificadas
    - Enlace directo a reserva
  - Optimización SEO:
    - Meta tags dinámicos (Open Graph, Twitter Cards)
    - URLs semánticas (`/negocio/barberia-ejemplo`)
    - Sitemap XML automático por negocio
    - Datos estructurados (Schema.org/LocalBusiness)
    - Server-Side Rendering para perfiles públicos
  - Búsqueda y filtrado:
    - Por nombre, ubicación, tipo de negocio
    - Por servicios ofrecidos
    - Por calificación promedio
    - Ordenar por relevancia, distancia, calificación
  - Páginas de categoría:
    - `/barberias`, `/salones-de-belleza`, `/spas`
    - Listados con paginación

#### Semana 13-14: Reseñas

- Sistema de reseñas integrado:
  - Modelo `Review` vinculado a cita completada (solo clientes que asistieron)
  - Calificación de 1 a 5 estrellas con comentario opcional
  - Calificación desglosada: servicio, profesional, ambiente
  - Respuesta del negocio a la reseña
  - Reporte de reseñas inapropiadas
  - Moderación automática básica (filtros de lenguaje)
  - Promedio ponderado visible en el perfil del profesional y negocio
  - Notificación al profesional/negocio al recibir una reseña

#### Semana 14: Frontend Dashboard

- Dashboard administrativo (OWNER, ADMIN):
  - Vista general con KPIs: citas del día, ingresos, ocupación
  - Gestión de servicios (CRUD)
  - Gestión de profesionales (CRUD, asignación de servicios)
  - Calendario de citas con vista diaria, semanal, mensual
  - Lista de citas con filtros y búsqueda
  - Gestión de caja registradora
  - Reportes básicos exportables (CSV, PDF)
- Calendario del profesional (PROFESSIONAL):
  - Vista de agenda personal
  - Confirmar/completar/marcar no-show
  - Bloquear horarios
  - Ver perfil propio y editar disponibilidad
- Panel de recepcionista (RECEPTIONIST):
  - Crear citas para clientes
  - Registrar pagos
  - Gestionar caja registradora
  - Ver agenda general del negocio

### Milestones

| Milestone | Semana | Criterio de Aceptación |
|-----------|--------|----------------------|
| M3.1 Registro de pagos funcional | 11 | Un admin puede registrar un pago y generar un recibo PDF |
| M3.2 Caja registradora completa | 12 | Se puede abrir/cajar caja con conciliación automática |
| M3.3 Marketplace con SEO | 13 | Un negocio tiene perfil público indexable por Google |
| M3.4 Reseñas operativas | 13 | Un cliente puede dejar reseña tras cita completada |
| M3.5 Dashboard completo | 14 | Un owner puede gestionar todo su negocio desde el dashboard |

### Dependencias

- Pagos depende del ciclo de vida de citas (Fase 2)
- Marketplace depende de que los perfiles de negocio estén completos (Core)
- Reseñas dependen de citas completadas (Booking)
- El frontend depende de todos los endpoints API estar disponibles

### Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| SEO insuficiente para posicionamiento | Media | Alto | SSR obligatorio para perfiles; validar con Lighthouse |
| Generación de PDF lenta | Baja | Medio | Usar templates precompilados; cachear recibos |
| UX compleja en el dashboard | Media | Alto | Prototipar antes de desarrollar; pruebas de usabilidad |
| Inconsistencia entre servicios | Media | Alto | Contratos de API bien definidos; tests de integración |

---

## Fase 4: Analíticas + Diferenciadores

### Semanas 15-18

### Objetivos

- Implementar el servicio de analíticas avanzadas con predicciones
- Desplegar los diferenciadores competitivos del producto
- Integrar geolocalización para búsqueda de negocios cercanos
- Conectar WhatsApp Business API para notificaciones
- Pulir el programa de fidelización y gamificación

### Entregables

#### Semana 15-16: Analíticas Avanzadas

- Servicio Analytics (puerto 3007):
  - Dashboard de métricas:
    - Citas por período (día, semana, mes, trimestre)
    - Ingresos por período con comparativa
    - Tasa de ocupación por profesional
    - Tasa de no-show y cancelación
    - Servicios más populares
    - Clientes nuevos vs recurrentes
    - Ticket promedio
  - Analíticas predictivas:
    - Predicción de demanda por horario y día
    - Pronóstico de ingresos mensuales
    - Predicción de no-show por cliente (basado en historial)
    - Recomendación de horarios óptimos
  - Reportes exportables:
    - PDF con gráficos
    - CSV para análisis externo
    - Programación de reportes automáticos por email
  - Benchmarking:
    - Comparación anónima con el promedio del sector
    - Ranking de desempeño por métrica

#### Semana 16-17: Diferenciadores

- Geolocalización:
  - Búsqueda de negocios por radio de distancia
  - Integración con Google Maps / Mapbox
  - Filtro por distancia (1km, 5km, 10km, 25km)
  - Vista de mapa interactivo
  - Optimización de ubicación para SEO local
- Integración WhatsApp:
  - Conexión con WhatsApp Business API (Meta Cloud API)
  - Mensajes de confirmación de reserva
  - Recordatorios configurables (24h, 2h antes)
  - Notificación de cancelación o reagendamiento
  - Templates de mensajes aprobados por Meta
  - Opt-in/opt-out por cliente
- Programa de Fidelización:
  - Sistema de puntos:
    - Acumulación por visita y por monto gastado
    - Bonus por reseñas y referidos
    - Multiplicadores por nivel de membresía
  - Niveles con beneficios:
    - Bronce: 1x puntos, recordatorios básicos
    - Plata: 1.5x puntos, reserva prioritaria
    - Oro: 2x puntos, descuentos exclusivos, promociones anticipadas
    - Diamante: 3x puntos, servicio VIP, beneficios de socio
  - Redención de puntos:
    - Descuentos en servicios
    - Servicios gratuitos
    - Productos del negocio
- Recordatorios Inteligentes:
  - Sistema multi-canal (email, push, WhatsApp, SMS)
  - Timing personalizado basado en comportamiento del cliente
  - Escalamiento: si no confirma por email, intentar WhatsApp
  - Confirmación en un clic desde el recordatorio
  - Reagendamiento rápido desde el recordatorio

#### Semana 17-18: Pulido de Diferenciadores

- Optimización del motor de búsqueda con ranking por:
  - Relevancia de servicios
  - Calificación y reseñas
  - Cercanía al usuario
  - Disponibilidad actual
- Sistema de sugerencias de horarios basado en IA:
  - Análisis de patrones históricos de reserva
  - Recomendación de slots con mayor probabilidad de asistencia
  - Sugerencia de profesional según preferencias del cliente
  - Optimización de agenda del profesional (minimizar huecos)

### Milestones

| Milestone | Semana | Criterio de Aceptación |
|-----------|--------|----------------------|
| M4.1 Dashboard de analíticas | 15 | Un owner ve métricas clave y reportes de su negocio |
| M4.2 Predicciones funcionales | 16 | El sistema predice demanda y no-shows con >70% precisión |
| M4.3 Geolocalización activa | 16 | Un cliente encuentra negocios en un radio de 5km |
| M4.4 WhatsApp integrado | 17 | Las notificaciones de reserva llegan por WhatsApp |
| M4.5 Fidelización completa | 17 | Un cliente acumula puntos y los canjea por descuentos |
| M4.6 Recordatorios inteligentes | 18 | Los recordatorios se envían en el momento óptimo por canal |

### Dependencias

- Analíticas depende de datos históricos de reservas y pagos (Fases 2-3)
- Geolocalización requiere API key de Google Maps o Mapbox
- WhatsApp Business API requiere cuenta empresarial aprobada por Meta
- Fidelización depende del sistema de pagos

### Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Aprobación lenta de WhatsApp Business | Alta | Medio | Iniciar proceso de aprobación en Fase 1; tener email como fallback |
| Precisión de predicciones insuficiente | Media | Medio | Empezar con heurísticas simples; mejorar con datos reales |
| Costo de APIs de mapas | Media | Bajo | Implementar caché agresivo; evaluar alternativas gratuitas |
| Complejidad de gamificación | Media | Medio | Empezar con puntos simples; iterar basado en feedback |

---

## Fase 5: Producción + CI/CD + Testing + Monitoreo

### Semanas 19-22

### Objetivos

- Configurar pipeline CI/CD completo para despliegue automatizado
- Implementar suite de pruebas comprehensiva (unitarias, integración, E2E)
- Desplegar infraestructura de monitoreo y observabilidad
- Preparar el entorno de producción y ejecutar el lanzamiento
- Documentación final y entrenamiento

### Entregables

#### Semana 19: CI/CD Pipeline

- Pipeline con GitHub Actions:
  - Stage de validación:
    - Lint (ESLint) en paralelo
    - Formato (Prettier check) en paralelo
    - Type checking (tsc --noEmit) en paralelo
    - Tests unitarios en paralelo por servicio
  - Stage de build:
    - Build de Docker images por microservicio
    - Tagging semántico (semantic versioning)
    - Push a container registry (Docker Hub o AWS ECR)
  - Stage de despliegue:
    - Deploy automático a staging en cada merge a `develop`
    - Deploy a producción solo desde `main` con aprobación manual
    - Rollback automático en caso de health check fallido
    - Blue-green deployment para zero-downtime
  - Stage de verificación:
    - Smoke tests post-deploy
    - Health checks de todos los servicios
    - Verificación de migraciones de base de datos

#### Semana 19-20: Testing Completo

- Pruebas unitarias:
  - Cobertura mínima del 80% en servicios críticos (Auth, Booking, Payment)
  - Cobertura mínima del 60% en el resto de servicios
  - Mocks de dependencias externas (Redis, RabbitMQ, APIs)
- Pruebas de integración:
  - Flujos end-to-end por servicio:
    - Auth: registro -> login -> refresh -> logout
    - Booking: crear cita -> confirmar -> completar -> reseñar
    - Payment: registrar pago -> generar factura -> cerrar caja
  - Pruebas de comunicación entre servicios via RabbitMQ
  - Pruebas de aislamiento multi-tenant
- Pruebas E2E (Cypress/Playwright):
  - Flujo completo de onboarding de negocio
  - Flujo completo de reserva de cliente
  - Flujo de gestión de citas por profesional
  - Flujo administrativo completo
- Pruebas de carga:
  - Simulación de 100 usuarios concurrentes
  - Prueba de estrés en motor de reservas
  - Verificación de rate limiting
- Pruebas de seguridad:
  - OWASP Top 10 básico
  - Prueba de inyección SQL
  - Prueba de XSS y CSRF
  - Prueba de autenticación y autorización

#### Semana 20-21: Monitoreo y Observabilidad

- Stack de monitoreo:
  - Prometheus para métricas
  - Grafana para dashboards de infraestructura y aplicación
  - Alertas configuradas:
    - CPU/RAM > 80%
    - Error rate > 5%
    - Latencia p95 > 2 segundos
    - Servicio caído (health check fallido)
- Logging centralizado:
  - ELK Stack (Elasticsearch, Logstash, Kibana) o Loki
  - Structured logging (JSON) en todos los servicios
  - Correlación de logs con trace IDs
  - Retención de 30 días en producción
- Distributed tracing:
  - OpenTelemetry instrumentado en todos los servicios
  - Jaeger o Zipkin para visualización de traces
  - Trazabilidad de peticiones entre microservicios
- Health checks:
  - `/health` endpoint en cada servicio (DB, Redis, RabbitMQ)
  - Health check compuesto en API Gateway
  - Circuit breaker en llamadas entre servicios

#### Semana 21-22: Preparación para Producción

- Infraestructura como código:
  - Docker Compose de producción optimizado
  - Configuración de Nginx como reverse proxy y SSL termination
  - Scripts de backup automático de base de datos
  - Runbooks para incidentes comunes
- Seguridad:
  - SSL/TLS en todos los endpoints
  - Secrets management con variables de entorno encriptadas
  - Rate limiting por IP y por tenant
  - CORS configurado por dominio
  - Headers de seguridad (Helmet.js)
- Documentación:
  - Guía de despliegue actualizada
  - Runbooks de operación
  - Guía de troubleshooting
  - Documentación de API completa (Swagger)
- Lanzamiento:
  - Beta cerrada con 5-10 negocios piloto
  - Recopilación de feedback
  - Iteración sobre issues críticos
  - Lanzamiento público

### Milestones

| Milestone | Semana | Criterio de Aceptación |
|-----------|--------|----------------------|
| M5.1 CI/CD operativo | 19 | Cada PR ejecuta lint, tests y build automáticamente |
| M5.2 Testing >80% core | 20 | Auth, Booking y Payment tienen cobertura >80% |
| M5.3 Monitoreo activo | 21 | Dashboards de Grafana muestran métricas en tiempo real |
| M5.4 Beta lanzada | 22 | Al menos 5 negocios activos usando la plataforma |

### Dependencias

- Todo el desarrollo de Fases 1-4 debe estar completo
- Se requiere infraestructura cloud configurada (AWS, GCP o DigitalOcean)
- Dominio y certificados SSL deben estar listos
- Cuenta de WhatsApp Business API aprobada

### Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Bugs críticos en beta | Alta | Alto | Proceso de hotfix definido; rollback rápido |
| Problemas de rendimiento | Media | Alto | Pruebas de carga tempranas; optimización proactiva |
| Adopción lenta de beta | Media | Medio | Onboarding personalizado; soporte dedicado |
| Costos de infraestructura altos | Media | Medio | Monitoreo de costos; optimización de recursos |

---

## Criterios de Lanzamiento

### Criterios para Beta (Semana 22)

- [ ] Todos los servicios pasan health checks consistentemente
- [ ] Cobertura de tests >70% en servicios críticos
- [ ] Flujos principales (onboarding, reserva, pago) funcionan E2E sin errores
- [ ] Notificaciones llegan por al menos 2 canales (email + uno más)
- [ ] Dashboard administrativo permite gestión completa del negocio
- [ ] Marketplace muestra perfiles públicos con SEO básico
- [ ] CI/CD despliega automáticamente a staging
- [ ] Monitoreo y alertas configurados
- [ ] Documentación de API completa
- [ ] Al menos 5 negocios piloto registrados y activos

### Criterios para Producción (Post-Beta, Semana 24+)

- [ ] Beta cerrada sin bugs críticos abiertos
- [ ] Cobertura de tests >80% en todos los servicios
- [ ] Pruebas de carga superan 200 usuarios concurrentes
- [ ] Pruebas de seguridad sin vulnerabilidades críticas o altas
- [ ] SLA de disponibilidad >99.5% durante 2 semanas de beta
- [ ] Tiempo de respuesta p95 < 1 segundo en endpoints principales
- [ ] Backup y restauración de base de datos verificados
- [ ] Runbooks de incidentes documentados y probados
- [ ] Proceso de onboarding self-service validado con usuarios reales
- [ ] NPS de beta testers > 40
- [ ] Al menos 10 negocios activos con uso recurrente (3+ semanas)
- [ ] Plan de escalamiento definido para 100+ negocios

---

## Cronograma Visual

```
Semanas  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22
         |-------- Fase 1 --------|
                                   |--------- Fase 2 ---------|
                                                              |------- Fase 3 -------|
                                                                                      |------- Fase 4 -------|
                                                                                                              |------- Fase 5 -------|
```

## Resumen de Microservicios por Fase

| Servicio | Puerto | Fase Implementación | Fase Compleción |
|----------|--------|---------------------|-----------------|
| API Gateway | 3000 | Fase 1 | Fase 2 |
| Auth Service | 3001 | Fase 1 | Fase 1 |
| Core Service | 3002 | Fase 1 | Fase 2 |
| Booking Service | 3003 | Fase 2 | Fase 2 |
| Payment Service | 3004 | Fase 3 | Fase 3 |
| Notification Service | 3005 | Fase 2 | Fase 4 |
| Marketplace Service | 3006 | Fase 3 | Fase 4 |
| Analytics Service | 3007 | Fase 4 | Fase 4 |

---

## Notas Adicionales

### Principios Guía

1. **Iterativo e incremental**: Cada fase entrega valor funcional
2. **Calidad sobre velocidad**: Testing es obligatorio, no negociable
3. **Feedback temprano**: Demo con stakeholders al final de cada fase
4. **Deuda técnica controlada**: Cada fase incluye tiempo para refactorización
5. **Documentación viva**: Actualizar docs concurrentemente con el código

### Supuestos

- Equipo de 3-4 desarrolladores full-time
- Infraestructura cloud disponible desde la Fase 1
- Acceso a cuentas de SendGrid, Firebase y WhatsApp Business API
- Stakeholders disponibles para validación quincenal

### Plan de Contingencia

- Si la Fase 1 se retrasa >1 semana: simplificar multi-tenancy a columna simple
- Si la Fase 2 se retrasa >1 semana: lanzar sin citas recurrentes
- Si la Fase 3 se retrasa >1 semana: lanzar sin marketplace, solo dashboard
- Si la Fase 4 se retrasa >1 semana: diferenciantes pasan a post-MVP
- Si la Fase 5 tiene bugs críticos: extender beta 2 semanas adicionales
