# Auditoría técnica

Estado del proyecto en arquitectura, seguridad, rendimiento, calidad de código e
interfaz, **medido contra el código el 11 de agosto de 2026**.

Las cifras de este documento se obtuvieron contando y ejecutando, no leyendo otros
documentos. Caducan: al volver a mirar, hay que volver a medir. Los comandos que
las producen están junto a cada una.

**Resumen**: el proyecto está sano. La arquitectura es coherente y tiene tomadas
las decisiones difíciles; la calidad de código es alta y está sostenida por tests
que prueban lo que importa. El único riesgo de severidad alta **no está en el
código propio sino en una dependencia**: Next.js 14.2.35, y de sus 21 avisos hay
uno alcanzable por diseño en esta aplicación.

---

## 1. Seguridad

### 1.1 Dependencias — el punto rojo

```bash
npm audit --omit=dev
```

**6 vulnerabilidades: 5 altas y 1 moderada.** Ninguna es de código propio.

| Paquete           | Severidad       | ¿Explotable aquí?                                        |
| ----------------- | --------------- | -------------------------------------------------------- |
| `next` 14.2.35    | alta, 21 avisos | **Parcialmente sí** — ver 1.2                            |
| `postcss`         | alta            | No: solo interviene en build                             |
| `nanoid`          | alta            | No: transitiva de Next, no se alcanza desde una petición |
| `brace-expansion` | alta            | No: herramienta de build                                 |
| `picomatch`       | alta            | No: herramienta de build                                 |
| `typeorm` 0.3.30  | moderada        | No en producción: es `migration:generate`, de desarrollo |

Los cuatro que solo intervienen en build se arreglan con `npm audit fix` sin
ruptura. El de TypeORM afecta a un comando que ejecuta un desarrollador sobre su
propia plantilla.

### 1.2 Next.js: qué aplica y qué no

De los 21 avisos, **la mayoría no aplican a esta aplicación**, y conviene dejarlo
por escrito para no reaccionar al número:

| Familia de aviso                           | ¿Aplica? | Por qué                                            |
| ------------------------------------------ | -------- | -------------------------------------------------- |
| Server Actions (DoS, SSRF, payload)        | **No**   | 0 usos de `"use server"` en todo el frontend       |
| Middleware bypass en Pages Router con i18n | **No**   | Se usa App Router y no hay i18n                    |
| XSS con nonces de CSP                      | **No**   | La CSP no usa nonces (ver 1.4)                     |
| SSRF en rewrites por destino controlado    | **No**   | El `destination` es un literal en `next.config.js` |
| **Optimizador de imágenes (DoS, caché)**   | **Sí**   | Ver abajo                                          |
| Cache poisoning en respuestas RSC          | Parcial  | Aplica al App Router en general                    |

El que importa, y no es casualidad. `apps/frontend/next.config.js:11-22` declara:

```js
const IMAGE_HOSTS = [
  "images.unsplash.com", "res.cloudinary.com",
  "*.googleusercontent.com", "*.amazonaws.com",
  "*.supabase.co", "*.cloudfront.net", ...
];
```

Los comodines están ahí **a propósito**: las fotos (logo, portada, galería, foto
del profesional) se guardan como una URL que teclea el propio negocio. Es decir,
**hay entrada de usuario alimentando al optimizador de imágenes**, que es
exactamente el escenario de los avisos «DoS via Image Optimizer remotePatterns
configuration» y «Unbounded next/image disk cache growth can exhaust storage».

Mitigación de fondo, además de subir de versión: acotar los comodines a los hosts
que se usen de verdad.

### 1.3 Lo que está bien resuelto

No tocar sin motivo:

- **Cookies de sesión** (`services/api-gateway/src/modules/session/session-cookies.ts`):
  `httpOnly`, `SameSite=Lax`, `Secure` en producción, y el refresh acotado con
  `path=/api/v1/auth/refresh` para que no viaje en cada petición.
- **CSRF por origen** (`session/csrf-origin.guard.ts`): solo exige origen cuando
  la petición es **mutante y viene autenticada por cookie**; las de
  `Authorization` pasan sin comprobación, que es lo correcto. Valida contra la
  misma lista que gobierna CORS.
- **Rotación de refresh con detección de reuso** (`auth.service.ts`): cada refresh
  lleva su `jti` y canjearlo lo retira del conjunto de vivos. Presentar uno ya
  gastado **revoca todas las sesiones del usuario**.
- **Revocación inmediata de JWT**: `tokenVersion` en Redis comparado en cada
  petición, en vez de una lista negra token a token.
- **Rate limit** (`rate-limit/rate-limit.guard.ts`): por IP **y por cuenta
  objetivo** en las rutas de credenciales, de modo que un ataque distribuido
  contra un mismo correo se frena aunque cada intento venga de otra IP. El
  contador es un script Lua con `INCR`+`EXPIRE` atómicos: por separado, morir
  entre ambos deja la clave sin TTL y bloquea a esa IP para siempre.
- **Bloqueo de cuenta** con espera que se dobla en cada bloqueo encadenado, hasta
  24 h.
- **Aislamiento de tenant** (`BusinessScopeGuard`): comprueba que el negocio
  pedido esté entre los del token, no solo que la cabecera exista.
- **Arranque** (`validarEntorno`): un servicio mal configurado muere antes de
  aceptar tráfico, en vez de fallar petición a petición.
- `helmet`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` y HSTS.

### 1.4 Pendientes conocidos

- **La CSP va en `Report-Only`** (`next.config.js:36-38`). Es deliberado: Next
  inyecta scripts y estilos en línea, y aplicarla en bloqueo exige propagar un
  nonce por todo el árbol. En Report-Only se ve qué rompería sin romper nada.
- **No se puede crear un `SUPER_ADMIN`.** El rol existe y los guards lo
  comprueban, pero `memberships.business_id` es `NOT NULL` y el rol sale de la
  primera membresía activa. Asignarlo pide cambio de modelo.

---

## 2. Arquitectura

Es la parte más sólida, y no por el reparto en microservicios —eso es una
decisión de forma— sino por tres decisiones de fondo que a esta altura suelen
faltar:

1. **Outbox transaccional completo.** El evento se escribe en la misma transacción
   que el cambio (auth, core, booking, marketplace, payment) y el consumidor lo
   descarta si ya lo aplicó (`processed_events` en core, booking, notification,
   analytics). El par emisor/receptor está cerrado, no a medias.
2. **Las invariantes viven en la base.** Caja única abierta por sede, cobro único
   vivo por cita, reseña única por cita y número de factura por negocio son
   **índices únicos parciales**, no comprobaciones en código. La comprobación en
   código da el mensaje legible; el índice da la garantía. Cada uno tiene su test
   de integración.
3. **El gateway no autoriza.** Enruta con un comodín (`@All(":service/*splat")`) y
   deja `@Roles` a cada servicio. La alternativa —una tabla de permisos en el
   borde— se desincroniza de los controladores a la primera.

### Deuda arquitectónica

| Qué                                             | Tamaño | Por qué importa                                                                                                    |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `notification/event-listeners.service.ts`       | 35 KB  | Un handler por evento en un solo fichero: una razón para existir, cinco para cambiar. Pide partirse por dominio    |
| `booking/appointments.service.ts`               | 30 KB  | Ya se partió una vez (disponibilidad y política salieron); vigilarlo                                               |
| Filtro de tenant **explícito** en cada consulta | —      | No hay interceptor que lo inyecte: olvidarlo en una consulta nueva es un fallo de aislamiento que hoy nada detecta |

---

## 3. Rendimiento

### Lo que está cuidado

- **La agenda del día se resuelve en dos consultas fijas**
  (`availability-query.service.ts`), independientemente del tamaño del equipo. El
  coste no crece con el número de profesionales.
- **La paginación está acotada** (`parsePaginationQuery`): `limit` a 100 y `page`
  a 1000. Sin el tope de página, un `?page=500000&limit=100` genera un `OFFSET` de
  50 millones que Postgres lee y descarta entero.
- **Índices para los patrones reales**, incluido uno **parcial** para el worker de
  recordatorios (`idx_appointments_recordatorios`), que busca por fecha sin acotar
  por negocio y al que ningún otro índice le servía.
- **Caché en Redis** de lo que se consulta en cada petición y cambia poco: huso
  del negocio (1 h), horario de apertura (10 min), resolución de tenant (5 min).
- El frontend carga la vista día y el calendario con `dynamic()`, así que no pesan
  en el arranque. Bundle compartido: **87,5 kB**.

### Puntos flojos

1. **`analytics/capacidad.worker.ts:70-88`**: una llamada HTTP **por (negocio,
   día) en serie**, y una escritura por profesional dentro. Con cien negocios
   activos son cien llamadas secuenciales por ciclo. Es un worker de fondo, así
   que no afecta a la latencia percibida, pero es el primer sitio que se hará
   lento al crecer.
2. **51 `findAndCount` frente a 9 `paginate`**: la mayoría están acotados, pero
   conviene barrer que ninguno liste sin límite.

---

## 4. Calidad de código

Medido sobre **575 ficheros de producción** (excluidos tests):

| Métrica                      | Valor                                     |
| ---------------------------- | ----------------------------------------- |
| `TODO`                       | 4                                         |
| `FIXME`                      | 0                                         |
| `as any`                     | 3 (2 en el bus de eventos, 1 en un setup) |
| `eslint-disable`             | 3                                         |
| Tests unitarios              | 1856 en 134 suites                        |
| Tests de integración         | 75 en 25 suites                           |
| Cobertura (gate 92/80/80/93) | 92,41 / 81,51 / 84,15 / 93,76             |

`no-explicit-any` es **error** en código de producción y está desactivado solo en
tests, donde los mocks lo usan legítimamente. El gate de cobertura rompe la build,
así que no es decorativo.

Lo que no sale en las métricas y sostiene el conjunto: los comentarios explican
**por qué**, no qué; y hay una regla aplicada de forma consistente —**cada
invariante que un repositorio simulado no puede observar tiene un test de
integración**—. De ahí salen las 10 suites que prueban transacciones, índices y
concurrencia contra Postgres real.

---

## 5. Interfaz

### Lo que está bien

- **Un solo cliente HTTP** (`lib/api.ts`) que parsea defensivamente (un 502
  devuelve HTML, un 204 no devuelve nada) y ante un 401 dispara **una sola
  renovación compartida** para todas las peticiones caducadas a la vez.
- **Validación Zod en tiempo de ejecución** de todo lo que llega del backend
  (`lib/swr.ts`), no solo tipos de compilación.
- Hooks reutilizados (`use-crud-resource`, `use-paginated-list`) en vez de
  reimplementar create/update/delete en cada pantalla.
- Estados de carga, error y vacío con componente propio (`Spinner`,
  `ErrorDeCarga`, `EmptyState`), usados de forma consistente.
- Accesibilidad razonable para el tamaño: **80 `aria-label`, 50 otros `aria-*`, 40
  `role` y 8 `sr-only`** en 121 componentes. 78 usos de breakpoints responsive.

### Defecto encontrado

`apps/frontend/src/app/dashboard/appointments/page.tsx:152`

```ts
const { data: clientsPage } = useApi(showForm ? CLIENTS_KEY : null, ...);
```

La lista de clientes **solo se pide al abrir el formulario de crear cita**, pero
`clientMap` (línea 178) alimenta el nombre del cliente en la lista, en el
calendario y en la vista día. Con el formulario cerrado —el estado normal— **la
agenda muestra «Cliente» en lugar del nombre**.

Y aunque se abra: la petición va **sin `limit`**, así que trae la primera página
de 20. En un negocio con más de 20 clientes, la mayoría de las citas se queda sin
nombre igualmente.

### Ausencias de producto

- **No hay modo oscuro**: 2 usos de `dark:` en 121 ficheros.
- No hay PWA ni push, pese a estar en la definición de MVP.

---

## 6. Qué hacer, por orden

1. **Subir a Next 15** y acotar los comodines de `remotePatterns`. Es el único
   hallazgo con exposición real a internet.
2. **Los nombres de cliente en la agenda** y el worker de capacidad.
3. **Partir `event-listeners.service.ts`**, barrer los `findAndCount` sin límite y
   decidir qué hacer con el filtro de tenant explícito: aceptarlo con un test que
   lo vigile, o automatizarlo en el repositorio base.

Fuera de esta lista, y conscientemente: la CSP en `Report-Only` (conviene
decidirla **después** de subir Next, que cambia cómo se inyectan los scripts), el
`SUPER_ADMIN` y el modo oscuro.
