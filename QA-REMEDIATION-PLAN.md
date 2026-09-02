# Plan de remediación — QA-REPORT-BeautySpot-2026-08-22

Rama de trabajo: `fix/tanda-22-next-16` (PR #99). Origen: `QA-REPORT-BeautySpot-2026-08-22.md`,
28 hallazgos (1 bloqueante, 5 altos, 15 medios, 7 bajos).

Estados: ⬜ pendiente · 🟨 en curso · ✅ corregido y verificado · 📋 propuesta `[PM]` (no se implementa) · ❓ necesita aclaración

## Decisiones tomadas

| Tema    | Decisión                                                                          |
| ------- | --------------------------------------------------------------------------------- |
| BS-001  | Implementar `PATCH /payments/:id` con traza y ajuste del movimiento de caja       |
| BS-025  | Los campos modificados primero; el 409 optimista después, en clientes y servicios |
| BS-020  | Normalizar a E.164 de aquí en adelante, **sin** migración de datos                |
| Rama    | Todo se acumula en `fix/tanda-22-next-16`; el PR lo abre el usuario               |
| Esquema | Aprobadas 3 columnas aditivas en `payments` para la traza de BS-001               |
| BS-012  | Los minutos de madrugada cuentan en el **día natural**, no en el de apertura      |
| BS-019  | Recepción pasa a poder **leer** el horario; escribirlo sigue en OWNER/ADMIN       |
| BS-023  | Columna `published_at`: «Recién llegados» mide la llegada al escaparate           |

## Agrupación por causa raíz

Los 28 hallazgos se reducen a 9 causas. Corregir la causa cierra todos sus hallazgos.

| Causa                                                                          | Hallazgos                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------- |
| G1 · Componente de servidor que ejecuta hooks de cliente                       | BS-022                                      |
| G2 · El cliente reenvía la entidad entera que recibió de la API                | BS-015, BS-025                              |
| G3 · El texto crudo del framework llega al usuario                             | toasts de BS-001 y BS-015                   |
| G4 · Las métricas se derivan de las filas presentes, no del rango ni del total | BS-009, BS-010                              |
| G5 · La regla de negocio vive solo en el cliente                               | BS-004, BS-016, BS-026                      |
| G6 · Los minutos de madrugada se atribuyen a dos días                          | BS-012 (denominador de BS-011)              |
| G7 · La vista Semana es un componente aislado con estado propio                | BS-017, BS-019                              |
| G8 · El escaparate ordena por el criterio equivocado                           | BS-023                                      |
| G9 · Tildes ausentes en textos de cara al usuario                              | BS-014, BS-023, BS-024(texto), deuda visual |

## Tablero

| ID     | Sev        | Módulo           | Causa raíz                                                                                   | Esfuerzo | Riesgo | Lote | Estado |
| ------ | ---------- | ---------------- | -------------------------------------------------------------------------------------------- | -------- | ------ | ---- | ------ |
| BS-022 | Bloqueante | Marketplace      | G1 · `business-profile.tsx` ejecuta 5 `useApiPublic` sin `"use client"` (lo quitó `62cde4f`) | XS       | Bajo   | 1    | ✅     |
| BS-015 | Alta       | Configuración    | G2 · el formulario siembra con la entidad y la reenvía; el DTO rechaza los campos de más     | S        | Bajo   | 2    | ✅     |
| BS-001 | Alta       | Pagos            | Ruta `PATCH /payments/:id` inexistente                                                       | M        | Medio  | 2    | ✅     |
| BS-009 | Alta       | Métricas         | G4 · numerador filtrado por `ventas > 0`, denominador sin filtrar                            | M        | Medio  | 3    | ✅     |
| BS-002 | Alta       | Pagos            | Falta pantalla; `POST /:id/refund` ya existe                                                 | M        | —      | 6    | ✅     |
| BS-003 | Alta       | Facturación      | Falta pantalla; backend completo con PDF                                                     | M        | —      | 6    | ✅     |
| BS-011 | Media      | Métricas         | `CapacidadWorker` no materializa hasta la primera hora                                       | S        | Bajo   | 3    | ✅     |
| BS-012 | Media      | Agenda           | G6 · el tramo que cruza medianoche se cuenta en dos días                                     | S        | Medio  | 3    | ✅     |
| BS-010 | Media      | Dashboard        | G4 · la serie se arma con las filas existentes                                               | XS       | Bajo   | 3    | ✅     |
| BS-020 | Media      | Clientes         | `normalizarTelefono` no reconcilia el prefijo internacional                                  | S        | Medio  | 4    | ✅     |
| BS-004 | Media      | Pagos            | G5 · `@Min(0)` admite el cobro de cero                                                       | XS       | Bajo   | 4    | ✅     |
| BS-026 | Media      | Clientes         | G5 · `name` sin `trim` ni `@IsNotEmpty`                                                      | XS       | Bajo   | 4    | ✅     |
| BS-016 | Media      | Agenda           | G5 · `markNoShow` no comprueba la fecha; `complete` sí                                       | XS       | Bajo   | 4    | ✅     |
| BS-025 | Media      | Transversal      | G2 · el formulario envía todos los campos                                                    | S        | Bajo   | 4    | ✅     |
| BS-024 | Media      | Marketplace      | Texto: promete un correo a quien no lo dejó (la regla es `[PM]`)                             | XS       | Bajo   | 4    | ✅     |
| BS-007 | Media      | Servicios        | Categoría del catálogo y campo libre `category` pintados igual                               | S        | Bajo   | 5    | ✅     |
| BS-017 | Media      | Agenda           | G7 · `CalendarView` no recibe bloqueos                                                       | S        | Bajo   | 5    | ✅     |
| BS-005 | Media      | Pagos            | Sin descuento, propina ni pago mixto                                                         | L        | —      | 6    | 📋     |
| BS-006 | Media      | Servicios/Equipo | El precio no varía por profesional                                                           | L        | —      | 6    | ✅     |
| BS-013 | Media      | Agenda           | No hay alta de walk-in retroactivo                                                           | M        | —      | 6    | ✅     |
| BS-021 | Media      | Clientes         | No hay fusión de fichas                                                                      | M        | —      | 6    | ✅     |
| BS-028 | Media      | Onboarding       | El tipo de negocio no siembra nada                                                           | S        | —      | 6    | ✅     |
| BS-008 | Baja       | Caja             | El KPI «Total esperado» queda visible tras el modal                                          | XS       | Bajo   | 5    | ✅     |
| BS-014 | Baja       | Métricas         | G9 · cabeceras del CSV sin tildes; variación vacía                                           | XS       | Bajo   | 5    | ✅     |
| BS-018 | Baja       | Agenda           | Las citas solapadas no reparten el ancho                                                     | S        | Bajo   | 5    | ✅     |
| BS-019 | Baja       | Agenda           | G7 · `CalendarView` tiene su propio `weekOffset`                                             | S        | Bajo   | 5    | ✅     |
| BS-023 | Baja       | Marketplace      | G8 · `findRecent` ordena por completitud; `findTopRated` no exige reseñas                    | S        | Bajo   | 5    | ✅     |
| BS-027 | Baja       | Accesibilidad    | Las tarjetas usan `focus-within` en vez de `focus-visible`                                   | XS       | Bajo   | 5    | ✅     |

---

## Lote 1 — Desbloquear el PR ✅

### BS-022 · La ficha pública del negocio no carga ✅

**Causa raíz.** `apps/frontend/src/app/marketplace/business/[slug]/business-profile.tsx`
llama cinco veces a `useApiPublic` (L57, L67, L72, L95, L103) y el commit `62cde4f`
le quitó la directiva `"use client"`, así que Next lo renderiza en el servidor y
falla al invocar un hook de cliente.

**Corrección.** Devolver `"use client"` a ese archivo. La intención del commit se
conserva igualmente: `page.tsx` ya resuelve el perfil en el servidor con
`fetchPublic` y lo pasa como `initialProfile`, que SWR usa de `fallbackData`, de
modo que la primera pintura y la metadata siguen siendo de servidor.

**Barrido de la regresión.** De los cinco archivos a los que `62cde4f` quitó la
directiva, las cuatro secciones (`location`, `services`, `story`, `team`) no usan
hooks y quedan correctamente como componentes de servidor.

**Archivos tocados**

- `apps/frontend/src/app/marketplace/business/[slug]/business-profile.tsx` — directiva restaurada.
- `apps/frontend/src/lib/use-crud-resource.ts` — misma causa, detectado por la prueba nueva (ver Hallazgos nuevos #1).
- `apps/frontend/src/__tests__/directiva-de-cliente.test.ts` — **nuevo**, guarda de la causa G1.
- `apps/frontend/src/app/marketplace/business/[slug]/__tests__/business-profile.test.tsx` — **nuevo**, renderiza la ficha publicada.

**Cómo verificarlo**

- `cd apps/frontend && npx jest directiva-de-cliente` — falla si un archivo con
  hooks pierde la directiva. Comprobado: revirtiendo BS-022 la prueba señala el
  archivo por su ruta.
- `cd apps/frontend && npx jest business-profile` — la ficha publicada pinta
  nombre, servicios, equipo y el acceso a reservar.
- Manual: `/marketplace/business/<slug>` muestra la ficha, no «No se pudo cargar esta sección».

> **Nota sobre el valor de cada prueba.** La prueba de render **no** habría
> detectado BS-022: Jest no aplica la frontera servidor/cliente, así que el
> componente roto se renderiza igual en jsdom. La que cubre el fallo es la guarda
> de la directiva, que mira el código fuente. La de render cubre lo otro que pedía
> el informe: que la ficha publicada se pinte de punta a punta.

**Suite:** 53 suites / 410 pruebas en verde (`npx jest` en `apps/frontend`).

---

## Lote 2 — Los tres fallos de contrato cliente-servidor ✅

### BS-015 · El horario del negocio se guarda una vez y nunca más ✅

**Causa raíz.** El formulario se sembraba con las entidades tal como llegan de la
API y las reenviaba enteras. `businessHourSchema` declara `id`, así que Zod lo
conserva al validar (los demás campos de la entidad sí los descarta), y el
`ValidationPipe` global tiene `forbidNonWhitelisted: true`: ese único campo de
más basta para un 400. Un negocio virgen guardaba bien la primera vez —no había
`id` todavía— y no volvía a poder cambiarlo nunca.

**Corrección.** La siembra pasa por `sembrarHorarios`, que copia solo los campos
del DTO, y el estado del formulario se tipa como `BusinessHourForm`
(`Omit<BusinessHour, "id">`), de modo que el compilador impide que el campo
vuelva a colarse. La regla queda fuera del componente y por tanto es probable.

**Archivos tocados:** `settings/schemas.ts` (`BusinessHourForm`, `sembrarHorarios`),
`settings/page.tsx`, `settings/hours-tab.tsx`,
`settings/__tests__/sembrar-horarios.test.ts` (**nuevo**).

**Cómo verificarlo:** `npx jest sembrar-horarios`. Comprobado que las dos pruebas
de forma fallan si la función devuelve la entidad guardada tal cual. Manual:
guardar horarios, recargar y **volver a guardar**.

### BS-025 · Dos ediciones a la vez ✅

**Causa raíz.** Misma que BS-015 vista del otro lado: la ficha de cliente enviaba
todos los campos, así que guardar desde una pestaña con datos viejos revertía en
silencio lo que otra persona acababa de guardar.

**Corrección, en dos pasos.** Primero la versión mínima: `openEdit` guarda la
ficha tal como se cargó y `cambiosDelCliente` compara para enviar solo lo
modificado; sin cambios no se llama al servidor. Eso acotó el choque al mismo
campo, donde la última escritura seguía ganando en silencio.

Después la detección de conflicto, que era el resto del hallazgo: el formulario
manda el `updatedAt` con el que cargó, `TenantCrudService.update` lo coteja con
la fila bloqueada dentro de una transacción y responde **409** si ya no coincide.
Alcance decidido: **la ficha de cliente y los servicios**, enteros —también el
guardado de la ficha configurable, que manda el objeto completo—; la
configuración del negocio, que edita una sola persona, se queda fuera a
propósito, igual que las categorías (`CatalogoTenantService` tiene su propio
`update`) y `PATCH /clients/me`.

Tres decisiones que no se ven en el diff:

- **La marca se compara en JavaScript, no en un `WHERE updated_at = …`.** La
  columna es `timestamptz` (microsegundos) y lo que viaja al navegador y vuelve
  llega en milisegundos: el `WHERE` daría 409 siempre en las filas con
  microsegundos. Los dos lados se comparan tras el mismo redondeo del driver.
- **El 409 lleva código propio** (`EDICION_SIMULTANEA`, en `shared-constants`
  porque lo escribe el backend y lo lee el navegador). El otro 409, el del
  contacto repetido, se resuelve corrigiendo el formulario; este, recargando.
- **El aviso va dentro del formulario, no en un toast.** El que se va solo deja
  a quien guardaba sin saber qué pasó con lo que escribió, y aquí hay algo que
  decidir: lo escrito sigue en pantalla hasta que se pulsa Recargar.

**Archivos tocados:** `nest-common/database/tenant-crud.service.ts` (+ spec),
`shared-constants/index.ts`, `core-service` clientes y servicios (controlador,
servicio y DTO de cada uno, + specs),
`core-service/src/test/edicion-simultanea.int-test.ts` (**nuevo**),
`lib/api-error.ts`, `lib/api.ts`, `components/ui/aviso-de-conflicto.tsx`
(**nuevo**), `clients/` y `services/` (schemas, página y diálogo de cada uno),
`clients/__tests__/aviso-de-edicion-simultanea.test.tsx` (**nuevo**) y las
pruebas de `lib` de las tres funciones tocadas.

**Cómo verificarlo:** `npm run test:int --workspace @beautyspot/core-service`
(`edicion-simultanea`) es el que demuestra lo de la precisión contra Postgres.
Manual: la misma ficha en dos pestañas, guardar el teléfono en una y el nombre
en la otra.

### BS-001 · «Editar pago» llamaba a una ruta que no existe ✅

**Causa raíz.** El frontend llamaba `PATCH /payment/payments/:id`, que el
controlador no expone.

**Corrección** (decidida: implementar la ruta). `PATCH /payments/:id` en
payment-service, con estas reglas:

- Solo un cobro `COMPLETED`.
- **Solo mientras la sesión de caja que recogió el cobro siga abierta.** Cerrada
  la caja el arqueo ya está firmado y reescribir el importe lo descuadraría hacia
  atrás sin que nadie lo note; el rechazo remite a la devolución.
- El movimiento de caja se ajusta en la misma transacción, con el bloqueo
  pesimista de la sesión que ya usaba el cobro. Si el método deja de ser efectivo
  el movimiento se borra (la sesión no está arqueada, así que no se falsea nada);
  si pasa a serlo, se registra la entrada.
- Traza en `edited_at` / `edited_by` / `edit_reason`, con el motivo obligatorio.

**Consecuencia que hubo que resolver, y conviene señalarla:** permitir cambiar el
importe sin avisar a nadie habría creado exactamente el descuadre que castiga
BS-009, porque analytics ya sumó el importe viejo a `daily_metrics`. Se añadió el
evento `payment.payment.corrected`, que lleva **la diferencia** y **el día del
cobro original** —no el día en que se corrige— y un consumidor en analytics que
ajusta los ingresos de ese día sin tocar el contador de ventas, porque la venta
es la misma.

**Esquema.** Migración `1700000000018-CorreccionDeCobros`, aditiva y con las tres
columnas anulables, más su declaración en la entidad (doble declaración, como
exige el repositorio).

**Archivos tocados:** `payments.controller.ts` (`UpdatePaymentDto`, `PATCH :id`),
`payments.service.ts` (`correctPayment`, `ajustarCajaDeLaCorreccion`),
`payment.entity.ts`, la migración, `packages/event-types/src/index.ts`,
`analytics-event-listeners.service.ts`, `payments.service.spec.ts`,
`dashboard/payments/{page,payment-dialogs,schemas}.tsx`, `docs/API.md`.

### BS-004 · Cobro de $0 como «Completado» ✅

**Aclaración que cambió el arreglo previsto.** El informe pedía `@IsPositive` en
el DTO, pero `amount` es lo que el cliente paga **después** del descuento por
puntos: un servicio cubierto entero con puntos es legítimamente cero. La regla es
cruzada, así que vive en el servicio: se rechaza el cero **salvo** si hay puntos
canjeados. En el formulario el mínimo es 1, y 0 solo cuando se canjean puntos.

### G3 · El aviso de error ya no vuelca el texto del framework ✅

Dos reglas nuevas en `mensajeDeError`, cada una con su porqué: un `message` con
forma de ruta de Nest (`Cannot PATCH /…`) se trata como opaco, y los detalles de
validación sin redactar (`… should not exist`) se descartan por ser un desajuste
de contrato y no algo que el usuario pueda corregir. Se añadió además
«Error de validación» a la lista de mensajes opacos: es el título que acompaña a
los detalles y por sí solo repite el código de estado. Los motivos que el backend
sí redacta en español siguen llegando intactos.

**Suite al cerrar el lote:** `npm run build` en verde (15/15, incluida la
compilación de producción del frontend) y `npm run test:coverage` **exit 0** —
183 suites, **2382 pruebas**, cobertura 92.28 sentencias / 93.5 líneas /
82.37 funciones / 81.09 ramas, por encima de los cuatro pisos.

---

## Lote 3 — Que las cifras no mientan ✅

Los cuatro se resumen en lo mismo: la métrica prefiere publicar un número
plausible antes que admitir que no lo tiene.

### BS-012 · La capacidad cuenta dos veces la madrugada ✅

**Decisión previa.** El informe admitía dos reglas —atribuir la madrugada al día
de apertura o al día natural— y proponía la primera. Se implementa la **segunda**,
porque es la que el resto del sistema ya aplica: `calcularFranjas`
(`availability-query.service.ts:536`) descarta los inicios pasada la medianoche y
los ofrece bajo el día siguiente, así que una cita de la jornada del viernes a las
00:30 se guarda con fecha **sábado** y `minutos_vendidos` —el numerador de la
ocupación— cae en sábado. Con la regla del día de apertura el denominador del
sábado dejaría fuera esa madrugada mientras el numerador la incluye, y la
ocupación podría pasar del 100 %.

**Causa raíz.** `capacidadDelDia` mezclaba las dos escalas: contaba la jornada
propia con `finExtendido` (hasta las "26:00") **y además** le sumaba el arrastre
del día anterior. Los minutos de madrugada entraban dos veces.

**Corrección.** `minutosDisponibles` recorta cada trozo en la medianoche
(`hastaMedianoche`). La madrugada la sigue aportando el arrastre del día que la
abre, una sola vez.

| Día (horario Vi–Sá 20:00–02:00, Do cerrado) | Antes | Ahora |
| ------------------------------------------- | ----- | ----- |
| Lunes 09:00–20:00                           | 660   | 660   |
| Viernes                                     | 360   | 240   |
| Sábado                                      | 480   | 360   |
| Domingo (cerrado, con la madrugada del sáb) | 120   | 120   |
| **Semana**                                  | 3.600 | 3.360 |

El viernes y el domingo se apartan de la tabla del informe justo por la regla
elegida: la semana suma los 3.360 minutos reales en los dos casos, y lo que
cambia es en qué día cae cada madrugada.

**Archivos tocados:** `booking-service/.../availability-query.service.ts`,
`availability-query.service.spec.ts`.

**Cómo verificarlo:** `cd services/booking-service && npx jest availability-query`.
Comprobado que las tres pruebas nuevas de la barbería nocturna fallan si se quita
el recorte; la de la semana entera es la que fija los 720 minutos de las dos
jornadas.

### BS-011 · «Ocupación de agenda» siempre 0 % ✅

**Causa raíz.** `CapacidadWorker` solo materializaba dentro de un `setInterval` de
una hora, sin pasada en `onModuleInit`: un servicio que se reinicia antes nunca
llegaba a escribir en `capacity_daily`.

**Corrección.** `onModuleInit` hace una primera pasada (`pasada()`, cuyo fallo se
registra y no se propaga, para no tumbar el arranque) y deja el intervalo. Y la
ocupación deja de ser un cero mudo: `ocupacion` responde `null` cuando no hay ni
un minuto de capacidad materializada, y la pantalla escribe «Sin datos aún» en vez
de «0 %», que es lo que el informe pedía distinguir.

**Archivos tocados:** `capacidad.worker.ts`, `dashboard.service.ts`,
`analytics/textos.ts` (**nuevo**), `analytics/page.tsx`, `lib/schemas/kpis.ts`, y
los `.spec` de los tres primeros más `analytics/__tests__/textos.test.ts`
(**nuevo**).

### BS-009 · El ticket medio publica una cifra falsa ✅

**Causa raíz.** El numerador filtraba por `ventas > 0`
(`SUM(total_revenue) FILTER (WHERE m.ventas > 0)`), así que un día con ingresos
cuyo contador de ventas se quedó a cero —un consumidor caído, un reproceso— salía
del cálculo **en silencio**. Los $471.000 del 12-ago desaparecían y el ticket
quedaba en $31.000 en vez de $52.167.

**Corrección.** El filtro desaparece: el ticket es `totalRevenue / ventas` sobre
el periodo entero. Y el descuadre deja de esconderse — la consulta cuenta los
`diasDescuadrados` (`COUNT(*) FILTER (WHERE m.ventas = 0 AND m.total_revenue > 0)`)
y, mientras haya alguno, `avgTicket` responde `null` con `ticketDescuadrado: true`.
La pantalla lo dice con palabras: «Sin calcular: hay ingresos sin cobro asociado»,
que es distinto de «Sin cobros aún».

El mismo criterio se aplica en las dos superficies que lo publican, `dashboard`
(el panel y Reportes) y `reports/revenue`, para que no puedan discrepar.

**Archivos tocados:** `dashboard.service.ts`, `reports.service.ts`, sus `.spec`,
`analytics/textos.ts`, `lib/schemas/kpis.ts`.

**Nota.** Esto hace visible el descuadre, no lo repara. La causa que lo produce
sigue anotada como hallazgo nuevo #6 (analytics sella la métrica con el día de
proceso, no con el del cobro) y no se ha tocado en este lote.

### BS-010 · «Ingresos últimos 7 días» se salta los días sin fila ✅

**Causa raíz.** Dos fallos en `getRevenueChart`. La serie se armaba mapeando las
filas encontradas, así que un día sin actividad no tenía fila y desaparecía del
eje; y el rango pedía `fechaHaceDias(zona, days)`, que con `days = 7` abre una
ventana de **ocho** días —de ahí la barra del 15-ago.

**Corrección.** El rango es `days - 1` hacia atrás, hoy incluido, y la serie
recorre el rango rellenando con cero los días sin fila.

**Archivos tocados:** `dashboard.service.ts`, `dashboard.service.spec.ts`.

**Cómo verificarlo:** `cd services/analytics-service && npx jest dashboard.service`.
Las tres pruebas de `getRevenueChart` fijan la fecha del sistema, de modo que el
rango es comprobable: siete puntos del 10 al 16, con los huecos a cero.

**Suite al cerrar el lote:** `npm run build` en verde y `npm run test:coverage`
**exit 0** — 184 suites, **2401 pruebas**, cobertura 92.37 sentencias /
93.60 líneas / 82.53 funciones / 81.56 ramas, por encima de los cuatro pisos.

---

## Lote 4 — Las reglas que solo vivían en la pantalla ✅

Tres de los cuatro son la misma causa **G5**: la interfaz respeta la regla y el
servicio no, así que cualquier integración, reintento o llamada directa la salta.

### BS-020 · El mismo teléfono con y sin prefijo país crea dos clientes ✅

**Causa raíz.** `normalizarTelefono` quitaba separadores y conservaba el `+`,
pero no reconciliaba el prefijo internacional: `+573009998877`,
`00573009998877` y `3009998877` eran tres cadenas distintas y el cotejo comparaba
por igualdad. Y `ClientsService.update` no normalizaba ni cotejaba nada, así que
**editar** el teléfono esquivaba el control entero — la mitad del hallazgo que el
informe no llegó a probar.

**Corrección.** Tres piezas y media:

- `normalizarTelefono` devuelve E.164: resuelve el `00`, respeta el `+` y aplica
  `INDICATIVO_POR_DEFECTO` (`+57`, junto a `MONEDA_POR_DEFECTO`) cuando el número
  se escribió sin él. Un número más largo que uno nacional y que no empieza por el
  indicativo se deja como está: antes no tocar un número extranjero que
  inventarle un país.
- `variantesDeTelefono` (nueva) da las formas equivalentes del mismo número. Es
  lo que hace innecesaria la migración de datos, que era la decisión tomada: una
  ficha antigua guardada sin indicativo se sigue reconociendo.
- El cotejo por variantes se aplica en los dos sitios que buscan por contacto:
  `ClientsService.buscarPorContacto` y `findExistingClient` de la ruta interna,
  que es la vía de la reserva pública.
- `update` pasa por la misma canonización y el mismo cotejo que el alta,
  excluyéndose a sí misma.

**Índice único detrás del control** (cierra el hallazgo nuevo #4). El cotejo
previo no separa dos altas simultáneas: entre la consulta y la escritura cabe
otra transacción. Se añaden `uq_clients_email_por_negocio` y
`uq_clients_telefono_por_negocio`, únicos parciales, en la entidad y en la
migración —la doble declaración que exige el repo—, dejando fuera el nulo **y la
cadena vacía**, que es lo que guarda la reserva pública del invitado sin
contacto. El 23505 se traduce con `esViolacionDeUnicidad` al mismo 409 en
castellano que ya daba el servicio.

**Archivos tocados:** `packages/shared-utils/src/index.ts` (+ spec),
`clients.service.ts` (+ spec), `internal-clients.controller.ts`,
`client.entity.ts`, `migrations/1700000000016-ContactoUnicoPorNegocio.ts`
(**nuevo**).

**Cómo verificarlo:** `npx jest index` en `packages/shared-utils` y
`npx jest clients.service` en core. Manual: alta con `3009998877` y segunda alta
con `+57 300 999 8877` → 409; editar una ficha y ponerle el teléfono de otra →
409, donde antes respondía 200.

> Antes de aplicar la migración en un entorno con datos, comprobar que no haya
> duplicados exactos ya guardados, o el `CREATE UNIQUE INDEX` falla:
>
> ```sql
> SELECT business_id, phone, count(*) FROM clients
> WHERE phone IS NOT NULL AND phone <> '' GROUP BY 1,2 HAVING count(*) > 1;
> ```

### BS-026 · Un nombre de solo espacios crea una ficha sin identidad ✅

**Causa raíz.** `name` era `@IsString @MaxLength(200)`: `"   "` es una cadena
válida.

**Corrección.** Se recorta antes de validar y se exige no vacío, en el alta y en
la edición. En el formulario, donde el `required` del campo se conformaba con
espacios, el botón de guardar no se habilita sin nombre y lo que se envía va
recortado — así, añadir espacios alrededor deja de contar como un cambio.

**Archivos tocados:** `clients/dto/client.dto.ts` (+ spec),
`clients/client-form-dialog.tsx`, `clients/page.tsx`, `clients/schemas.ts`
(+ spec).

### BS-016 · Se puede marcar «no asistió» una cita futura ✅

**Causa raíz.** `markNoShow` validaba el estado pero no la fecha; `complete` sí
la valida.

**Corrección.** La misma comprobación que `complete`, con la zona horaria del
negocio y su propio mensaje. La regla existía —el botón solo aparece cuando la
cita ya empezó— pero vivía en el cliente, y de ella cuelgan la tasa de asistencia
de los informes, el historial del cliente y el depósito por no-show previsto.

**Archivos tocados:** `appointments.service.ts` (+ spec).

### BS-024 · La confirmación promete un correo imposible ✅ (solo el texto)

**Causa raíz.** El aviso era fijo: «Recibiras un correo de confirmacion», sin
tildes y para todo el mundo, incluido quien reservó dejando solo el nombre.

**Corrección.** El aviso depende de lo que el cliente dejó: el correo con su
dirección, la llamada del negocio si solo dio teléfono, y si no dejó nada, que
anote la fecha y la hora. Exigir un contacto para reservar sigue siendo propuesta
`[PM]`.

**Archivos tocados:** `book/booking-confirmation.tsx`, `book/page.tsx`,
`book/__tests__/booking-confirmation.test.tsx` (**nuevo**).

**Suite al cerrar el lote:** `npm run build`, `npm run lint` y `npm run type-check`
en verde; `npm run test:coverage` **exit 0** — 185 suites, **2422 pruebas**.

---

## Lote 5 — Lo que la pantalla cuenta mal ✅

Ocho hallazgos menores por severidad, pero todos en pantallas de uso diario. Dos
pedían una decisión que se tomó al empezar: abrir la lectura del horario a
recepción, y guardar la fecha de publicación del perfil.

### BS-017 · Los bloqueos no se veían en la vista Semana ✅

**Causa raíz.** G7. La ruta `GET /booking/blocked-slots` solo servía un día, así
que la página solo los pedía en la vista día y `CalendarView` ni los recibía. La
semana es la pantalla con la que se responde al teléfono: la tarde de quien está
de vacaciones se veía libre.

**Corrección.** La ruta admite un `hasta` opcional (`Between`, mismo orden), la
página pide los siete días cuando está en semana, y la rejilla pinta cada bloqueo
sobre las franjas que ocupa —antes que las citas— con su motivo, de quién es y su
horario en el `title`.

**Archivos tocados:** `blocked-slots.{controller,service,dto}` (+ spec),
`calendar-view.tsx`, `appointments/page.tsx`, `docs/API.md`.

### BS-019 · Cambiar de vista perdía el día que estabas mirando ✅

**Causa raíz.** G7. `CalendarView` llevaba su propio `weekOffset`, sin relación
con el `dia` de la página que usa la vista día.

**Corrección.** La semana se deriva de `date`, que ahora es un solo estado para
las dos vistas; navegar de semana mueve ese día. Los helpers de fecha
(`desplazarDia`, `fechasDeLaSemana`) viven en `lib/utils` y los comparten las dos
vistas y la página, en vez de duplicarse.

**El domingo cerrado**, que el informe agrupaba aquí: las dos vistas marcan como
cerrados los días sin horario. Para eso `GET /core/business-hours` pasa a
admitir **RECEPTIONIST** —leer a qué hora abre el negocio no es dato sensible y
es quien atiende el teléfono la que lo necesita; escribirlo sigue siendo de dueño
y administrador—. Sin horario cargado no se afirma que nada esté cerrado.

**Archivos tocados:** `calendar-view.tsx`, `day-view.tsx`, `lib/utils.ts`,
`appointments/page.tsx`, `business-hours.controller.ts`, `docs/API.md`,
`__tests__/calendar-view.test.tsx` (**nuevo**).

### BS-018 · Las citas solapadas se tapaban ✅

**Causa raíz.** Cada cita se posicionaba con `inset-x-0.5`: todas ocupaban el
ancho entero de la columna y la última pintada quedaba encima.

**Corrección.** `repartirSolapes` agrupa las citas encadenadas por solape y
reparte el ancho en tantas columnas como haga falta, reutilizando la que ya quedó
libre. Es una función pura y se prueba como tal, además de por el render.

**Archivos tocados:** `day-view.tsx` (+ spec).

### BS-023 · El escaparate ordenaba por el criterio equivocado ✅

**Causa raíz.** G8, en dos secciones. «Recién llegados» filtraba por
`created_at` del perfil —la fila nace con el borrador, no al publicarse— y
ordenaba por completitud, que no es la antigüedad de nadie; «Mejor calificados»
no exigía reseñas, así que un negocio estrenado figuraba con la nota a cero.

**Corrección.** Columna `published_at` (aditiva, con migración que sella los ya
publicados con su `created_at`), escrita la primera vez que se publica: retirar
el perfil y volver no devuelve a nadie a la sección. La sección filtra y ordena
por ella. «Mejor calificados» exige al menos una reseña y desempata por número de
reseñas; mismo criterio en los profesionales destacados, que tenían el mismo
hueco. Y el rótulo recupera la tilde.

> La lista de excepciones de `aislamiento-de-tenant.spec.ts` pierde la entrada de
> `findTopRated`: al pasar a query builder, el barrido ya no la cuenta como
> consulta sin filtro de negocio. La prueba que vigila las excepciones huérfanas
> lo detectó sola.

**Archivos tocados:** `business-profile.entity.ts`,
`business-profiles.service.ts` (+ spec), `professional-profiles.service.ts`
(+ spec), `feed.service.ts`, `migrations/1700000000011-PublicacionDelPerfil.ts`
(**nuevo**), `aislamiento-de-tenant.spec.ts`.

### BS-007 · Categoría y etiqueta heredada pintadas igual ✅

**Causa raíz.** `CategoryBadge` ya las distinguía por variante, pero las dos
seguían siendo insignias: el filtro contaba «Sin categoría (3)» sobre tarjetas
que lucían una etiqueta bien visible.

**Corrección.** La etiqueta heredada deja de tener forma de categoría: texto con
su rótulo, diciendo que ese servicio no tiene categoría y cuál es la etiqueta. El
componente es el mismo que usan las fichas del equipo, así que las dos pantallas
quedan corregidas a la vez.

**Archivos tocados:** `ui/category-badge.tsx` (+ spec).

### BS-008 · El total esperado quedaba a la vista tras el modal ✅

**Corrección.** Mientras el modal de cierre está abierto, la tarjeta oculta la
cifra y dice por qué. El arqueo a ciegas es un control anti-fraude, y el modal ya
hacía bien su parte.

**Archivos tocados:** `cash-register/page.tsx`.

### BS-014 · El CSV sin tildes y con la variación vacía ✅

**Corrección.** Las cabeceras y los indicadores llevan sus tildes —el archivo ya
llevaba BOM UTF-8 puesto a propósito para eso—, y la variación deja de ser una
celda en blanco: «nuevo» cuando el indicador arranca de cero y un guion cuando no
hay comparación posible.

**Archivos tocados:** `analytics/export.ts` (+ spec).

### BS-027 · Las tarjetas no mostraban el foco ✅

**Causa raíz.** El anillo estaba en la tarjeta con `focus-within` y el botón que
la abre se lo quitaba con `focus:outline-none`.

**Corrección.** El anillo va en el botón y con `focus-visible`, como en el resto
del panel; de paso deja de pintarse al hacer clic con el ratón.

**Archivos tocados:** `clients/page.tsx`.

**Suite al cerrar el lote:** `npm run build`, `npm run lint` y `npm run type-check`
en verde; `npm run test:coverage` **exit 0** — 186 suites, **2451 pruebas**.

---

## Propuestas `[PM]`

Redactadas en **[QA-PROPUESTAS-PM.md](QA-PROPUESTAS-PM.md)**: los nueve hallazgos
que no son un fallo que corregir sino una función que falta — BS-002, BS-003,
BS-005, BS-006, BS-013, BS-021, BS-024 (la regla de contacto obligatorio), BS-028
y BS-025 en su versión completa (409 optimista), ordenados por impacto frente a
coste y con lo que hay que decidir en cada uno.

Al contrastarlas con el código aparecieron cuatro diferencias con lo que el
informe suponía, dos de ellas determinantes:

- **BS-006 ya está construido en el backend.** Existe `professional_services` con
  `custom_price`/`custom_duration`, sus rutas en `/core/professionals/:id/services`
  y la resolución por profesional en `/internal/services/resolve`, que la agenda
  ya usa. Falta la pantalla. Y detrás asoma un fallo real: la reserva pública
  enseña el precio del catálogo mientras booking cobra el efectivo, así que en
  cuanto alguien use tarifas propias el marketplace mostrará un precio y el
  negocio cobrará otro.
- **BS-005 no tiene nada construido.** El `discount` que el informe da por rastro
  en la entidad es un campo del payload del evento de canje de puntos; el
  descuento comercial no se guarda en ninguna parte, así que era el más barato de
  los tres y no lo es.
- **BS-002** tiene más backend del que el informe apunta (devolución parcial y
  contrapartida en caja), con dos límites que la pantalla debe respetar: la
  ventana de 30 días y que la anulación por estado no toca la caja.
- **BS-003** no puede configurar la tasa de impuesto: es la constante `IVA` de
  `shared-constants`, no un ajuste del negocio.

## Hallazgos nuevos

Detectados durante la remediación, no estaban en el informe.

1. **`apps/frontend/src/lib/use-crud-resource.ts` usaba hooks sin `"use client"`.**
   Misma causa que BS-022. Hoy no falla porque todos sus consumidores son páginas
   de cliente, así que hereda la directiva; pero el primer server component que lo
   importe reproduce el bloqueante. **Corregido** junto a BS-022, ya que es
   literalmente lo que el informe pedía barrer.
2. **`BatchUpsertDto.hours`** no declaraba `@IsArray()` ni `@ArrayMaxSize`. Un
   `hours` que no fuera array entraba en `@ValidateNested({ each: true })` sin
   garantía de forma: la validación de cada elemento no encuentra nada que
   recorrer y da el campo por bueno. **Corregido**, con un tope de 500 tramos.
3. **`BusinessHourItemDto.openTime`/`closeTime`** eran `@IsString @MaxLength(5)`
   sin patrón de hora, así que cualquier cadena de cinco caracteres llegaba al
   servicio. **Corregido**: el DTO exige la forma `HH:MM` y el rango se queda en
   `business-hours.service.ts:83`, que es quien distingue la apertura (hasta
   23:59) del cierre (hasta 24:00, el día completo) y explica cada caso.
4. **Alta de clientes sin índice único detrás.** `rechazarSiYaExiste` comprobaba
   y luego insertaba, sin índice único que lo respaldara — el resto del repositorio
   usa insertar-y-traducir-el-23505 (`esViolacionDeUnicidad`). Dos altas simultáneas
   con el mismo teléfono se colaban. **Corregido** con BS-020, que es la mitad del
   hallazgo que tenía que sostener la base de datos.
5. ~~**`PATCH /payments/:id/status` no toca la caja**: anular un pago en efectivo
   deja su entrada en el arqueo.~~ **No es alcanzable, y el hallazgo estaba mal
   planteado.** Un cobro nace `COMPLETED` —`CreatePaymentDto` no admite estado— y
   `TRANSICIONES_DE_PAGO[COMPLETED]` está vacío: un cobro completado no se puede
   anular por esa ruta. La única transición que acepta es `PENDING → CANCELLED`,
   y un cobro pendiente no se puede crear. La ruta es hoy **código muerto**;
   deshacer un cobro es devolverlo, y la devolución sí mueve la caja.
6. **Analytics sella la métrica con el día de proceso, no con el del cobro**
   (`analytics-event-listeners.service.ts` L223-241 usa `hoyPara(businessId)`). Un
   evento reprocesado al día siguiente cuenta en el día equivocado: es una vía
   plausible del descuadre que produce BS-009.

## Deuda técnica detectada

Anotada, **no corregida** (fuera del alcance de los hallazgos).

- **Pruebas de `login` y `registro` sensibles al tiempo.** Con el timeout por
  defecto de 5 s, en una ejecución completa en frío se agotan por contención de CPU
  (reproducido una vez; en verde al repetir y al ejecutarlas aisladas). Son las
  únicas del frontend que dependen de temporizadores reales sobre `global.fetch`.
  Merecen un timeout explícito o temporizadores falsos antes de que molesten en CI.
- **Los DTO de pagos viven dentro de `payments.controller.ts`** (L34-98), a
  diferencia de facturas y caja, que sí tienen carpeta `dto/`.
- **`collectCoverageFrom` del frontend solo mide `src/lib/**`\*\*: las páginas y
  componentes no suman ni restan cobertura, así que las correcciones de interfaz no
  quedan protegidas por la puerta de cobertura.
- **`coverage/coverage-summary.json` queda obsoleto y engaña.** Los
  `coverageReporters` de la raíz son `json, lcov, text, clover`, sin
  `json-summary`, así que ese fichero no se regenera: el que hay en `coverage/`
  es de una corrida antigua y leerlo para comprobar la puerta da cifras falsas.
  Las buenas salen de `coverage-final.json` o del propio código de salida de
  `npm run test:coverage`, que es quien decide.
