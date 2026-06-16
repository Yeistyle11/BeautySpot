# BeautySpot SaaS - Historias de Usuario

## Convenciones

### Formato

```
COMO [rol]
QUIERO [accion]
PARA [beneficio/valor]
```

### Prioridades

- **P0**: Esencial para el MVP
- **P1**: Deseable para el MVP
- **P2**: Post-MVP

### Criterios de Aceptacion

Cada historia incluye criterios de aceptacion enumerados con condiciones verificables.

---

## 1. Rol: SUPER_ADMIN

### US-SA-001: Gestionar plataforma global

**Como** SUPER_ADMIN
**Quiero** ver un dashboard global con todas las metricas de la plataforma
**Para** tener visibilidad completa del estado del negocio SaaS

**Prioridad**: P1

**Criterios de Aceptacion**:
1. El dashboard muestra el numero total de negocios activos, inactivos y nuevos del mes
2. Se muestra el total de citas agendadas en la plataforma (hoy, esta semana, este mes)
3. Se muestra el total de usuarios registrados por rol (owners, profesionales, clientes)
4. Los datos se actualizan automaticamente cada 5 minutos o al refrescar la pagina
5. El dashboard solo es accesible por usuarios con rol SUPER_ADMIN

**Reglas de Negocio**:
- Los datos son de solo lectura; el SUPER_ADMIN no puede modificar citas ni pagos
- Las metricas se calculan a partir de datos agregados en el servicio de Analytics
- Los datos de negocios desactivados no se incluyen en contadores de activos pero si en totales historicos

**Casos Limite**:
- Plataforma sin negocios registrados: mostrar ceros con mensaje de bienvenida
- Falla del servicio de Analytics: mostrar datos en cache con indicador de "datos al momento: [fecha]"
- Super admin con sesion expirada: redirigir al login

---

### US-SA-002: Gestionar planes y suscripciones

**Como** SUPER_ADMIN
**Quiero** crear, editar y desactivar planes de suscripcion
**Para** controlar las opciones disponibles para los negocios que se registran

**Prioridad**: P2

**Criterios de Aceptacion**:
1. Puedo crear un nuevo plan con nombre, descripcion, precio mensual, limite de profesionales, limite de sucursales y funcionalidades incluidas
2. Puedo editar los datos de un plan existente (los cambios no afectan suscripciones activas)
3. Puedo desactivar un plan (no se ofrece a nuevos negocios, los existentes conservan su plan)
4. Puedo ver la lista de negocios suscritos a cada plan
5. No puedo eliminar un plan que tiene negocios activos suscritos

**Reglas de Negocio**:
- Siempre debe existir al menos un plan activo
- Los cambios de precio solo aplican a nuevas suscripciones
- El plan "Gratis" (freemium) no puede ser desactivado

**Casos Limite**:
- Intentar eliminar plan con suscriptores activos: mostrar error con lista de negocios afectados
- Unico plan activo existente: impedir desactivacion
- Precio del plan en cero: permitido para plan freemium

---

### US-SA-003: Gestionar negocios de la plataforma

**Como** SUPER_ADMIN
**Quiero** ver, buscar y administrar todos los negocios registrados en la plataforma
**Para** poder dar soporte, suspender o reactivar negocios segun sea necesario

**Prioridad**: P1

**Criterios de Aceptacion**:
1. Puedo ver un listado paginado de todos los negocios con nombre, slug, plan, estado y fecha de registro
2. Puedo buscar negocios por nombre, slug o email del owner
3. Puedo filtrar por estado (activo, inactivo, suspendido) y por plan
4. Puedo ver el detalle de un negocio con sus metricas, profesionales y citas recientes
5. Puedo suspender un negocio (impide acceso al owner y su equipo, pero no elimina datos)
6. Puedo reactivar un negocio suspendido

**Reglas de Negocio**:
- La suspension es inmediata y revoca todas las sesiones activas del equipo del negocio
- Los datos del negocio suspendido se conservan por 90 dias
- El SUPER_ADMIN no puede modificar los datos internos del negocio (servicios, citas, etc.)
- Toda accion de suspension/reactivacion se registra en el log de auditoria

**Casos Limite**:
- Suspender negocio con citas futuras: mostrar advertencia con cantidad de citas afectadas, pero permitir la accion
- Negocio ya suspendido: el boton de suspension debe estar deshabilitado
- Reactivar negocio con datos incompletos: permitir reactivacion, mostrar alerta de perfil incompleto al owner

---

### US-SA-004: Ver metricas globales de la plataforma

**Como** SUPER_ADMIN
**Quiero** acceder a reportes globales de la plataforma con graficos y tendencias
**Para** entender el crecimiento, uso y salud del negocio SaaS

**Prioridad**: P2

**Criterios de Aceptacion**:
1. Puedo ver graficos de crecimiento de negocios (nuevos registros por mes)
2. Puedo ver graficos de uso (citas totales por mes, ingresos totales de la plataforma)
3. Puedo ver el top de negocios por volumen de citas y por ingresos
4. Puedo filtrar los reportes por rango de fechas
5. Puedo exportar los datos en formato CSV

**Reglas de Negocio**:
- Los datos de ingresos son calculados a partir de los pagos registrados en la plataforma
- Las metricas de crecimiento comparan con el periodo anterior
- Los reportes se calculan en base a datos anonimizados y agregados

**Casos Limite**:
- Plataforma nueva sin datos historicos: mostrar graficos vacios con mensaje "Datos insuficientes"
- Rango de fechas muy amplio (mas de 2 anos): mostrar advertencia de posible lentitud
- Exportacion de CSV con muchos datos: generar asincronamente y notificar cuando este listo

---

---

## 2. Rol: OWNER

### US-OW-001: Registrar mi negocio (Onboarding)

**Como** OWNER
**Quiero** registrar mi negocio en la plataforma a traves de un proceso guiado
**Para** comenzar a usar BeautySpot para gestionar mi barberia/salon/spa

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo registrarme con mi email y contrasena (o Google OAuth)
2. Despues del registro, se inicia un wizard de onboarding de 4 pasos: datos del negocio, tipo de negocio, direccion, horarios
3. El sistema genera automaticamente un slug unico basado en el nombre del negocio (editable)
4. Al completar el wizard, se crea el negocio con estado activo y se genera el perfil publico
5. Recibo un email de bienvenida con enlaces utiles (perfil publico, primer paso sugerido)

**Reglas de Negocio**:
- El email debe ser unico en la plataforma (no se pueden registrar dos owners con el mismo email)
- La contrasena debe cumplir: minimo 8 caracteres, 1 mayuscula, 1 numero, 1 caracter especial
- El slug debe ser unico en la plataforma; si existe, se agrega un sufijo numerico
- El tipo de negocio determina las categorias de servicios sugeridas por defecto
- El onboarding se puede retomar si se abandona a medias (se guarda el progreso)

**Casos Limite**:
- Email ya registrado: mostrar error con opcion de iniciar sesion o recuperar contrasena
- Nombre de negocio con caracteres especiales: sanitizar el slug (solo letras, numeros, guiones)
- Abandonar el wizard a medias: guardar progreso, redirigir al completar al volver a login
- Navegador cierra inesperadamente durante wizard: progreso recuperable al volver a iniciar sesion

---

### US-OW-002: Configurar datos de mi negocio

**Como** OWNER
**Quiero** editar los datos de mi negocio (nombre, logo, horarios, telefono, etc.)
**Para** mantener la informacion actualizada y atractiva para los clientes

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo editar nombre, descripcion, telefono, email, direccion y logo del negocio
2. Puedo configurar los horarios de operacion por dia de la semana (hora apertura, hora cierre, cerrado)
3. Puedo cambiar la zona horaria del negocio
4. Puedo configurar el intervalo de citas (15, 30, 45, 60 minutos)
5. Los cambios se reflejan inmediatamente en el perfil publico del negocio

**Reglas de Negocio**:
- El nombre del negocio no puede exceder 100 caracteres
- La descripcion no puede exceder 1000 caracteres
- El logo debe ser una imagen (JPG, PNG, WebP) de maximo 2 MB
- Al cambiar el nombre, el slug no se actualiza automaticamente (debe cambiarse manualmente)
- Los cambios en horarios no afectan citas ya agendadas

**Casos Limite**:
- Subir logo con formato no soportado: mostrar error con formatos aceptados
- Establecer horario con hora de cierre anterior a hora de apertura: mostrar error de validacion
- Cambiar intervalo de citas cuando hay citas futuras con intervalo diferente: permitir, solo aplica a nuevas citas
- Negocio sin logo: mostrar placeholder con iniciales del nombre

---

### US-OW-003: Configurar mi equipo de trabajo

**Como** OWNER
**Quiero** invitar y gestionar profesionales, administradores y recepcionistas
**Para** que mi equipo pueda usar la plataforma con los permisos adecuados

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo registrar un nuevo profesional con nombre, especialidades y foto
2. Puedo asignar servicios a cada profesional con precio y duracion personalizados
3. Puedo invitar a un administrador enviandole un email con enlace de registro
4. Puedo registrar recepcionistas y asignarlos a una sucursal
5. Puedo desactivar miembros del equipo (no se eliminan, solo pierden acceso)
6. Puedo ver el listado completo del equipo con su rol, estado y actividad reciente

**Reglas de Negocio**:
- Solo el OWNER puede crear ADMIN y RECESSIONIST
- Un negocio puede tener maximo 1 OWNER
- El OWNER puede asignar rol ADMIN a cualquier miembro del equipo
- Al desactivar un profesional con citas futuras, se muestra advertencia y se sugiere reasignar
- Las invitaciones expiran despues de 7 dias

**Casos Limite**:
- Invitar a un email ya registrado en la plataforma: vincular la cuenta existente al negocio con el rol asignado
- Desactivar al unico OWNER: impedir la accion, mostrar error
- Profesional sin servicios asignados: permitir, pero no aparece en la agenda de citas hasta tener al menos un servicio
- Invitacion expirada: permitir reenviar la invitacion

---

### US-OW-004: Ver analitica de mi negocio

**Como** OWNER
**Quiero** acceder a un dashboard con metricas clave de mi negocio
**Para** entender el rendimiento y tomar decisiones informadas

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo ver en el dashboard: citas de hoy, ingresos del dia, citas pendientes, clientes nuevos del mes
2. Puedo ver un grafico de citas por dia/semana/mes con tendencia
3. Puedo ver un grafico de ingresos por dia/semana/mes
4. Puedo ver el ranking de servicios mas solicitados
5. Puedo ver el ranking de profesionales por citas y facturacion
6. Puedo ver la tasa de no-show y cancelaciones del periodo

**Reglas de Negocio**:
- Los datos se calculan en la zona horaria del negocio
- Los ingresos incluyen todos los pagos registrados (efectivo, transferencia, tarjeta)
- El ranking de profesionales solo incluye profesionales activos
- Las metricas son actualizadas en tiempo real para el dia actual, y diariamente para periodos historicos

**Casos Limite**:
- Negocio nuevo sin datos: mostrar dashboard con ceros y mensaje "Aun no hay datos suficientes"
- Dia actual sin citas: mostrar ceros en KPIs de hoy
- Profesional desactivado que tenia historial: incluir en metricas historicas, no en rankings actuales

---

### US-OW-005: Gestionar sucursales

**Como** OWNER
**Quiero** crear y gestionar sucursales de mi negocio
**Para** operar en multiples ubicaciones desde una sola cuenta

**Prioridad**: P1

**Criterios de Aceptacion**:
1. Puedo crear una nueva sucursal con nombre, direccion y telefono
2. Puedo configurar horarios de operacion independientes para cada sucursal
3. Puedo asignar profesionales a una sucursal especifica
4. Puedo asignar recepcionistas a una sucursal especifica
5. Puedo desactivar sucursales (no se eliminan)
6. Puedo ver metricas comparativas entre sucursales

**Reglas de Negocio**:
- Un negocio puede tener maximo 10 sucursales activas
- Al crear la primera sucursal, los profesionales y servicios existentes se asignan automaticamente
- Desactivar una sucursal con citas futuras muestra advertencia
- Los profesionales pueden estar asignados a multiples sucursales

**Casos Limite**:
- Crear mas de 10 sucursales: mostrar error indicando el limite
- Desactivar unica sucursal: impedir la accion, debe haber al menos una activa
- Profesional asignado a sucursal desactivada: mantener asignacion, pero no puede recibir citas en esa sucursal

---

---

## 3. Rol: ADMIN

### US-AD-001: Gestionar citas del negocio

**Como** ADMIN
**Quiero** crear, editar y cancelar citas para cualquier profesional del negocio
**Para** gestionar la agenda completa del negocio

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo crear una cita seleccionando cliente, profesional, servicio(s), fecha y hora
2. Puedo ver la disponibilidad del profesional en tiempo real al seleccionar fecha
3. Puedo confirmar, cancelar, reagendar y marcar como completada cualquier cita
4. Puedo ver la vista de calendario (diaria, semanal, mensual) con todas las citas del negocio
5. Puedo ver la vista de lista con filtros (fecha, estado, profesional, cliente)

**Reglas de Negocio**:
- El ADMIN puede gestionar citas de todos los profesionales del negocio
- No se pueden crear citas en horarios no disponibles o con solapamiento
- La cancelacion no tiene restriccion de tiempo para el ADMIN (a diferencia del cliente)
- Al crear una cita, el estado inicial es PENDING (si la crea el cliente) o CONFIRMED (si la crea el ADMIN)
- Los cambios de estado generan notificaciones automaticas al profesional y/o cliente

**Casos Limite**:
- Crear cita en horario ya ocupado: mostrar error indicando conflicto con la cita existente
- Crear cita para profesional desactivado: impedir, solo mostrar profesionales activos
- Crear cita fuera de horario de operacion del negocio: advertir, pero permitir (flexibilidad para citas especiales)
- Cancelar cita ya cancelada: mostrar estado actual, boton de cancelar deshabilitado

---

### US-AD-002: Gestionar servicios del catalogo

**Como** ADMIN
**Quiero** crear, editar y desactivar servicios del catalogo del negocio
**Para** mantener el catalogo actualizado con los servicios que ofrecemos

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo crear un nuevo servicio con nombre, descripcion, categoria, precio base y duracion
2. Puedo editar los datos de un servicio existente
3. Puedo desactivar un servicio (no aparece en nuevas citas, pero se mantiene en historial)
4. Puedo asignar servicios a profesionales con precio y duracion personalizados
5. Puedo ver el listado de servicios agrupados por categoria

**Reglas de Negocio**:
- El nombre del servicio debe ser unico dentro del negocio
- El precio debe ser mayor a 0
- La duracion debe ser en minutos y multiplo del intervalo configurado del negocio
- Un servicio desactivado no aparece en el marketplace ni en la creacion de nuevas citas
- Las ediciones de precio no afectan citas ya creadas

**Casos Limite**:
- Desactivar servicio con citas futuras: permitir, las citas existentes mantienen el servicio
- Precio en cero: impedir con validacion
- Duracion que no es multiplo del intervalo: redondear al multiplo mas cercano o mostrar error
- Crear servicio con nombre duplicado: mostrar error de nombre ya existente

---

### US-AD-003: Gestionar clientes del negocio

**Como** ADMIN
**Quiero** registrar, buscar y actualizar datos de clientes
**Para** mantener un directorio actualizado de los clientes del negocio

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo registrar un nuevo cliente con nombre, telefono, email y notas
2. Puedo buscar clientes por nombre, telefono o email
3. Puedo editar los datos de un cliente existente
4. Puedo ver el historial de citas y pagos de un cliente
5. Puedo agregar notas internas sobre el cliente (no visibles para el)

**Reglas de Negocio**:
- El email es opcional pero, si se proporciona, debe ser unico dentro del negocio
- El telefono es obligatorio para registro manual
- Las notas internas son visibles solo para el equipo del negocio
- Si el email del cliente coincide con un usuario registrado, se sugiere la vinculacion automatica
- Los datos del cliente son privados del negocio (no compartidos entre negocios)

**Casos Limite**:
- Registrar cliente con email ya existente en el negocio: mostrar error de duplicado
- Registrar cliente sin telefono: impedir, el telefono es obligatorio
- Buscar cliente con termino parcial: buscar por coincidencia parcial en nombre, telefono y email
- Cliente sin historial de citas: mostrar perfil con seccion de historial vacia y mensaje

---

### US-AD-004: Registrar pagos manualmente

**Como** ADMIN
**Quiero** registrar los pagos que reciben los clientes
**Para** mantener un registro actualizado de los ingresos del negocio

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo registrar un pago asociado a una cita seleccionando el metodo (efectivo, transferencia, tarjeta)
2. El sistema calcula automaticamente el total basado en los servicios de la cita
3. Puedo registrar pagos parciales (monto menor al total)
4. Puedo agregar propina al pago
5. Puedo ver el historial de pagos de la cita

**Reglas de Negocio**:
- Solo se pueden registrar pagos en citas con estado CONFIRMED o COMPLETED
- Un pago no puede exceder el saldo pendiente de la cita
- Los pagos son inmutables una vez registrados (no se editan, se crean notas de credito si hay error)
- El metodo de pago es obligatorio
- El registro genera un evento para actualizacion de metricas

**Casos Limite**:
- Registrar pago mayor al total pendiente: mostrar error con monto maximo permitido
- Registrar pago en cita CANCELLED o NO_SHOW: impedir, mostrar mensaje de estado invalido
- Registrar segundo pago para completar saldo pendiente: permitir, mostrar total y pendiente actualizado
- Registrar pago con monto cero o negativo: impedir con validacion

---

### US-AD-005: Gestionar caja (apertura y cierre)

**Como** ADMIN
**Quiero** abrir y cerrar la caja diaria con registro de ingresos y egresos
**Para** controlar el flujo de efectivo del negocio

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo abrir la caja ingresando el monto inicial en efectivo
2. Los pagos registrados en efectivo se agregan automaticamente como ingresos de la caja
3. Puedo registrar egresos manuales (compras, gastos) con descripcion y monto
4. Al cerrar la caja, veo el resumen: monto inicial + ingresos - egresos = monto esperado
5. Debo ingresar el monto final real y el sistema calcula la diferencia (sobrante/faltante)

**Reglas de Negocio**:
- Solo puede haber una caja abierta por sucursal a la vez
- El cierre de caja es irreversible una vez confirmado
- Los egresos requieren una descripcion obligatoria
- La diferencia se registra y es visible en reportes
- Solo ADMIN y OWNER pueden cerrar la caja

**Casos Limite**:
- Intentar abrir caja cuando ya hay una abierta: mostrar error indicando quien la tiene abierta
- Cerrar caja sin registrar el monto final real: impedir, campo obligatorio
- Registrar egreso mayor al monto disponible: permitir (puede haber fondo de caja superior)
- Diferencia significativa entre esperado y real (mas del 10%): mostrar advertencia destacada

---

---

## 4. Rol: PROFESSIONAL

### US-PR-001: Ver mi agenda de citas

**Como** PROFESSIONAL
**Quiero** ver mi agenda de citas en formato calendario y lista
**Para** saber que citas tengo programadas y cuando

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo ver mi agenda en formato calendario (vista diaria y semanal)
2. Puedo ver la lista de citas del dia con hora, cliente, servicios y estado
3. Puedo ver los detalles de cada cita (cliente, servicios, notas, duracion)
4. Puedo filtrar mis citas por fecha y estado
5. Las citas se actualizan en tiempo real cuando el recepcionista agenda una nueva

**Reglas de Negocio**:
- El profesional solo ve sus propias citas, no las de otros profesionales
- La agenda se muestra en la zona horaria del negocio
- Las citas pasadas se muestran en gris o en seccion separada
- Las citas de hoy se destacan visualmente

**Casos Limite**:
- Dia sin citas: mostrar mensaje "Sin citas programadas" con espacio para informacion util
- Profesional recien registrado sin citas historicas: agenda vacia con mensaje de bienvenida
- Cita creada mientras el profesional esta viendo la agenda: actualizar automaticamente via WebSocket/SSE

---

### US-PR-002: Gestionar mi disponibilidad

**Como** PROFESSIONAL
**Quiero** configurar mis horarios de disponibilidad y dias libres
**Para** controlar cuando puedo recibir citas

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo configurar mi horario regular para cada dia de la semana (hora inicio, hora fin, no disponible)
2. Puedo registrar dias libres (vacaciones, ausencias) con fecha inicio y fecha fin
3. Puedo bloquear slots especificos de un dia
4. Puedo ver mi disponibilidad en formato semanal/mensual
5. Los cambios en disponibilidad se reflejan inmediatamente para nuevas reservas

**Reglas de Negocio**:
- La disponibilidad no puede exceder los horarios de operacion del negocio
- Los slots que ya tienen citas agendadas no se pueden bloquear
- Los cambios no afectan citas ya confirmadas
- Si no se configura disponibilidad, el profesional no aparece disponible para reservas

**Casos Limite**:
- Bloquear slot con cita existente: impedir y mostrar la cita existente
- Configurar disponibilidad fuera del horario del negocio: advertir y truncar al horario permitido
- Registrar dia libre que incluye citas futuras: mostrar advertencia con las citas afectadas
- Profesional sin disponibilidad configurada: mostrar banner sugiriendo configuracion

---

### US-PR-003: Confirmar y completar citas

**Como** PROFESSIONAL
**Quiero** confirmar y marcar como completadas las citas de mi agenda
**Para** mantener el estado de las citas actualizado

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo confirmar una cita en estado PENDING
2. Puedo marcar una cita como COMPLETED despues de realizar el servicio
3. Puedo marcar una cita como NO_SHOW si el cliente no asiste
4. La accion genera una notificacion automatica al cliente
5. Puedo agregar notas a la cita al completarla

**Reglas de Negocio**:
- Solo puedo gestionar mis propias citas
- Solo puedo cambiar el estado segun el flujo valido: PENDING -> CONFIRMED -> COMPLETED o NO_SHOW
- Una cita completada o con no-show no puede cambiar de estado
- La marca de no-show registra la hora y el profesional que la marco
- Las notas del profesional son visibles para el equipo del negocio, no para el cliente

**Casos Limite**:
- Intentar confirmar cita ya confirmada: boton deshabilitado, mostrar estado actual
- Intentar completar cita en estado PENDING (sin confirmar): permitir flujo directo PENDING -> COMPLETED
- Marcar no-show de cita pasada: permitir si la cita era de hoy o antes
- Completar cita cuyos servicios no se realizaron: no hay validacion adicional, el profesional es responsable

---

### US-PR-004: Ver mis metricas de desempeno

**Como** PROFESSIONAL
**Quiero** ver mis metricas personales (citas, facturacion, calificacion)
**Para** entender mi desempeno y mejorar

**Prioridad**: P2

**Criterios de Aceptacion**:
1. Puedo ver mi total de citas del mes y compararlo con el mes anterior
2. Puedo ver mi facturacion total del mes
3. Puedo ver mi calificacion promedio basada en resenas
4. Puedo ver mi tasa de no-show y cancelaciones
5. Puedo ver los servicios que mas realizo

**Reglas de Negocio**:
- Las metricas son de solo lectura
- Solo se muestran metricas del propio profesional
- La calificacion promedio se calcula sobre las ultimas 50 resenas
- Los datos se actualizan diariamente para metricas historicas

**Casos Limite**:
- Profesional sin resenas: mostrar calificacion como "Sin calificaciones aun"
- Mes sin citas: mostrar ceros con comparativo
- Profesional nuevo sin historial: mostrar dashboard basico con mensaje de bienvenida

---

---

## 5. Rol: RECEPTIONIST

### US-RE-001: Agendar citas para clientes

**Como** RECEPTIONIST
**Quiero** crear citas para los clientes que llaman o llegan al negocio
**Para** agendarlas rapidamente en el sistema

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo crear una cita seleccionando o buscando un cliente existente, o creando uno nuevo en el momento
2. Puedo seleccionar el profesional, servicio(s), fecha y hora
3. El sistema me muestra los slots disponibles del profesional en la fecha seleccionada
4. Puedo confirmar la cita inmediatamente (estado CONFIRMED por defecto al crearla el recepcionista)
5. Recibo confirmacion visual de la cita creada con todos los detalles

**Reglas de Negocio**:
- La cita creada por el recepcionista se crea en estado CONFIRMED directamente
- El recepcionista solo puede agendar citas en su sucursal asignada
- La disponibilidad mostrada considera citas existentes, bloqueos y horarios del profesional
- Se puede buscar un cliente por nombre o telefono, o crear uno nuevo si no existe
- El cliente puede no tener email (campo opcional para registro rapido)

**Casos Limite**:
- Cliente que llama por telefono sin datos completos: permitir crear cita con nombre y telefono como minimo
- No hay slots disponibles en la fecha deseada: sugerir fechas alternativas cercanas
- Profesional sin disponibilidad en la fecha: mostrar mensaje y sugerir otro profesional
- Crear cita para el mismo horario que se esta creando otra (concurrencia): manejar con optimistic locking

---

### US-RE-002: Gestionar citas del dia

**Como** RECEPTIONIST
**Quiero** ver y gestionar todas las citas del dia en mi sucursal
**Para** coordinar el flujo de clientes y profesionales

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo ver la lista de citas del dia de mi sucursal, ordenadas por hora
2. Puedo ver el estado de cada cita con indicador visual (pendiente, confirmada, completada, etc.)
3. Puedo cancelar o reagendar una cita con motivo de cancelacion
4. Puedo ver los detalles completos de la cita al hacer clic
5. Puedo filtrar las citas por profesional

**Reglas de Negocio**:
- El recepcionista solo ve citas de su sucursal asignada
- La cancelacion por recepcionista no tiene restriccion de tiempo
- El reagendamiento requiere seleccionar una nueva fecha/hora disponible
- Los cambios de estado generan notificaciones automaticas

**Casos Limite**:
- Dia sin citas: mostrar mensaje con indicacion para crear nuevas citas
- Multiples citas al mismo horario en diferentes profesionales: mostrar correctamente separadas por profesional
- Cancelar cita que ya inicio (hora actual despues de hora de inicio): permitir, marcar como cancelada

---

### US-RE-003: Registrar pagos de citas

**Como** RECEPTIONIST
**Quiero** registrar los pagos que realizan los clientes al finalizar su cita
**Para** mantener el registro de ingresos actualizado

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo buscar una cita completada y registrar el pago
2. El sistema muestra el total calculado automaticamente
3. Puedo seleccionar el metodo de pago (efectivo, transferencia, tarjeta)
4. Puedo registrar el monto recibido y el sistema calcula el cambio (para efectivo)
5. Puedo agregar una propina al pago

**Reglas de Negocio**:
- Solo se pueden registrar pagos en citas con estado CONFIRMED o COMPLETED
- El monto del pago no puede exceder el saldo pendiente
- Los pagos son inmutables; si hay error, se debe crear un registro de nota de credito
- El pago en efectivo alimenta automaticamente la caja si esta abierta
- El recepcionista solo registra pagos en su sucursal

**Casos Limite**:
- Pago en efectivo donde el cliente paga mas del total: calcular y mostrar el cambio a devolver
- Intentar registrar pago en cita ya pagada: mostrar estado de pago y monto total ya registrado
- Caja cerrada al registrar pago en efectivo: permitir el pago, pero advertir que la caja esta cerrada
- Registrar pago en cita que aun no se completa: permitir (pago adelantado)

---

### US-RE-004: Registrar nuevos clientes rapidamente

**Como** RECEPTIONIST
**Quiero** registrar nuevos clientes de forma rapida durante la llamada o visita
**Para** no hacer esperar al cliente y agilizar el proceso de reserva

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo registrar un cliente con solo nombre y telefono (campos minimos)
2. Puedo agregar email y notas adicionales despues (opcionales)
3. El sistema detecta automaticamente si el cliente ya existe por telefono o email
4. Despues de registrar el cliente, puedo pasar directamente a agendar una cita
5. El cliente queda vinculado al negocio permanentemente

**Reglas de Negocio**:
- Nombre y telefono son campos obligatorios para registro rapido
- El telefono debe ser unico dentro del negocio
- Si se detecta un cliente existente con el mismo telefono, se sugiere usar el existente
- El registro rapido es un formulario simplificado, no el formulario completo del perfil

**Casos Limite**:
- Telefono ya registrado: mostrar datos del cliente existente y sugerir usar ese perfil
- Nombre muy corto (1 caracter): permitir (nombres cortos son validos)
- Telefono con formato no estandar: sanitizar automaticamente (solo digitos, prefijo pais)
- Registrar cliente sin cita: permitir, el cliente queda en el directorio

---

### US-RE-005: Abrir y cerrar caja

**Como** RECEPTIONIST
**Quiero** abrir la caja al inicio del dia y cerrarla al final con el recuento
**Para** mantener el control de efectivo de la sucursal

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo abrir la caja al inicio del dia ingresando el monto inicial en efectivo
2. Durante el dia veo un resumen en vivo de ingresos (por pagos en efectivo) y egresos registrados
3. Puedo registrar egresos con descripcion y monto
4. Al cerrar la caja, ingreso el monto final real y el sistema muestra la diferencia
5. Recibo un resumen del dia: monto inicial, ingresos, egresos, monto esperado, monto real, diferencia

**Reglas de Negocio**:
- Solo puede haber una caja abierta por sucursal
- El cierre es definitivo y no se puede reabrir la caja del dia
- La diferencia se registra y es visible en reportes
- El recepcionista puede abrir la caja; solo ADMIN/OWNER pueden cerrarla (o recepcionista con permiso)

**Casos Limite**:
- Intentar abrir caja cuando ya esta abierta: mostrar quien la abrio y a que hora
- Cerrar caja sin haber registrado pagos: permitir, los totales seran cero
- Monto final real muy diferente al esperado: mostrar advertencia pero permitir cierre
- Olvidar cerrar la caja del dia anterior: permitir cerrar con fecha/hora del cierre real

---

---

## 6. Rol: CLIENT

### US-CL-001: Buscar negocios y servicios

**Como** CLIENT
**Quiero** buscar negocios de belleza y barberia en el marketplace
**Para** descubrir opciones y encontrar el servicio que necesito

**Prioridad**: P1

**Criterios de Aceptacion**:
1. Puedo buscar negocios por nombre desde la pagina principal del marketplace
2. Puedo filtrar por tipo de negocio (barberia, salon, spa, centro estetico)
3. Puedo filtrar por categoria de servicio
4. Puedo ver los resultados ordenados por relevancia o calificacion
5. Cada resultado muestra nombre, tipo, calificacion, precio desde y enlace al perfil

**Reglas de Negocio**:
- Solo se muestran negocios activos con al menos un servicio y un profesional
- Los resultados se paganan de a 12 por pagina
- La busqueda no requiere autenticacion (marketplace publico)
- Los filtros son acumulativos (AND logico)

**Casos Limite**:
- Busqueda sin resultados: mostrar mensaje con sugerencias de busqueda alternativa
- Marketplace sin negocios: mostrar mensaje y sugerencias de categorias populares
- Busqueda con termino muy corto (1-2 caracteres): buscar de todos modos
- Muchos resultados (mas de 100): paginar correctamente y mostrar total

---

### US-CL-002: Reservar una cita

**Como** CLIENT
**Quiero** reservar una cita en un negocio seleccionando servicio, profesional y horario
**Para** asegurar mi turno sin tener que llamar por telefono

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Desde el perfil del negocio, puedo seleccionar uno o mas servicios
2. Puedo elegir un profesional (o "cualquier profesional" para mas disponibilidad)
3. Puedo seleccionar una fecha y ver los slots disponibles
4. Puedo seleccionar un horario disponible y confirmar la reserva
5. Recibo una confirmacion de la cita con los detalles completos

**Reglas de Negocio**:
- Debo estar registrado e iniciado sesion para reservar
- La cita se crea en estado PENDING hasta que el negocio la confirme
- La disponibilidad mostrada es en tiempo real (o cache de maximo 1 minuto)
- Solo se muestran slots con suficiente tiempo para la duracion total de los servicios
- El precio mostrado es el precio personalizado del profesional seleccionado (si aplica)
- La reserva debe ser para al menos 2 horas en el futuro

**Casos Limite**:
- Intentar reservar sin iniciar sesion: redirigir al login y volver al flujo de reserva
- Slots disponibles que desaparecen al confirmar (concurrencia): mostrar error y sugerir nuevo slot
- Profesional seleccionado que ya no esta disponible: mostrar mensaje y sugerir alternativas
- Reservar multiples servicios que exceden el horario de operacion: impedir y mostrar advertencia
- Intentar reservar en el pasado: impedir, solo mostrar fechas futuras

---

### US-CL-003: Cancelar o reagendar mi cita

**Como** CLIENT
**Quiero** cancelar o reagendar una cita que ya reserve
**Para** ajustar mis planes cuando no puedo asistir

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo ver mis citas futuras y seleccionar una para cancelar o reagendar
2. Al cancelar, debo indicar un motivo (opcional)
3. Al reagendar, puedo seleccionar una nueva fecha y hora disponible
4. Recibo confirmacion de la cancelacion o reagendamiento
5. El negocio recibe una notificacion automatica del cambio

**Reglas de Negocio**:
- La cancelacion requiere un minimo de X horas de anticipacion (configurado por el negocio, por defecto 2h)
- Si falta menos del tiempo minimo, la cancelacion no esta permitida (mostrar contacto del negocio)
- El reagendamiento esta sujeto a las mismas reglas de disponibilidad que una reserva nueva
- Solo se pueden cancelar/reagendar citas en estado PENDING o CONFIRMED
- No hay limite de cancelaciones, pero el negocio puede ver el historial

**Casos Limite**:
- Intentar cancelar dentro del tiempo minimo: mostrar mensaje indicando que debe contactar al negocio directamente
- Cancelar cita ya cancelada: impedir, mostrar estado actual
- Reagendar a una fecha pasada: impedir, solo fechas futuras
- No hay slots disponibles para reagendar: mostrar mensaje y sugerir fechas alternativas
- Cancelar cita ya completada: impedir, mostrar estado COMPLETED

---

### US-CL-004: Dejar una resena

**Como** CLIENT
**Quiero** dejar una resena y calificacion despues de mi cita
**Para** compartir mi experiencia y ayudar a otros clientes a decidir

**Prioridad**: P1

**Criterios de Aceptacion**:
1. Despues de una cita completada, puedo dejar una calificacion de 1 a 5 estrellas
2. Puedo agregar un comentario de texto opcional (maximo 500 caracteres)
3. Puedo calificar tanto el negocio general como el profesional individual
4. La resena aparece en el perfil publico del negocio y del profesional
5. Recibo un recordatorio 24 horas despues de la cita si no he dejado resena

**Reglas de Negocio**:
- Solo se puede dejar una resena por cita completada
- La resena solo se puede dejar despues de que la cita sea marcada como COMPLETED
- El comentario no puede contener lenguaje ofensivo (filtro basico)
- La resena puede ser moderada por el negocio (configuracion por negocio)
- Las resenas son publicas y visibles sin autenticacion

**Casos Limite**:
- Intentar dejar segunda resena para la misma cita: impedir, mostrar "Ya dejaste una resena"
- Dejar resena en cita no completada (CANCELLED, NO_SHOW): impedir
- Comentario vacio: permitir (la calificacion con estrellas es suficiente)
- Calificacion fuera de rango (0 o 6): impedir, solo valores 1-5
- Cita completada hace mas de 30 dias: permitir resena pero mostrar advertencia de que puede ser menos precisa

---

### US-CL-005: Ver mi historial de citas

**Como** CLIENT
**Quiero** ver mi historial completo de citas pasadas y futuras
**Para** tener un registro de mis visitas y planificar futuras reservas

**Prioridad**: P0

**Criterios de Aceptacion**:
1. Puedo ver una lista de todas mis citas (pasadas y futuras) ordenadas por fecha
2. Puedo filtrar por estado (pendiente, confirmada, completada, cancelada, no asistida)
3. Puedo filtrar por negocio
4. Cada cita muestra: negocio, profesional, servicio(s), fecha, hora, estado y precio
5. Puedo volver a reservar con los mismos datos desde una cita pasada

**Reglas de Negocio**:
- Las citas se muestran en orden cronologico inverso (mas recientes primero)
- Las citas futuras se muestran primero, luego las pasadas
- Solo se muestran las citas del cliente autenticado
- La opcion de "volver a reservar" abre el flujo de reserva con los datos pre-llenados

**Casos Limite**:
- Cliente sin citas: mostrar mensaje "Aun no tienes citas" con CTA para buscar negocios
- Muchas citas historicas (mas de 100): paginar correctamente
- Cita de negocio desactivado: mostrar datos de la cita, pero indicar que el negocio ya no esta activo
- Filtrar por negocio que ya no existe: incluir en lista de filtros si hay citas historicas

---

### US-CL-006: Ver y editar mi perfil

**Como** CLIENT
**Quiero** ver y editar mi perfil personal
**Para** mantener mis datos actualizados

**Prioridad**: P1

**Criterios de Aceptacion**:
1. Puedo ver mi perfil con nombre, email, telefono y foto
2. Puedo editar mi nombre y telefono
3. Puedo cambiar mi contrasena (requiere contrasena actual)
4. Puedo subir una foto de perfil
5. No puedo cambiar mi email (requiere verificacion, post-MVP)

**Reglas de Negocio**:
- El nombre es obligatorio
- El telefono es opcional pero recomendado
- La contrasena actual es obligatoria para cambiar a una nueva
- La nueva contrasena debe cumplir las reglas de complejidad
- La foto debe ser JPG/PNG/WebP, maximo 2 MB

**Casos Limite**:
- Contrasena actual incorrecta al cambiar: mostrar error "Contrasena actual incorrecta"
- Subir foto con formato no soportado: mostrar error con formatos aceptados
- Email duplicado (si se permite cambio): impedir, mostrar error
- Perfil sin foto: mostrar avatar con iniciales del nombre

---

## Matriz de Trazabilidad

### Resumen por Rol y Prioridad

| Rol | P0 | P1 | P2 | Total |
|-----|----|----|----|----|
| SUPER_ADMIN | 0 | 2 | 2 | 4 |
| OWNER | 4 | 1 | 0 | 5 |
| ADMIN | 5 | 0 | 0 | 5 |
| PROFESSIONAL | 3 | 0 | 1 | 4 |
| RECEPTIONIST | 5 | 0 | 0 | 5 |
| CLIENT | 3 | 2 | 0 | 5 |
| **Total** | **20** | **5** | **3** | **28** |

### Dependencia entre Historias

```
US-OW-001 (Onboarding)
  -> US-OW-002 (Configurar negocio)
  -> US-OW-003 (Gestionar equipo)
      -> US-PR-001 (Ver agenda)
      -> US-PR-002 (Gestionar disponibilidad)
      -> US-RE-001 (Agendar citas)

US-OW-004 (Dashboard) <- depende de datos de:
  -> US-AD-001 (Gestionar citas)
  -> US-AD-004 (Registrar pagos)

US-CL-002 (Reservar cita) <- depende de:
  -> US-PR-002 (Disponibilidad configurada)
  -> US-CL-001 (Buscar negocios)

US-CL-004 (Dejar resena) <- depende de:
  -> US-CL-002 (Reservar cita)
  -> US-PR-003 (Completar cita)
```
