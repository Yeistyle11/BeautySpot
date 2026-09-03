# @beautyspot/seed

Siembra el entorno de desarrollo con dos negocios, seis cuentas —una por rol— y
la actividad suficiente para que agenda, caja, facturas, escaparate y métricas
tengan algo que enseñar.

Cierra **H-000**, el hallazgo de proceso de la campaña anterior: sin datos de
prueba no se puede hacer QA reproducible ni ejercitar de forma rutinaria el
aislamiento multi-tenant, que es el riesgo número uno de un SaaS como este.

## Uso

```bash
npm run docker:up          # Postgres en el 5433
npm run seed               # siembra, o resiembra sobre lo ya sembrado
npm run seed -- --limpiar  # borra lo sembrado y lo vuelve a sembrar
npm run seed -- --ayuda    # el resto de opciones
```

No hace falta tener los servicios levantados: escribe en las seis bases
directamente y deriva el esquema de las entidades, igual que hace cada servicio
fuera de producción, así que también funciona sobre un volumen recién creado.

```bash
npm run seed:comprobar     # sin base de datos: valida el mapeo y el escenario
```

La guarda cubre las dos formas en que esto se rompe solo. Una es **una columna
renombrada en un servicio**: las filas se construyen con `Object.assign`, y una
propiedad que ya no existe no da error —se descarta en silencio y el campo se
escribe vacío—, así que cada clave se compara contra los metadatos reales de su
entidad. La otra es **un escenario incoherente**: citas de un profesional que se
solapan, un cobro que no cuadra con su reparto, una caja cuyo total esperado no
sale de sus movimientos. La base aceptaría todo eso sin rechistar y el descuadre
aparecería después, en el panel, pareciendo un fallo del producto.

## Lo que deja

| Cuenta                     | Rol            | Negocio           |
| -------------------------- | -------------- | ----------------- |
| `owner@beautyspot.local`   | `OWNER`        | Barbería La Noche |
| `admin@beautyspot.local`   | `ADMIN`        | Barbería La Noche |
| `pro@beautyspot.local`     | `PROFESSIONAL` | Barbería La Noche |
| `recep@beautyspot.local`   | `RECEPTIONIST` | Barbería La Noche |
| `cliente@beautyspot.local` | `CLIENT`       | —                 |
| `ownerb@beautyspot.local`  | `OWNER`        | Spa Aurora        |

Contraseña común: `Prueba2026!`. Todas nacen con el correo verificado, porque el
login lo exige y el alta normal no lo marca.

El cliente final **no tiene membresía a propósito**: así su token sale como
`CLIENT` y sin `businessId`, que es la situación real de quien reserva por el
escaparate.

Dos negocios, con identificador fijo para poder escribir el ajeno en una URL y
comprobar que los guardias de tenant responden:

| Negocio           | Identificador                          | Slug                |
| ----------------- | -------------------------------------- | ------------------- |
| Barbería La Noche | `632f8391-d9ba-4d76-bc2c-1d20dae78ff6` | `barberia-la-noche` |
| Spa Aurora        | `0878891c-9bf9-4d28-8d28-ba5cdb3b6f69` | `spa-aurora`        |

Y unos dos meses de historia más una semana de agenda por delante: citas en
todos sus estados, cobros —con reparto entre medios, descuento y propina—, una
caja por sede y día (cerradas las pasadas, abierta la de hoy, alguna
descuadrada a la baja), facturas, bloqueos de agenda, perfiles publicados con
reseñas y las métricas agregadas que corresponden.

El tenant B lleva mucho menos volumen a propósito: existe para probar el
aislamiento, no para duplicar el escenario.

## Cómo está hecho

- **Repetible sin borrar nada.** Cada identificador se deriva del nombre de la
  cosa (`idDe`, un UUID v5), así que la segunda pasada reescribe las mismas
  filas en lugar de duplicarlas, y los identificadores que alguien apunte en un
  informe de QA siguen valiendo mañana.
- **Determinista.** El reparto de citas, importes y valoraciones sale de un
  generador con semilla fija, no de `Math.random`: dos ejecuciones producen el
  mismo escenario, así que un fallo que aparece con estos datos se le puede
  pedir a otra persona sin adjuntarle un volcado.
- **El catálogo no se inventa.** Sale de `plantillaDe(tipo)`, la misma plantilla
  con la que nace un negocio real, así que la barbería sembrada tiene los
  servicios y las horas que tendría recién dada de alta.
- **No borra lo que no es suyo.** `--limpiar` alcanza solo a los dos negocios
  sembrados y a sus seis cuentas; lo que haya escrito otra persona en la base de
  desarrollo se queda donde está.
- **Se niega a correr donde no debe.** Con `NODE_ENV=production`, o contra una
  base que no sea local sin `--forzar`.

### Por qué escribe en la base y no por la API

Ir por el gateway reutilizaría las reglas de negocio, pero el login exige
`emailVerified` y el alta no lo marca: para entrar con el dueño habría que
tocar la base igualmente —o leer el token de verificación en claro, que es el
H-008 que se corrigió—. Además la API no deja fijar los identificadores que los
documentos de QA ya citan.

El precio de escribir directamente es que **no pasa por el bus**: los eventos no
se emiten, así que ningún servicio reacciona a lo sembrado. Por eso las métricas
se calculan aquí, con los criterios del servicio —el ingreso sin la propina,
`ventas` contando cobros y no citas, la fecha del cobro y no la de proceso—, y
salen cuadradas por construcción con las citas y los cobros que las acompañan.
