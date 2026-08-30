# Plan de remediación — QA-REPORT-BeautySpot-2026-08-22

Rama de trabajo: `fix/tanda-22-next-16` (PR #99). Origen: `QA-REPORT-BeautySpot-2026-08-22.md`,
28 hallazgos (1 bloqueante, 5 altos, 15 medios, 7 bajos).

Estados: ⬜ pendiente · 🟨 en curso · ✅ corregido y verificado · 📋 propuesta `[PM]` (no se implementa) · ❓ necesita aclaración

## Decisiones tomadas

| Tema    | Decisión                                                                     |
| ------- | ---------------------------------------------------------------------------- |
| BS-001  | Implementar `PATCH /payments/:id` con traza y ajuste del movimiento de caja  |
| BS-025  | Solo enviar los campos modificados (el 409 optimista queda como propuesta)   |
| BS-020  | Normalizar a E.164 de aquí en adelante, **sin** migración de datos           |
| Rama    | Todo se acumula en `fix/tanda-22-next-16`; el PR lo abre el usuario          |
| Esquema | Aprobadas 3 columnas aditivas en `payments` para la traza de BS-001          |
| BS-012  | Los minutos de madrugada cuentan en el **día natural**, no en el de apertura |

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
| BS-002 | Alta       | Pagos            | Falta pantalla; `POST /:id/refund` ya existe                                                 | M        | —      | 6    | 📋     |
| BS-003 | Alta       | Facturación      | Falta pantalla; backend completo con PDF                                                     | M        | —      | 6    | 📋     |
| BS-011 | Media      | Métricas         | `CapacidadWorker` no materializa hasta la primera hora                                       | S        | Bajo   | 3    | ✅     |
| BS-012 | Media      | Agenda           | G6 · el tramo que cruza medianoche se cuenta en dos días                                     | S        | Medio  | 3    | ✅     |
| BS-010 | Media      | Dashboard        | G4 · la serie se arma con las filas existentes                                               | XS       | Bajo   | 3    | ✅     |
| BS-020 | Media      | Clientes         | `normalizarTelefono` no reconcilia el prefijo internacional                                  | S        | Medio  | 4    | ⬜     |
| BS-004 | Media      | Pagos            | G5 · `@Min(0)` admite el cobro de cero                                                       | XS       | Bajo   | 4    | ✅     |
| BS-026 | Media      | Clientes         | G5 · `name` sin `trim` ni `@IsNotEmpty`                                                      | XS       | Bajo   | 4    | ⬜     |
| BS-016 | Media      | Agenda           | G5 · `markNoShow` no comprueba la fecha; `complete` sí                                       | XS       | Bajo   | 4    | ⬜     |
| BS-025 | Media      | Transversal      | G2 · el formulario envía todos los campos                                                    | S        | Bajo   | 4    | ✅     |
| BS-024 | Media      | Marketplace      | Texto: promete un correo a quien no lo dejó (la regla es `[PM]`)                             | XS       | Bajo   | 4    | ⬜     |
| BS-007 | Media      | Servicios        | Categoría del catálogo y campo libre `category` pintados igual                               | S        | Bajo   | 5    | ⬜     |
| BS-017 | Media      | Agenda           | G7 · `CalendarView` no recibe bloqueos                                                       | S        | Bajo   | 5    | ⬜     |
| BS-005 | Media      | Pagos            | Sin descuento, propina ni pago mixto                                                         | L        | —      | 6    | 📋     |
| BS-006 | Media      | Servicios/Equipo | El precio no varía por profesional                                                           | L        | —      | 6    | 📋     |
| BS-013 | Media      | Agenda           | No hay alta de walk-in retroactivo                                                           | M        | —      | 6    | 📋     |
| BS-021 | Media      | Clientes         | No hay fusión de fichas                                                                      | M        | —      | 6    | 📋     |
| BS-028 | Media      | Onboarding       | El tipo de negocio no siembra nada                                                           | S        | —      | 6    | 📋     |
| BS-008 | Baja       | Caja             | El KPI «Total esperado» queda visible tras el modal                                          | XS       | Bajo   | 5    | ⬜     |
| BS-014 | Baja       | Métricas         | G9 · cabeceras del CSV sin tildes; variación vacía                                           | XS       | Bajo   | 5    | ⬜     |
| BS-018 | Baja       | Agenda           | Las citas solapadas no reparten el ancho                                                     | S        | Bajo   | 5    | ⬜     |
| BS-019 | Baja       | Agenda           | G7 · `CalendarView` tiene su propio `weekOffset`                                             | S        | Bajo   | 5    | ⬜     |
| BS-023 | Baja       | Marketplace      | G8 · `findRecent` ordena por completitud; `findTopRated` no exige reseñas                    | S        | Bajo   | 5    | ⬜     |
| BS-027 | Baja       | Accesibilidad    | Las tarjetas usan `focus-within` en vez de `focus-visible`                                   | XS       | Bajo   | 5    | ⬜     |

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

### BS-025 · Dos ediciones a la vez ✅ (versión mínima acordada)

**Causa raíz.** Misma que BS-015 vista del otro lado: la ficha de cliente enviaba
todos los campos, así que guardar desde una pestaña con datos viejos revertía en
silencio lo que otra persona acababa de guardar.

**Corrección.** `openEdit` guarda la ficha tal como se cargó y `cambiosDelCliente`
compara para enviar solo lo modificado; sin cambios no se llama al servidor. El
choque queda acotado al mismo campo. La detección de conflicto con 409 sigue como
propuesta.

**Archivos tocados:** `clients/schemas.ts` (`cambiosDelCliente`), `clients/page.tsx`,
`clients/__tests__/cambios-del-cliente.test.ts` (**nuevo**).

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

## Propuestas `[PM]` pendientes

Pendiente de redactar al cerrar los lotes de QA. Cubrirá BS-002, BS-003, BS-005,
BS-006, BS-013, BS-021, BS-024 (la regla de contacto obligatorio), BS-028 y BS-025
en su versión completa (409 optimista).

## Hallazgos nuevos

Detectados durante la remediación, no estaban en el informe.

1. **`apps/frontend/src/lib/use-crud-resource.ts` usaba hooks sin `"use client"`.**
   Misma causa que BS-022. Hoy no falla porque todos sus consumidores son páginas
   de cliente, así que hereda la directiva; pero el primer server component que lo
   importe reproduce el bloqueante. **Corregido** junto a BS-022, ya que es
   literalmente lo que el informe pedía barrer.
2. **`BatchUpsertDto.hours`** (`core-service/.../business-hours.dto.ts` L45-49) no
   declara `@IsArray()` ni `@ArrayMaxSize`. Un `hours` que no sea array entra en
   `@ValidateNested({ each: true })` sin garantía de forma. Pendiente de tu visto bueno.
3. **`BusinessHourItemDto.openTime`/`closeTime`** son `@IsString @MaxLength(5)` sin
   patrón de hora; la validación real vive en el servicio (`business-hours.service.ts:83`).
4. **Alta de clientes sin índice único detrás.** `rechazarSiYaExiste`
   (`clients.service.ts` L102-113) comprueba y luego inserta, sin índice único que
   lo respalde — el resto del repositorio usa insertar-y-traducir-el-23505
   (`esViolacionDeUnicidad`). Dos altas simultáneas con el mismo teléfono se cuelan.
5. **`PATCH /payments/:id/status` no toca la caja** (`payments.service.ts` L447-462):
   anular un pago en efectivo deja su entrada en el arqueo.
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
