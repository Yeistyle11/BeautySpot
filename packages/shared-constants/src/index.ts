// ─── Proxy ─────────────────────────────────────────────────────────

/** Tiempo máximo (ms) que el gateway espera la respuesta de un servicio antes de abortar. */
export const PROXY_TIMEOUT_MS = 10_000;

// ─── Rate Limiting ─────────────────────────────────────────────────

/** Máximo de peticiones a rutas de autenticación por ventana (más estricto por seguridad). */
export const RATE_LIMIT_AUTH_REQUESTS = 5;
/** Máximo de peticiones a rutas generales por ventana. */
export const RATE_LIMIT_GENERAL_REQUESTS = 100;
/** Duración (segundos) de la ventana deslizante del rate limiting. */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

// ─── Reglas de negocio ─────────────────────────────────────────────

/** Horas mínimas de antelación para cancelar o reagendar una cita sin coste. */
export const HORAS_MINIMAS_CANCELACION = 2;

/** Proporción del importe de la cita que se convierte en puntos de fidelidad. */
export const PROPORCION_PUNTOS_FIDELIDAD = 0.1;

/** IVA colombiano que se aplica al facturar. */
export const IVA = 0.19;

/** Validez (segundos) de las URLs prefirmadas de subida y descarga de imágenes. */
export const URL_PREFIRMADA_SEGUNDOS = 3600;

// ─── Validación de datos de contacto ───────────────────────────────

/**
 * Teléfono aceptado: entre 7 y 20 dígitos, con el prefijo internacional y los
 * separadores habituales opcionales. Es deliberadamente permisiva —los formatos
 * varían por país— pero descarta el texto libre.
 */
export const PATRON_TELEFONO = /^\+?[\d][\d\s().-]{5,19}$/;

/** Mensaje único para el teléfono, para que todos los formularios digan lo mismo. */
export const MENSAJE_TELEFONO =
  "El teléfono debe tener entre 7 y 20 dígitos, con prefijo internacional opcional";

/** Horas que vale el enlace de confirmación de correo. */
export const HORAS_VERIFICACION_CORREO = 24;

/** Fallos de contraseña seguidos que bloquean la cuenta. */
export const MAX_INTENTOS_FALLIDOS = 5;

/** Minutos que dura el primer bloqueo; los siguientes doblan la espera. */
export const BLOQUEO_BASE_MINUTOS = 15;

/** Tope de la espera, para que un bloqueo no se vuelva permanente. */
export const BLOQUEO_MAXIMO_MINUTOS = 24 * 60;

/** Longitud mínima de una contraseña. */
export const LONGITUD_MINIMA_CONTRASENA = 10;

/** Contraseña aceptada: al menos una minúscula, una mayúscula y un dígito. */
export const PATRON_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

/** Mensaje único para la contraseña, para que todos los formularios digan lo mismo. */
export const MENSAJE_CONTRASENA =
  "La contraseña debe combinar mayúsculas, minúsculas y números";

/**
 * Contraseñas descartadas por comunes. La lista es corta a propósito: cubre lo
 * que aparece primero en cualquier ataque de diccionario sin pretender ser un
 * catálogo, que es trabajo de un servicio dedicado.
 */
export const CONTRASENAS_PROHIBIDAS = [
  "password",
  "contrasena",
  "contraseña",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "beautyspot",
  "administrador",
];
