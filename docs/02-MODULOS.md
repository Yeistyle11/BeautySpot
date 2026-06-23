# BeautySpot SaaS - Catalogo de Modulos

## Vision General

Este documento describe en detalle cada modulo funcional del sistema BeautySpot, incluyendo sus objetivos, funcionalidades clave, dependencias con otros modulos, riesgos identificados y su prioridad de implementacion.

### Leyenda

- **Complejidad**: Baja (semanas), Media (1-2 meses), Alta (2+ meses)
- **Prioridad**: P0 (MVP esencial), P1 (MVP deseable), P2 (Post-MVP)
- **Dependencias**: Modulos que deben estar implementados antes o durante el desarrollo del modulo actual

---

## Modulo 1: Auth (Autenticacion y Autorizacion)

### Objetivo

Gestionar la identidad de los usuarios, la autenticacion (login, registro, recuperacion), la emision y validacion de tokens JWT, y el control de acceso basado en roles (RBAC) para los seis roles del sistema.

### Funcionalidades Clave

1. Registro de usuarios con email y contrasena, incluyendo verificacion de email
2. Inicio de sesion con email/contrasena y generacion de par access/refresh token
3. Autenticacion con proveedores OAuth 2.0 (Google)
4. Recuperacion de contrasena mediante token temporal enviado por email
5. Refresco de access tokens mediante refresh token con rotacion
6. Cierre de sesion con invalidacion del refresh token
7. Control de acceso basado en roles (RBAC) con guards y decorators en NestJS
8. Rate limiting en intentos de autenticacion (5 intentos, bloqueo 15 min)
9. Gestion de membresias de usuarios en negocios (relacion usuario-negocio-rol)
10. Logs de auditoria de eventos de seguridad (login, logout, cambios de contrasena, acceso denegado)

### Dependencias

| Modulo            | Tipo de dependencia | Descripcion                                                  |
| ----------------- | ------------------- | ------------------------------------------------------------ |
| Notification      | Obligatoria         | Envio de emails de verificacion y recuperacion de contrasena |
| Core - Businesses | Obligatoria         | Resolucion del negocio (tenant) al que pertenece el usuario  |
| API Gateway       | Obligatoria         | Validacion de tokens en cada request entrante                |

### Riesgos y Mitigacion

| Riesgo                 | Impacto | Probabilidad | Mitigacion                                                           |
| ---------------------- | ------- | ------------ | -------------------------------------------------------------------- |
| Fuga de tokens JWT     | Alto    | Baja         | TTL corto (15 min), rotacion de refresh tokens, lista negra en Redis |
| Ataque de fuerza bruta | Alto    | Media        | Rate limiting por IP + por usuario, CAPTCHA despues de 3 intentos    |
| Compromiso de secretos | Critico | Baja         | Variables de entorno encriptadas, rotacion periodica, no hardcodear  |

### Atributos

| Atributo      | Valor                      |
| ------------- | -------------------------- |
| Complejidad   | Alta                       |
| Prioridad     | P0                         |
| Servicio      | Auth Service (Puerto 3002) |
| Base de datos | auth_db                    |

---

## Modulo 2: Businesses (Negocios)

### Objetivo

Gestionar el ciclo de vida completo de los negocios registrados en la plataforma: alta, edicion, configuracion, activacion y baja. Cada negocio es un tenant en la arquitectura multi-tenant.

### Funcionalidades Clave

1. Onboarding guiado de nuevo negocio con wizard paso a paso (nombre, tipo, direccion, horarios)
2. Edicion de datos generales del negocio (nombre, descripcion, telefono, email, logo, direccion)
3. Configuracion de horarios de operacion por dia de la semana (apertura, cierre, cerrado)
4. Gestion de la zona horaria del negocio (por defecto America/Bogota)
5. Generacion y validacion de slug unico para subdominio ({slug}.beautyspot.co)
6. Configuracion de moneda local del negocio (COP por defecto)
7. Configuracion de reglas de operacion (intervalo de citas, tiempo minimo de cancelacion)
8. Activacion y desactivacion de negocio (soft delete)
9. Vista de listado de negocios para SUPER_ADMIN con filtros y paginacion
10. Dashboard de estado del negocio (completitud del perfil, proximas citas)

### Dependencias

| Modulo                          | Tipo de dependencia | Descripcion                                                       |
| ------------------------------- | ------------------- | ----------------------------------------------------------------- |
| Auth                            | Obligatoria         | El OWNER debe estar autenticado para crear/administrar el negocio |
| Core - Branches                 | Opcional            | Las sucursales dependen de un negocio existente                   |
| Marketplace - Business Profiles | Obligatoria         | Generacion automatica del perfil publico al crear el negocio      |

### Riesgos y Mitigacion

| Riesgo                          | Impacto | Probabilidad | Mitigacion                                                            |
| ------------------------------- | ------- | ------------ | --------------------------------------------------------------------- |
| Slugs duplicados                | Medio   | Media        | Validacion unica en BD + generacion automatica con sufijo numerico    |
| Datos incompletos en onboarding | Medio   | Alta         | Wizard con validacion por pasos, indicador de completitud             |
| Perdida de datos al desactivar  | Alto    | Baja         | Soft delete con periodo de gracia (30 dias) antes de eliminacion real |

### Atributos

| Atributo      | Valor                      |
| ------------- | -------------------------- |
| Complejidad   | Media                      |
| Prioridad     | P0                         |
| Servicio      | Core Service (Puerto 3003) |
| Base de datos | core_db                    |

---

## Modulo 3: Branches (Sucursales)

### Objetivo

Permitir la gestion de multiples sucursales para un mismo negocio, cada una con sus propios profesionales, horarios y configuracion regional.

### Funcionalidades Clave

1. Creacion de sucursales vinculadas a un negocio (nombre, direccion, telefono)
2. Edicion de datos de sucursal
3. Configuracion de horarios de operacion por sucursal (heredados del negocio o personalizados)
4. Activacion/desactivacion de sucursales
5. Asignacion de profesionales a sucursales
6. Asignacion de recepcionistas a sucursales
7. Vista de listado de sucursales por negocio

### Dependencias

| Modulo        | Tipo de dependencia | Descripcion                              |
| ------------- | ------------------- | ---------------------------------------- |
| Businesses    | Obligatoria         | Cada sucursal pertenece a un negocio     |
| Professionals | Obligatoria         | Asignacion de profesionales a sucursales |

### Riesgos y Mitigacion

| Riesgo                                       | Impacto | Probabilidad | Mitigacion                                               |
| -------------------------------------------- | ------- | ------------ | -------------------------------------------------------- |
| Configuracion inconsistente entre sucursales | Medio   | Media        | Herencia de configuracion del negocio con override local |
| Confusion de datos entre sucursales          | Alto    | Baja         | Filtro estricto de branchId en todas las consultas       |

### Atributos

| Atributo      | Valor                      |
| ------------- | -------------------------- |
| Complejidad   | Baja                       |
| Prioridad     | P1                         |
| Servicio      | Core Service (Puerto 3003) |
| Base de datos | core_db                    |

---

## Modulo 4: Professionals (Profesionales)

### Objetivo

Gestionar los perfiles de los profesionales que prestan servicios dentro de un negocio, incluyendo sus datos personales, especialidades, disponibilidad y asignacion de servicios.

### Funcionalidades Clave

1. Registro de profesionales vinculados a un negocio y sucursal
2. Perfil con nombre, apellido, especialidades, foto, biografia, numero de contacto
3. Vinculacion de un usuario del sistema al perfil profesional
4. Asignacion de servicios al profesional con precio y duracion personalizables
5. Configuracion de horarios de disponibilidad (ver modulo Availability)
6. Activacion/desactivacion de profesionales (soft delete)
7. Rating promedio calculado automaticamente desde resenas
8. Historial de servicios realizados (a traves de citas completadas)
9. Orden de prioridad para asignacion automatica de citas
10. Listado con filtros (sucursal, especialidad, estado)

### Dependencias

| Modulo                | Tipo de dependencia | Descripcion                                                  |
| --------------------- | ------------------- | ------------------------------------------------------------ |
| Businesses            | Obligatoria         | El profesional pertenece a un negocio                        |
| Services              | Obligatoria         | Asignacion de servicios que el profesional puede realizar    |
| Auth                  | Opcional            | Vinculacion con cuenta de usuario para login del profesional |
| Marketplace - Reviews | Opcional            | Calculo de rating desde resenas                              |

### Riesgos y Mitigacion

| Riesgo                                          | Impacto | Probabilidad | Mitigacion                                                                       |
| ----------------------------------------------- | ------- | ------------ | -------------------------------------------------------------------------------- |
| Profesional sin disponibilidad configurada      | Alto    | Alta         | Wizard post-creacion, recordatorios, no aparecer en busquedas sin disponibilidad |
| Datos de contacto del profesional visibles      | Medio   | Media        | Control de privacidad configurado por el negocio                                 |
| Reasignacion de citas al desactivar profesional | Alto    | Media        | Alerta de citas pendientes antes de desactivar, reasignacion sugerida            |

### Atributos

| Atributo      | Valor                      |
| ------------- | -------------------------- |
| Complejidad   | Media                      |
| Prioridad     | P0                         |
| Servicio      | Core Service (Puerto 3003) |
| Base de datos | core_db                    |

---

## Modulo 5: Services (Servicios)

### Objetivo

Administrar el catalogo de servicios que ofrece un negocio, incluyendo categorias, precios, duracion y asignacion a profesionales.

### Funcionalidades Clave

1. Creacion de servicios con nombre, descripcion, categoria, precio base, duracion estimada
2. Categorias predefinidas (Cortes, Barba, Paquetes, Tratamientos, Otros) y personalizadas
3. Asignacion de servicios a profesionales (tabla join professional_services)
4. Precio y duracion personalizables por profesional para un mismo servicio
5. Activacion/desactivacion de servicios (soft delete)
6. Ordenamiento y agrupacion por categoria
7. Busqueda por nombre y categoria dentro del negocio
8. Etiquetas/tags para facilitar la busqueda y filtrado
9. Validacion de que un servicio activo tenga al menos un profesional asignado
10. Historial de cambios de precio (post-MVP)

### Dependencias

| Modulo        | Tipo de dependencia | Descripcion                                                |
| ------------- | ------------------- | ---------------------------------------------------------- |
| Businesses    | Obligatoria         | Los servicios pertenecen a un negocio                      |
| Professionals | Obligatoria         | Asignacion a profesionales que pueden realizar el servicio |

### Riesgos y Mitigacion

| Riesgo                                     | Impacto | Probabilidad | Mitigacion                                                    |
| ------------------------------------------ | ------- | ------------ | ------------------------------------------------------------- |
| Eliminar servicio con citas pendientes     | Alto    | Media        | Prevenir eliminacion si hay citas futuras, solo desactivar    |
| Precios inconsistentes entre profesionales | Bajo    | Alta         | Mostrar precio base como referencia, permitir personalizacion |

### Atributos

| Atributo      | Valor                      |
| ------------- | -------------------------- |
| Complejidad   | Baja                       |
| Prioridad     | P0                         |
| Servicio      | Core Service (Puerto 3003) |
| Base de datos | core_db                    |

---

## Modulo 6: Clients (Clientes)

### Objetivo

Gestionar la informacion de los clientes de cada negocio, incluyendo datos de contacto, historial de citas, preferencias y notas internas del negocio.

### Funcionalidades Clave

1. Registro manual de clientes por parte del personal del negocio
2. Perfil del cliente: nombre, apellido, telefono, email, fecha de nacimiento, notas
3. Historial completo de citas del cliente en el negocio
4. Historial de pagos del cliente
5. Busqueda por nombre, telefono o email dentro del negocio
6. Notas internas del negocio sobre el cliente (no visibles para el cliente)
7. Vinculacion automatica con cuenta de usuario del sistema si el email coincide
8. Importacion masiva via CSV (post-MVP)
9. Etiquetas/segmentos de clientes (VIP, nuevo, frecuente)
10. Prevencion de duplicados por email/telefono dentro del mismo negocio

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion                          |
| ---------------------- | ------------------- | ------------------------------------ |
| Businesses             | Obligatoria         | Los clientes pertenecen a un negocio |
| Booking - Appointments | Opcional            | Historial de citas                   |
| Payment - Payments     | Opcional            | Historial de pagos                   |

### Riesgos y Mitigacion

| Riesgo                                          | Impacto | Probabilidad | Mitigacion                                                                                 |
| ----------------------------------------------- | ------- | ------------ | ------------------------------------------------------------------------------------------ |
| Clientes duplicados                             | Medio   | Alta         | Validacion de email/telefono unico por negocio, merge manual                               |
| Datos personales sensibles                      | Alto    | Media        | Encriptacion de datos PII, cumplimiento de privacidad                                      |
| Confusion cliente global vs cliente por negocio | Alto    | Media        | Modelo de cliente por negocio (no global), un usuario puede ser cliente de varios negocios |

### Atributos

| Atributo      | Valor                      |
| ------------- | -------------------------- |
| Complejidad   | Media                      |
| Prioridad     | P0                         |
| Servicio      | Core Service (Puerto 3003) |
| Base de datos | core_db                    |

---

## Modulo 7: Appointments (Citas)

### Objetivo

Gestionar el ciclo de vida completo de las citas: creacion, confirmacion, reagendamiento, cancelacion, completado y marcacion de no-show, con prevencion de solapamiento y calculo automatico de duracion y precio.

### Funcionalidades Clave

1. Creacion manual de citas por recepcionista/admin con seleccion de cliente, profesional, servicios, fecha y hora
2. Creacion de citas por cliente via marketplace/perfil publico del negocio
3. Verificacion de disponibilidad en tiempo real antes de crear la cita
4. Prevencion de solapamiento: un profesional no puede tener dos citas al mismo tiempo
5. Calculo automatico de duracion total (suma de servicios) y precio total
6. Asociacion de multiples servicios a una cita
7. Ciclo de vida de estados: PENDING -> CONFIRMED -> COMPLETED / CANCELLED / NO_SHOW
8. Confirmacion de cita por profesional o recepcionista
9. Cancelacion con validacion de reglas de tiempo minimo de aviso
10. Reagendamiento con verificacion de nueva disponibilidad
11. Marcacion de no-show
12. Notas internas (visibles solo al negocio) y notas para el cliente
13. Vista de calendario (diaria, semanal, mensual)
14. Vista de lista con filtros avanzados (fecha, estado, profesional, cliente)
15. Notificaciones automaticas en cada cambio de estado

### Dependencias

| Modulo        | Tipo de dependencia | Descripcion                                              |
| ------------- | ------------------- | -------------------------------------------------------- |
| Businesses    | Obligatoria         | Las citas pertenecen a un negocio, usan su configuracion |
| Professionals | Obligatoria         | La cita se asigna a un profesional                       |
| Services      | Obligatoria         | La cita incluye uno o mas servicios                      |
| Clients       | Obligatoria         | La cita se asocia a un cliente                           |
| Availability  | Obligatoria         | Verificacion de slots disponibles                        |
| Notifications | Obligatoria         | Envio de alertas por cambios de estado                   |
| Payment       | Opcional            | Registro de pago asociado a la cita                      |

### Riesgos y Mitigacion

| Riesgo                                        | Impacto | Probabilidad | Mitigacion                                                          |
| --------------------------------------------- | ------- | ------------ | ------------------------------------------------------------------- |
| Condiciones de carrera en creacion simultanea | Critico | Media        | Lock optimista o pessimista a nivel de slot, transacciones atomicas |
| Solapamiento por concurrencia                 | Critico | Media        | Validacion en transaccion, unique constraint en BD                  |
| Citas huerfanas al desactivar profesional     | Alto    | Baja         | Alertas y reasignacion antes de desactivar                          |
| Perdida de datos de zona horaria              | Alto    | Media        | Almacenar en UTC, convertir al mostrar segun zona del negocio       |

### Atributos

| Atributo      | Valor                         |
| ------------- | ----------------------------- |
| Complejidad   | Alta                          |
| Prioridad     | P0                            |
| Servicio      | Booking Service (Puerto 3004) |
| Base de datos | booking_db                    |

---

## Modulo 8: Availability (Disponibilidad)

### Objetivo

Gestionar la disponibilidad de los profesionales: horarios regulares, excepciones, bloqueos y calculo de slots disponibles para la agenda de citas.

### Funcionalidades Clave

1. Configuracion de horarios regulares por profesional y dia de la semana (hora inicio, hora fin)
2. Creacion de excepciones (dias libres, vacaciones) con rango de fechas
3. Bloqueo de slots especificos (tiempo no disponible)
4. Calculo de slots disponibles para una fecha y profesional dados
5. Configuracion de intervalo de citas (heredado del negocio)
6. Tiempo buffer entre citas configurable por profesional
7. Consideracion de citas existentes al calcular disponibilidad
8. Vista semanal/mensual de disponibilidad del profesional
9. Resolucion de conflictos entre disponibilidad y bloqueos
10. Deteccion de gaps (espacios vacios) optimos para insercion de citas

### Dependencias

| Modulo        | Tipo de dependencia | Descripcion                                        |
| ------------- | ------------------- | -------------------------------------------------- |
| Professionals | Obligatoria         | La disponibilidad pertenece a un profesional       |
| Businesses    | Obligatoria         | Configuracion de intervalos y horarios del negocio |
| Appointments  | Obligatoria         | Las citas existentes reducen la disponibilidad     |

### Riesgos y Mitigacion

| Riesgo                          | Impacto | Probabilidad | Mitigacion                                           |
| ------------------------------- | ------- | ------------ | ---------------------------------------------------- |
| Disponibilidad no configurada   | Alto    | Alta         | Valores por defecto, wizard de configuracion inicial |
| Conflictos con zona horaria     | Alto    | Media        | Almacenar en UTC, convertir al mostrar               |
| Performance en calculo de slots | Medio   | Media        | Cache en Redis, pre-calculo para fechas cercanas     |

### Atributos

| Atributo      | Valor                         |
| ------------- | ----------------------------- |
| Complejidad   | Alta                          |
| Prioridad     | P0                            |
| Servicio      | Booking Service (Puerto 3004) |
| Base de datos | booking_db                    |

---

## Modulo 9: Payments (Pagos)

### Objetivo

Registrar y gestionar los pagos realizados por los clientes, incluyendo pagos en efectivo, transferencias y tarjetas presenciales. En el MVP no se procesan pagos online; el registro es manual.

### Funcionalidades Clave

1. Registro manual de pago asociado a una cita (efectivo, transferencia, tarjeta presencial, otro)
2. Registro de pagos parciales y pagos multiples para una misma cita
3. Calculo automatico del total basado en los servicios de la cita
4. Registro de propinas
5. Estados de pago: PENDING, PARTIAL, COMPLETED, REFUNDED
6. Historial de pagos por cliente
7. Historial de pagos por profesional (comisiones post-MVP)
8. Conciliacion de pagos vs citas completadas
9. Notas en el registro de pago
10. Solo personal autorizado (recepcionista, admin, owner) puede registrar pagos

### Dependencias

| Modulo       | Tipo de dependencia | Descripcion                                |
| ------------ | ------------------- | ------------------------------------------ |
| Appointments | Obligatoria         | El pago se asocia a una cita               |
| Clients      | Obligatoria         | El pago se asocia a un cliente             |
| Businesses   | Obligatoria         | Configuracion de metodos de pago aceptados |
| Invoices     | Opcional            | Generacion de factura/recibo               |

### Riesgos y Mitigacion

| Riesgo                        | Impacto | Probabilidad | Mitigacion                                                  |
| ----------------------------- | ------- | ------------ | ----------------------------------------------------------- |
| Registro incorrecto de montos | Alto    | Media        | Validacion contra total de la cita, alertas de discrepancia |
| Pagos duplicados              | Medio   | Media        | Validacion de unicidad por cita + metodo + fecha            |
| Falta de trazabilidad         | Alto    | Baja         | Audit log en cada operacion de pago                         |

### Atributos

| Atributo      | Valor                         |
| ------------- | ----------------------------- |
| Complejidad   | Media                         |
| Prioridad     | P0                            |
| Servicio      | Payment Service (Puerto 3005) |
| Base de datos | payment_db                    |

---

## Modulo 10: Invoices (Facturas/Recibos)

### Objetivo

Generar y gestionar comprobantes de pago (recibos simplificados y facturas) para los clientes, con posibilidad de descarga en PDF.

### Funcionalidades Clave

1. Generacion automatica de recibo al completar un pago
2. Numero de recibo consecutivo por negocio
3. Datos del negocio, cliente, servicios, profesional y totales
4. Descarga en formato PDF
5. Reenvio de recibo por email al cliente
6. Anulacion de recibos (con nota de credito)
7. Configuracion de datos fiscales del negocio (NIT, razon social, post-MVP)

### Dependencias

| Modulo       | Tipo de dependencia | Descripcion                             |
| ------------ | ------------------- | --------------------------------------- |
| Payments     | Obligatoria         | El recibo se genera a partir de un pago |
| Businesses   | Obligatoria         | Datos del negocio en el recibo          |
| Clients      | Obligatoria         | Datos del cliente en el recibo          |
| Notification | Opcional            | Envio de recibo por email               |

### Riesgos y Mitigacion

| Riesgo                                   | Impacto | Probabilidad | Mitigacion                                                       |
| ---------------------------------------- | ------- | ------------ | ---------------------------------------------------------------- |
| Numeracion duplicada                     | Medio   | Baja         | Secuencia auto-incremental por negocio con unique constraint     |
| Formato no valido para facturacion legal | Medio   | Baja         | MVP como recibo no fiscal; preparar para facturacion electronica |

### Atributos

| Atributo      | Valor                         |
| ------------- | ----------------------------- |
| Complejidad   | Media                         |
| Prioridad     | P1                            |
| Servicio      | Payment Service (Puerto 3005) |
| Base de datos | payment_db                    |

---

## Modulo 11: Cash Register (Caja)

### Objetivo

Gestionar las sesiones de caja (apertura y cierre) de cada sucursal, permitiendo el registro de movimientos de ingresos y egresos con calculo de totales al cierre.

### Funcionalidades Clave

1. Apertura de caja con monto inicial (efectivo en caja)
2. Registro automatico de ingresos cuando se registra un pago en efectivo
3. Registro manual de egresos (compras, gastos operativos, retiros)
4. Cierre de caja con calculo: total ingresos - total egresos + monto inicial = monto final esperado
5. Registro de diferencia entre monto final esperado y monto final real (sobrante/faltante)
6. Historial de sesiones de caja por sucursal y fecha
7. Reporte de movimientos de una sesion de caja
8. Solo un usuario a la vez puede tener la caja abierta por sucursal
9. Notas en cada movimiento de caja

### Dependencias

| Modulo              | Tipo de dependencia | Descripcion                             |
| ------------------- | ------------------- | --------------------------------------- |
| Payments            | Obligatoria         | Los pagos en efectivo alimentan la caja |
| Businesses/Branches | Obligatoria         | La caja pertenece a una sucursal        |

### Riesgos y Mitigacion

| Riesgo                                       | Impacto | Probabilidad | Mitigacion                                                        |
| -------------------------------------------- | ------- | ------------ | ----------------------------------------------------------------- |
| Caja sin cerrar al final del dia             | Medio   | Alta         | Notificacion automatica de caja abierta, cierre forzado por admin |
| Diferencias frecuentes entre esperado y real | Medio   | Media        | Alertas de descuadre, historial de diferencias                    |
| Concurrencia en apertura de caja             | Bajo    | Baja         | Unique constraint: solo una caja abierta por sucursal             |

### Atributos

| Atributo      | Valor                         |
| ------------- | ----------------------------- |
| Complejidad   | Media                         |
| Prioridad     | P0                            |
| Servicio      | Payment Service (Puerto 3005) |
| Base de datos | payment_db                    |

---

## Modulo 12: Notifications (Notificaciones)

### Objetivo

Gestionar el envio de notificaciones a los usuarios del sistema a traves de multiples canales (in-app, email, push post-MVP) con preferencias configurables.

### Funcionalidades Clave

1. Notificaciones in-app con indicador de no leidas en el dashboard
2. Notificaciones por email transaccional (confirmacion de cita, recordatorios, cancelaciones)
3. Preferencias de notificacion configurables por usuario y tipo de evento
4. Marcaje de notificaciones como leidas/no leidas (individual y masivo)
5. Listado de notificaciones con paginacion y filtros
6. Templates de email configurables (post-MVP)
7. Cola de procesamiento para envio masivo de notificaciones
8. Tipos de notificacion: cita creada, cita confirmada, cita cancelada, cita reagendada, recordatorio, no-show, pago registrado
9. Notificacion push via service worker (post-MVP)
10. TTL de notificaciones in-app (auto-eliminacion despues de 90 dias)

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion                                  |
| ---------------------- | ------------------- | -------------------------------------------- |
| Auth                   | Obligatoria         | Identificar al usuario destinatario          |
| Core - Businesses      | Obligatoria         | Contexto del negocio para las notificaciones |
| Booking - Appointments | Obligatoria         | Eventos de citas que disparan notificaciones |
| Payment                | Opcional            | Notificaciones de pagos registrados          |

### Riesgos y Mitigacion

| Riesgo                             | Impacto | Probabilidad | Mitigacion                                                       |
| ---------------------------------- | ------- | ------------ | ---------------------------------------------------------------- |
| Emails marcados como spam          | Alto    | Media        | DKIM/SPF configurados, reputacion del dominio, throttle de envio |
| Retraso en notificaciones criticas | Alto    | Baja         | Cola prioritaria para notificaciones de citas, monitoreo de cola |
| Sobrecarga de notificaciones       | Medio   | Alta         | Preferencias granulares, digest diario (post-MVP)                |

### Atributos

| Atributo      | Valor                              |
| ------------- | ---------------------------------- |
| Complejidad   | Media                              |
| Prioridad     | P0                                 |
| Servicio      | Notification Service (Puerto 3006) |
| Base de datos | notification_db                    |

---

## Modulo 13: Notification Preferences (Preferencias de Notificacion)

### Objetivo

Permitir a cada usuario configurar que tipos de notificaciones desea recibir y por que canal, proporcionando una experiencia personalizada y evitando el spam.

### Funcionalidades Clave

1. Configuracion por tipo de evento (citas, pagos, promociones, sistema)
2. Configuracion por canal (in-app, email, push)
3. Habilitar/deshabilitar notificaciones globalmente
4. Horario de silencio (no enviar notificaciones en ciertas horas)
5. Preferencias por defecto segun rol (el profesional recibe recordatorios de citas, el dueno recibe reportes)
6. Restaurar preferencias a valores por defecto

### Dependencias

| Modulo        | Tipo de dependencia | Descripcion                            |
| ------------- | ------------------- | -------------------------------------- |
| Auth          | Obligatoria         | Identificar al usuario                 |
| Notifications | Obligatoria         | Consultar preferencias antes de enviar |

### Riesgos y Mitigacion

| Riesgo                        | Impacto | Probabilidad | Mitigacion                                               |
| ----------------------------- | ------- | ------------ | -------------------------------------------------------- |
| Preferencias muy restrictivas | Medio   | Media        | Notificaciones criticas (seguridad) no son desactivables |
| Configuracion confusa         | Bajo    | Media        | UI simple con toggles, defaults sensatos                 |

### Atributos

| Atributo      | Valor                              |
| ------------- | ---------------------------------- |
| Complejidad   | Baja                               |
| Prioridad     | P1                                 |
| Servicio      | Notification Service (Puerto 3006) |
| Base de datos | notification_db                    |

---

## Modulo 14: Search (Busqueda)

### Objetivo

Proveer funcionalidad de busqueda en el marketplace para que los clientes encuentren negocios por nombre, ubicacion, tipo de servicio y otros filtros.

### Funcionalidades Clave

1. Busqueda full-text por nombre de negocio y nombre de servicio
2. Filtros por tipo de negocio (barberia, salon, spa, centro estetico)
3. Filtros por categoria de servicio
4. Filtros por calificacion promedio
5. Ordenamiento por relevancia, calificacion, nombre
6. Sugerencias de autocompletado (post-MVP con Elasticsearch)
7. Resultados paginados
8. Busqueda por ubicacion geografica (post-MVP)
9. Historial de busquedas del usuario (post-MVP)

### Dependencias

| Modulo                          | Tipo de dependencia | Descripcion                      |
| ------------------------------- | ------------------- | -------------------------------- |
| Marketplace - Business Profiles | Obligatoria         | Datos indexados de los negocios  |
| Core - Services                 | Obligatoria         | Datos de servicios para busqueda |

### Riesgos y Mitigacion

| Riesgo                          | Impacto | Probabilidad | Mitigacion                                                     |
| ------------------------------- | ------- | ------------ | -------------------------------------------------------------- |
| Performance con muchos negocios | Medio   | Baja         | Indice full-text en PostgreSQL, cache de resultados frecuentes |
| Resultados irrelevantes         | Medio   | Media        | Ranking por calificacion y actividad, relevancia tunable       |

### Atributos

| Atributo      | Valor                             |
| ------------- | --------------------------------- |
| Complejidad   | Media                             |
| Prioridad     | P1                                |
| Servicio      | Marketplace Service (Puerto 3007) |
| Base de datos | marketplace_db                    |

---

## Modulo 15: Business Profiles (Perfiles Publicos de Negocio)

### Objetivo

Generar y mantener las paginas publicas de cada negocio accesibles via subdominio ({slug}.beautyspot.co), mostrando informacion del negocio, servicios, profesionales y permitiendo la reserva directa.

### Funcionalidades Clave

1. Pagina publica accesible sin autenticacion via subdominio
2. Datos del negocio: nombre, descripcion, direccion, telefono, logo, horarios
3. Listado de servicios con precios y duracion
4. Listado de profesionales con foto, especialidades y calificacion
5. Calificacion promedio del negocio basada en resenas
6. Galeria de imagenes (post-MVP)
7. Flujo de reserva directa: seleccionar servicio -> profesional -> fecha/hora -> confirmar
8. SEO basico (meta tags, structured data, Open Graph)
9. Preview de enlace para redes sociales
10. Pagina responsive optimizada para movil

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion                    |
| ---------------------- | ------------------- | ------------------------------ |
| Core - Businesses      | Obligatoria         | Datos del negocio              |
| Core - Services        | Obligatoria         | Catalogo de servicios          |
| Core - Professionals   | Obligatoria         | Datos de profesionales         |
| Booking - Appointments | Obligatoria         | Flujo de reserva               |
| Booking - Availability | Obligatoria         | Slots disponibles para reserva |
| Marketplace - Reviews  | Opcional            | Calificaciones y resenas       |

### Riesgos y Mitigacion

| Riesgo                           | Impacto | Probabilidad | Mitigacion                                           |
| -------------------------------- | ------- | ------------ | ---------------------------------------------------- |
| Subdominio no resuelve           | Critico | Baja         | Wildcard DNS configurado, health check de resolucion |
| Contenido desactualizado         | Medio   | Media        | Cache con TTL corto (5 min), invalidacion en edicion |
| Performance de la pagina publica | Medio   | Media        | CDN, cache agresivo, SSR con revalidacion            |

### Atributos

| Atributo      | Valor                             |
| ------------- | --------------------------------- |
| Complejidad   | Alta                              |
| Prioridad     | P0                                |
| Servicio      | Marketplace Service (Puerto 3007) |
| Base de datos | marketplace_db                    |

---

## Modulo 16: Reviews (Resenas)

### Objetivo

Permitir que los clientes califiquen y dejen resenas sobre los negocios y profesionales, generando confianza en el marketplace y retroalimentacion util para los negocios.

### Funcionalidades Clave

1. Creacion de resena con calificacion (1-5 estrellas) y comentario opcional
2. Resena vinculada a una cita completada (una resena por cita)
3. Calificacion del negocio general y del profesional individual
4. Moderacion de resenas por parte del OWNER/ADMIN (aprobar/rechazar)
5. Respuesta del negocio a la resena
6. Calculo de calificacion promedio del negocio y profesional
7. Listado de resenas paginado en el perfil publico
8. Reporte de resena inapropiada
9. Solo clientes que completaron la cita pueden dejar resena
10. Notificacion al negocio cuando se recibe una nueva resena

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion                                    |
| ---------------------- | ------------------- | ---------------------------------------------- |
| Booking - Appointments | Obligatoria         | La resena esta vinculada a una cita completada |
| Core - Businesses      | Obligatoria         | Calificacion del negocio                       |
| Core - Professionals   | Obligatoria         | Calificacion del profesional                   |
| Notifications          | Opcional            | Alerta de nueva resena                         |

### Riesgos y Mitigacion

| Riesgo                         | Impacto | Probabilidad | Mitigacion                                           |
| ------------------------------ | ------- | ------------ | ---------------------------------------------------- |
| Resenas falsas o abusivas      | Alto    | Media        | Moderacion, verificacion de cita completada, reporte |
| Manipulacion de calificaciones | Alto    | Baja         | Una resena por cita, verificacion de identidad       |
| Clientes que no dejan resenas  | Medio   | Alta         | Recordatorio automatico post-cita (24h despues)      |

### Atributos

| Atributo      | Valor                             |
| ------------- | --------------------------------- |
| Complejidad   | Media                             |
| Prioridad     | P1                                |
| Servicio      | Marketplace Service (Puerto 3007) |
| Base de datos | marketplace_db                    |

---

## Modulo 17: Dashboard (Panel de Control)

### Objetivo

Proveer una vista consolidada con los indicadores clave del negocio para la toma de decisiones rapidas, adaptada al rol del usuario (OWNER/ADMIN ve mas datos que PROFESSIONAL).

### Funcionalidades Clave

1. KPIs principales: citas de hoy, ingresos del dia, citas pendientes, clientes nuevos
2. Grafico de citas por dia/semana/mes
3. Grafico de ingresos por dia/semana/mes
4. Proximas citas del dia con estado
5. Ranking de top servicios y profesionales
6. Vista de calendario rapido de la semana
7. Alertas y notificaciones recientes
8. Indicador de completitud del perfil del negocio
9. Dashboard del SUPER_ADMIN con metricas globales de la plataforma
10. Widget de actividad reciente (ultimas citas, pagos, resenas)

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion                  |
| ---------------------- | ------------------- | ---------------------------- |
| Analytics - Metrics    | Obligatoria         | Datos de metricas calculadas |
| Booking - Appointments | Obligatoria         | Citas de hoy y pendientes    |
| Payment - Payments     | Obligatoria         | Ingresos del dia             |
| Notifications          | Opcional            | Alertas recientes            |
| Core - Businesses      | Obligatoria         | Contexto del negocio         |

### Riesgos y Mitigacion

| Riesgo                               | Impacto | Probabilidad | Mitigacion                                                       |
| ------------------------------------ | ------- | ------------ | ---------------------------------------------------------------- |
| Dashboard lento por queries pesadas  | Alto    | Media        | Cache de metricas, pre-calculo de agregaciones, loading states   |
| Datos inconsistentes entre servicios | Medio   | Baja         | Eventual consistency aceptable para dashboard, refresh periodico |

### Atributos

| Atributo      | Valor                                      |
| ------------- | ------------------------------------------ |
| Complejidad   | Media                                      |
| Prioridad     | P0                                         |
| Servicio      | Analytics Service (Puerto 3008) + frontend |
| Base de datos | analytics_db                               |

---

## Modulo 18: Reports (Reportes)

### Objetivo

Generar reportes detallados y exportables sobre la operacion del negocio: ingresos, citas, profesionales, clientes y tendencias.

### Funcionalidades Clave

1. Reporte de ingresos por periodo (diario, semanal, mensual, personalizado)
2. Reporte de citas por estado, profesional y servicio
3. Reporte de desempeno de profesionales (citas, facturacion, calificacion)
4. Reporte de clientes (nuevos, recurrentes, top clientes)
5. Reporte de servicios mas solicitados
6. Reporte de tasa de no-show y cancelaciones
7. Exportacion a CSV y PDF
8. Envio de reporte por email (reporte semanal automatico, post-MVP)
9. Comparativo entre periodos (mes actual vs anterior)
10. Filtros avanzados por sucursal, profesional, servicio, fecha

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion            |
| ---------------------- | ------------------- | ---------------------- |
| Analytics - Metrics    | Obligatoria         | Datos agregados        |
| Payment - Payments     | Obligatoria         | Datos de ingresos      |
| Booking - Appointments | Obligatoria         | Datos de citas         |
| Core - Professionals   | Obligatoria         | Datos de profesionales |
| Core - Clients         | Obligatoria         | Datos de clientes      |

### Riesgos y Mitigacion

| Riesgo                              | Impacto | Probabilidad | Mitigacion                                             |
| ----------------------------------- | ------- | ------------ | ------------------------------------------------------ |
| Reportes lentos en periodos largos  | Medio   | Media        | Pre-agregacion diaria, limitar rango maximo a 12 meses |
| Datos inconsistentes entre reportes | Medio   | Baja         | Usar misma fuente de datos (analytics_db)              |

### Atributos

| Atributo      | Valor                           |
| ------------- | ------------------------------- |
| Complejidad   | Media                           |
| Prioridad     | P1                              |
| Servicio      | Analytics Service (Puerto 3008) |
| Base de datos | analytics_db                    |

---

## Modulo 19: Metrics (Metricas)

### Objetivo

Calcular, almacenar y exponer las metricas del negocio y de la plataforma, sirviendo como base para el dashboard y los reportes.

### Funcionalidades Clave

1. Calculo diario de metricas agregadas por negocio (citas, ingresos, clientes nuevos, no-shows)
2. Calculo diario de metricas por profesional (citas, facturacion, ocupacion)
3. Acumulacion de metricas por periodo (diario, semanal, mensual)
4. Metricas globales de la plataforma para SUPER_ADMIN
5. Almacenamiento optimizado para consultas rapidas (tablas de metricas pre-calculadas)
6. API de consulta de metricas con filtros por negocio, profesional, periodo
7. Calculo de tendencias (crecimiento vs periodo anterior)
8. Job programado (cron) para calculo de metricas diarias
9. Metricas en tiempo real (citas de hoy, ingresos de hoy) via consultas directas
10. Cache de metricas frecuentes en Redis

### Dependencias

| Modulo                 | Tipo de dependencia | Descripcion                             |
| ---------------------- | ------------------- | --------------------------------------- |
| Booking - Appointments | Obligatoria         | Datos de citas para calculo             |
| Payment - Payments     | Obligatoria         | Datos de pagos para calculo de ingresos |
| Core - Businesses      | Obligatoria         | Contexto del negocio                    |
| Core - Professionals   | Obligatoria         | Metricas por profesional                |

### Riesgos y Mitigacion

| Riesgo                        | Impacto | Probabilidad | Mitigacion                                                     |
| ----------------------------- | ------- | ------------ | -------------------------------------------------------------- |
| Job de calculo falla          | Alto    | Baja         | Retry automatico, alerta de fallo, calculo manual bajo demanda |
| Datos incompletos en metricas | Medio   | Media        | Validacion de completitud antes de guardar, gap detection      |

### Atributos

| Atributo      | Valor                           |
| ------------- | ------------------------------- |
| Complejidad   | Alta                            |
| Prioridad     | P1                              |
| Servicio      | Analytics Service (Puerto 3008) |
| Base de datos | analytics_db                    |

---

## Resumen de Prioridades

### P0 - MVP Esencial

| Modulo            | Complejidad | Servicio             |
| ----------------- | ----------- | -------------------- |
| Auth              | Alta        | Auth Service         |
| Businesses        | Media       | Core Service         |
| Professionals     | Media       | Core Service         |
| Services          | Baja        | Core Service         |
| Clients           | Media       | Core Service         |
| Appointments      | Alta        | Booking Service      |
| Availability      | Alta        | Booking Service      |
| Payments          | Media       | Payment Service      |
| Cash Register     | Media       | Payment Service      |
| Notifications     | Media       | Notification Service |
| Business Profiles | Alta        | Marketplace Service  |
| Dashboard         | Media       | Analytics Service    |

### P1 - MVP Deseable

| Modulo                   | Complejidad | Servicio             |
| ------------------------ | ----------- | -------------------- |
| Branches                 | Baja        | Core Service         |
| Invoices                 | Media       | Payment Service      |
| Notification Preferences | Baja        | Notification Service |
| Search                   | Media       | Marketplace Service  |
| Reviews                  | Media       | Marketplace Service  |
| Reports                  | Media       | Analytics Service    |
| Metrics                  | Alta        | Analytics Service    |

### P2 - Post-MVP

- Pagos online (Payment Service)
- Notificaciones push (Notification Service)
- Galeria de imagenes (Marketplace Service)
- SEO avanzado (Marketplace Service)
- Importacion CSV de clientes (Core Service)
- Reportes automatizados por email (Analytics Service)
- Busqueda geografica (Marketplace Service)
- Citas recurrentes (Booking Service)
