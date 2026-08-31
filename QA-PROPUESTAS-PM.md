# Propuestas de producto — QA-REPORT-BeautySpot-2026-08-22

Los nueve hallazgos del informe marcados `[PM]`: los que no son un fallo que
corregir sino una función que falta, y por tanto una decisión de producto. Nada
de esto está implementado; este documento es lo que hay que decidir antes de
implementarlo.

Cada propuesta trae **lo que hay hoy verificado contra el código**, no lo que el
informe suponía. Cuatro veces no coinciden, y en dos de ellas la diferencia
cambia el coste por completo — están marcadas con ⚠️.

Origen: `QA-REPORT-BeautySpot-2026-08-22.md`. Las correcciones ya aplicadas están
en `QA-REMEDIATION-PLAN.md`.

## Resumen

| ID     | Qué falta                                   | Backend                    | Interfaz  | Esfuerzo | Orden |
| ------ | ------------------------------------------- | -------------------------- | --------- | -------- | ----- |
| BS-003 | Pantalla de facturas y tasa de impuesto     | Hecho                      | **Hecha** | —        | ✅    |
| BS-002 | Devolver un cobro                           | Hecho                      | **Hecha** | —        | ✅    |
| BS-006 | Precio y duración por profesional           | Hecho                      | **Hecha** | —        | ✅    |
| BS-028 | Sembrar el negocio nuevo según su tipo      | Falta                      | Poca      | M        | 4     |
| BS-024 | Exigir un contacto en la reserva pública    | Una regla en el DTO        | Poca      | XS       | 5     |
| BS-013 | Alta de walk-in retroactivo                 | Falta el concepto          | Media     | M        | 6     |
| BS-021 | Fusión de fichas duplicadas                 | Falta, y cruza 4 servicios | Media     | L        | 7     |
| BS-005 | Descuento, propina y pago mixto             | Falta entero ⚠️            | Media     | L        | 8     |
| BS-025 | Aviso de edición simultánea (409 optimista) | Una comprobación por ruta  | Poca      | M        | 9     |

El orden es de impacto comercial frente a coste. Los tres primeros comparten un
rasgo que los pone arriba: **la función ya está construida y pagada en el
backend, y lo único que falta es la pantalla que la alcance**. Los tres ya la
tienen.

---

## 1 · BS-003 · Facturas: emitir, listar y descargar ✅ (implementado)

**Qué hay hoy.** El módulo entero. `invoices.controller.ts` expone `POST /`
(OWNER/ADMIN), `GET /`, `GET /:id`, `PATCH /:id/status` y **`GET /:id/pdf`**, con
su gemela para el cliente final (`/mine`). La entidad congela `subtotal`,
`taxRate`, `tax` y `total` al emitir —con el comentario de por qué: el IVA cambia
por ley y una factura de hoy no puede reimprimirse mañana con el tipo nuevo— y la
numeración reserva el siguiente número de la serie del negocio sin dejar huecos
(`invoice_sequences`, con `ON CONFLICT`). En el panel no hay ninguna pantalla que
lo use: la única ruta de facturas del frontend es la del cliente final.

⚠️ **Corrección al informe.** La tasa **no** es configurable ni sale de la ficha
del negocio: es la constante `IVA = 0.19` de `@beautyspot/shared-constants`,
leída directamente por `invoices.service.ts`. Configuración → Facturación guarda
razón social, NIT, dirección fiscal y serie, y ahí acaba. Un negocio exento, o
uno que facture con otro tipo, hoy no puede.

**Hecho.** Pantalla «Facturas» en el panel —listado con filtros por estado,
detalle con el desglose congelado, PDF y cambio de estado ofreciendo solo las
transiciones que el servicio acepta—, emisión desde un cobro (`paymentId` en el
DTO y columna, con índice único que impide facturarlo dos veces) y la tasa
configurable en Configuración → Facturación, que admite el cero.

Al emitir desde un cobro apareció algo que la propuesta no había visto: **lo
cobrado en el mostrador lleva el impuesto dentro**. Sumárselo encima habría hecho
que la factura pidiera más de lo que el cliente ya pagó, así que la base se
calcula descontándolo y el impuesto sale por diferencia; el total coincide al
peso con lo cobrado. Y si los precios de la cita no suman lo cobrado —un
descuento, un canje de puntos— se emite una sola línea antes que publicar un
desglose que no cuadra.

**Qué queda por decidir.** Si se permite agrupar varios cobros en una factura
(hoy es uno a uno) y qué pasa al devolver un cobro ya facturado: nota de crédito,
anular la factura, o nada por ahora. Facturar a mano, sin cobro detrás, sigue
siendo posible por API pero no tiene pantalla.

**Cómo se sabe que sirvió.** Un salón con NIT puede cerrar el mes sin salirse del
producto. Hoy no puede empezarlo.

---

## 2 · BS-002 · Devolver un cobro ✅ (implementado)

**Qué hay hoy.** Más de lo que el informe apunta. `POST /payments/:id/refund`
admite **devolución parcial** (`refundAmount`), exige que el cobro esté
`COMPLETED`, registra la **contrapartida en la caja abierta**
(`registrarSalidaEnCaja`) dentro de la misma transacción, guarda motivo y quién
la hizo, y publica el evento para analytics.

⚠️ **Anular no existe, y el hallazgo nuevo #5 estaba mal planteado.** Se anotó
que `PATCH /payments/:id/status` no toca la caja y que por tanto anular un cobro
en efectivo dejaba su entrada en el arqueo. Al construir la pantalla resultó que
ese camino no se puede recorrer: un cobro nace `COMPLETED` —`CreatePaymentDto` no
admite estado— y `TRANSICIONES_DE_PAGO[COMPLETED]` está vacío, así que un cobro
completado no admite cambio de estado. La única transición que la ruta acepta es
`PENDING → CANCELLED`, y un cobro pendiente no se puede crear. **Deshacer un
cobro es devolverlo**, y eso sí mueve la caja.

**Hecho.** «Devolver» por fila en Pagos, total o parcial y con motivo
obligatorio. El listado muestra lo devuelto y su motivo bajo el importe —una
devolución parcial deja el cobro vivo por el resto, y sin decir cuánto volvió la
cifra de arriba engaña— y deja de ofrecer la acción sobre lo ya devuelto.

Dos límites del servicio que la pantalla dice **antes** de que alguien pulse: la
**ventana de 30 días** (`REFUND_WINDOW_DAYS`), pasada la cual la acción no se
ofrece, y que **el efectivo sale de la caja abierta** —sin ninguna abierta el
servicio responde 400, así que el diálogo lo advierte al devolver en efectivo y,
si aun así ocurre, el motivo se lee donde se pulsó y no en un aviso que se va
solo—.

En el catálogo de permisos, `payments_void` pasa a `payments_refund`: prometía
una anulación que el backend no admite.

**Qué queda por decidir.** Quién puede devolver: hoy dueño y administrador, como
el backend; abrirlo a recepción es dejar que se devuelva dinero sin supervisión.
Y si los 30 días son la política que se quiere o un número que quedó puesto.

**Cómo se sabe que sirvió.** Deja de haber movimientos de caja sueltos
compensando cobros malos, que es lo que hoy descuadra los informes de ingresos.

---

## 3 · BS-006 · Precio y duración por profesional ✅ (implementado)

⚠️ **El informe se equivoca aquí, y a favor: ya está construido.** Existe la
entidad `professional_services` (`professional_id`, `service_id`,
`custom_price`, `custom_duration`, único por par), las rutas que la gestionan
—`POST`, `GET` y `DELETE /core/professionals/:id/services`, documentadas en
`docs/API.md`— y la resolución en el momento de reservar:
`POST /internal/services/resolve` recibe el profesional y devuelve
`propio?.customPrice ?? servicio.price`, con la duración igual y cuidando que la
ventana de procesado siga cabiendo. La agenda ya pide una resolución **por cada
profesional** de la cita.

Lo que faltaba era la pantalla, **y ya está**: la ficha del profesional gana
«Servicios», con el catálogo del negocio, un interruptor por servicio y precio y
duración propios opcionales sobre el valor del catálogo. Asignar es ahora
idempotente —cambiar la tarifa de un servicio ya asignado chocaba contra el
único (profesional, servicio) y salía como error del servidor— y dejar los
campos en blanco significa cobrar y durar lo del catálogo.

**Había un fallo real escondido detrás, ya corregido.** La reserva pública
listaba los servicios con el precio del catálogo y sin aceptar profesional,
mientras booking cobraba el efectivo del par: en cuanto alguien usara tarifas
propias, el escaparate enseñaría un precio y el negocio cobraría otro, y la
duración —de la que salen los huecos ofrecidos— tenía el mismo desajuste.
`GET /core/public/businesses/:id/services` admite ahora `professionalId` y
devuelve la tarifa de ese profesional; sin él marca los servicios cuyo precio
depende de quién atienda, que la reserva y la ficha pública pintan como «desde».
La regla de la tarifa efectiva vive en `PreciosService`, compartida con la ruta
interna, para que las dos no puedan discrepar.

**Qué queda.** Nada de ingeniería, una decisión comercial: si el «desde» del
escaparate basta o se prefiere enseñar el rango de precios del servicio. Hoy se
muestra el del catálogo como punto de partida.

Y una pregunta de producto que la pantalla deja servida: hoy asignar servicios es
**opcional** —un profesional sin ninguno asignado sigue pudiendo atenderlos
todos, al precio del catálogo—. Si en algún momento se quiere que la agenda solo
ofrezca a quien presta el servicio, esa es otra regla y hay que decidirla.

**Cómo se sabe que sirvió.** Un salón con escalafón deja de tener que duplicar
servicios («Corte senior», «Corte junior»), y la rentabilidad por servicio vuelve
a comparar peras con peras.

---

## 4 · BS-028 · Sembrar el negocio nuevo según su tipo

**Qué hay hoy.** El tipo se pide al crear el negocio, se guarda y viaja en el
evento `core.business.created` (`businessType` va en el payload). No siembra
nada: un spa nace con 0 servicios, 0 categorías, 0 profesionales y 0 tramos
horarios, y con el mismo menú de quince entradas que una barbería. El catálogo de
tipos ya existe en `TIPOS_DE_NEGOCIO` (barbería, salón, spa, belleza).

**Propuesta.** Una plantilla por tipo con un puñado de servicios típicos —nombre,
duración y precio orientativo—, las categorías propias del sector y un horario de
apertura razonable. Se aplica al crear el negocio, dentro de la misma
transacción, y el alta ofrece **«empezar en blanco»** para quien no la quiera.
Todo editable y borrable después, sin ninguna marca que distinga lo sembrado de
lo escrito a mano: en cuanto el dueño lo toca, es suyo.

**Qué hay que decidir.** El contenido de las cuatro plantillas, que es trabajo de
producto y no de ingeniería: qué diez servicios definen una barbería colombiana,
qué precios orientativos no ofenden, qué horario. Y si se siembra también un
profesional con el nombre del dueño, que es lo que hace falta para que la agenda
sea usable el primer día.

**Cómo se sabe que sirvió.** El dueño llega a su primera cita sin pasar por
Servicios, Categorías, Equipo y Horarios antes.

---

## 5 · BS-024 · Exigir un contacto en la reserva pública

**Qué hay hoy.** `PublicBookingDto` pide `guestName` y deja `guestEmail` y
`guestPhone` como opcionales, los dos. Una reserva sin ningún dato de contacto se
acepta y crea una ficha en la cartera del negocio con los dos campos vacíos. El
texto de la confirmación ya se corrigió y no promete un correo imposible; lo que
queda es la regla.

**Propuesta.** Exigir **teléfono o correo**, uno de los dos, en el DTO —una
validación de grupo, no dos `@IsOptional`— y en el formulario, cambiando las
etiquetas «(opcional)» por una que diga qué hace falta. Es la propuesta más
barata del documento.

**Qué hay que decidir.** Si se exige de verdad. Pedir un dato más en un formulario
público **cuesta reservas**: hay quien abandona. La defensa contra el no-show vale
más que esas reservas —una cita sin forma de confirmar ni recolocar es media
cita—, pero es una decisión de negocio con un coste medible, no una obviedad.
Conviene medirla: si el abandono sube más de lo esperado, la alternativa es
exigirlo solo cuando la reserva es a más de 24 horas vista.

**Cómo se sabe que sirvió.** Deja de haber fichas sin nombre ni contacto en la
cartera —que además son indeduplicables, ver BS-021— y el negocio puede confirmar
la víspera.

---

## 6 · BS-013 · Alta de walk-in

**Qué hay hoy.** `AppointmentsService.create` rechaza el pasado
(`esInstantePasadoEn` → «No se puede agendar una cita en el pasado»), y el
formulario ni siquiera deja escribir la fecha de ayer. La validación es correcta
para una **reserva**; el problema es que el otro concepto no existe. Hoy, para
dejar constancia de un walk-in hay que inventar una hora futura y mentir sobre
cuándo ocurrió, o cobrar sin cita —y entonces el cobro queda desligado del
servicio y del profesional, que es exactamente por qué «Rentabilidad por
servicio» e «Ingresos por profesional» se quedan sin datos.

**Propuesta.** Un alta de walk-in que acepte una hora ya pasada **del día en
curso**, nazca directamente como atendida (`COMPLETED`, con su
`completedAt` real) y encadene el cobro en el mismo paso. No es una reserva y no
pasa por la validación de disponibilidad: el hueco ya se ocupó, en la silla.

**Qué hay que decidir.** Hasta dónde llega el «pasado» admisible: el día en curso
es lo defendible; abrirlo a ayer convierte la agenda en un registro editable y
deja la puerta a maquillar métricas. Y si el walk-in puede solaparse con una cita
existente —en la práctica ocurre— o si hay que avisar.

**Cómo se sabe que sirvió.** Las métricas por profesional y por servicio dejan de
estar vacías en negocios donde media clientela entra sin cita.

---

## 7 · BS-021 · Fusión de fichas duplicadas

**Qué hay hoy.** Nada. Las acciones de la ficha son editar y suprimir datos. Con
BS-020 corregido —el mismo teléfono con y sin indicativo ya no crea dos fichas—
los duplicados siguen apareciendo por las otras vías: otro teléfono, el correo
del trabajo, un nombre mal tecleado.

**Lo que hace esta propuesta cara** es que el cliente no vive en un solo sitio.
`clientId` está en cinco entidades de cuatro servicios: `appointments`
(booking), `payments` e `invoices` (payment), `reviews` (marketplace) y
`client_metrics` (analytics), además de lo que guarda core: puntos de fidelidad,
ficha configurable, etiquetas y el vínculo con la cuenta de usuario.

**Propuesta.** Core hace la fusión sobre la ficha superviviente —suma los puntos,
combina la ficha configurable campo a campo con el criterio de conservar lo no
vacío, une las etiquetas y conserva el teléfono y el correo del absorbido como
**alias**, para que una reserva futura por cualquiera de los dos caiga en la
ficha buena— y publica un evento nuevo, `core.client.merged`, con las dos ids.
Cada servicio reasigna lo suyo al consumirlo. La ficha absorbida no se borra: se
marca como fusionada y apunta a la superviviente, porque citas y facturas viejas
la referencian y tienen que seguir cuadrando.

Conviene el complemento barato: **avisar del posible duplicado en el momento del
alta**, aprovechando que la búsqueda ya sabe encontrarlos. Evita más fusiones de
las que resuelve la fusión.

**Qué hay que decidir.** Si la fusión es reversible (mucho más cara) o
definitiva con confirmación explícita. Quién puede fusionar. Y qué se hace con
dos fichas que tienen cuenta de usuario distinta, que es el caso feo: son dos
personas o una con dos cuentas, y el producto no puede saberlo.

**Cómo se sabe que sirvió.** En un centro estético, que la ficha de alergias y la
fórmula de color de una clienta dejen de estar partidas en dos historiales a
medias. Ese es el riesgo real, y no es de datos.

---

## 8 · BS-005 · Descuento, propina y pago mixto

**Qué hay hoy.** El cobro admite cliente, importe, **un** método y notas.

⚠️ **Corrección al informe, y en contra.** El informe daba el descuento por medio
construido («`discount` aparece en `payment.entity.ts`») y lo proponía como el
más barato de los tres. No es así: en la entidad no hay ninguna columna de
descuento. El único `discount` del servicio es un campo del **payload del evento
de canje de puntos**, que traduce puntos a pesos (`puntosUsados * VALOR_DEL_PUNTO`)
para quien lleve la cuenta de la fidelización. El descuento comercial —la
promoción del martes, el 10 % del cliente fiel— no se guarda en ninguna parte, y
la propuesta necesita migración igual que las otras dos.

**Propuesta, por orden de coste/beneficio.**

1. **Descuento**: importe o porcentaje, con motivo. Dos columnas en `payments` y
   el campo en el formulario. Recupera un dato que el negocio hoy pierde entero:
   cuánto descontó y por qué. Hay un precedente cerca —el canje de puntos ya
   rebaja el importe— del que conviene no separarse: que el descuento comercial y
   el de puntos se sumen de forma legible en el mismo cobro.
2. **Pago mixto**: «te doy 20.000 en efectivo y el resto con tarjeta». Es el más
   caro de los tres porque rompe la forma del cobro: hoy `method` es una columna,
   y pasa a ser una lista de importes por método. Toca el arqueo de caja (solo la
   parte en efectivo entra al cajón), el resumen diario y los informes por método.
   A cambio, deja de hacer falta inventar dos cobros sueltos, que es lo que hoy
   hace mentir al conteo de ventas del día.
3. **Propina**: línea aparte que **no** cuenta como ingreso del negocio. Duele
   sobre todo con datáfono, porque el dinero entra al negocio y hay que sacarlo
   para el profesional; sin esto, o se le regala al negocio o se apunta en papel.

**Qué hay que decidir.** Si se hacen los tres o solo el descuento. Si la propina
se liquida por profesional —y entonces hace falta saber a quién va, lo que la
encadena con las comisiones, que están documentadas como ausentes—. Y si el
descuento lo puede aplicar recepción o necesita permiso.

---

## 9 · BS-025 · Aviso de edición simultánea

**Qué hay hoy.** La versión mínima, ya en producción: la ficha de cliente envía
**solo los campos modificados** (`cambiosDelCliente`), así que guardar el nombre
desde una pestaña vieja ya no revierte el teléfono que otra acaba de guardar. El
choque queda acotado a que dos personas toquen **el mismo campo**, y en ese caso
la última sigue ganando en silencio.

**Propuesta.** Control de concurrencia optimista: el cliente envía el `updatedAt`
que cargó, el servicio compara y responde **409** si ya no coincide, ofreciendo
recargar. La columna existe en todas las entidades (`BaseEntity`) y `ApiError` ya
lleva el `status`, así que la interfaz puede distinguir el 409 de cualquier otro
error sin tocar el cliente HTTP.

**Qué hay que decidir.** Es transversal, y ahí está el coste: hacerlo en Clientes
es media tarde, hacerlo en todo el panel son muchas rutas y muchos formularios, y
hacerlo a medias es peor que no hacerlo —el usuario aprende que el producto avisa
y confía en que avisará siempre—. La decisión es **dónde duele de verdad**: la
ficha de cliente y la de servicios (precios) son candidatas; la configuración del
negocio, que edita una sola persona, probablemente no.

**Cómo se sabe que sirvió.** Nadie se entera de que el teléfono era el viejo
cuando ya está llamando al cliente.

---

## Lo que no está aquí

Dos cosas que el informe menciona y no tienen ficha propia, por si se quieren
recoger al planificar:

- **Comisiones por profesional.** Documentadas como ausentes y no evaluadas en la
  campaña. Es la pareja natural de BS-006: si el precio varía por profesional, el
  paso siguiente es liquidar lo que le corresponde. Y es lo que BS-005 necesita
  para poder repartir la propina.
- **La fidelización funciona y nadie la está contando.** Los puntos se acumulan
  solos y hay niveles configurables, pero en el panel del negocio no aparecen
  fuera de Configuración. Es una función de retención ya construida y sin
  escaparate — el mismo patrón que BS-002, BS-003 y BS-006, ya resueltos, que con
  ella son cuatro de los nueve hallazgos de este documento.
