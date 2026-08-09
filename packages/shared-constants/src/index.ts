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
