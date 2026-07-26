import { isApiError } from "./api-error";

/** Texto para los fallos de infraestructura, donde el del backend no orienta. */
const POR_ESTADO_SERVIDOR: Record<number, string> = {
  500: "Algo falló en el servidor. Vuelve a intentarlo en un momento.",
  502: "El servicio no está disponible ahora mismo. Vuelve a intentarlo en un momento.",
  503: "El servicio no está disponible ahora mismo. Vuelve a intentarlo en un momento.",
  504: "La operación tardó demasiado. Vuelve a intentarlo.",
};

/** Texto para los 4xx cuyo mensaje es la frase HTTP y no dice nada. */
const POR_ESTADO_CLIENTE: Record<number, string> = {
  403: "No tienes permisos para hacer esto.",
  404: "No se encontró lo que buscabas. Puede que otra persona lo haya eliminado.",
  409: "Ese dato ya existe. Revisa los campos e inténtalo de nuevo.",
};

/**
 * Frases que devuelve el propio protocolo cuando nadie ha redactado un mensaje.
 * Traducen el código de estado, no lo que ha pasado.
 */
const OPACOS = new Set([
  "bad request",
  "unauthorized",
  "forbidden",
  "not found",
  "conflict",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "gateway timeout",
]);

const GENERICO = "Ocurrió un error inesperado. Vuelve a intentarlo.";

/**
 * Texto que se le muestra al usuario ante un error de la API.
 *
 * En los 4xx manda el mensaje del backend: describe el caso concreto —«la
 * categoría "Barbero" ya existe», «el correo ya está registrado»— y con eso el
 * usuario sabe qué corregir. Sólo cuando ese mensaje es la frase seca del
 * protocolo se sustituye por uno propio.
 *
 * En los 5xx manda el texto propio: el del backend nombra servicios y detalles
 * internos sobre los que quien usa la aplicación no puede actuar.
 */
export function mensajeDeError(error: unknown): string {
  if (isApiError(error)) {
    if (error.status >= 500) {
      return POR_ESTADO_SERVIDOR[error.status] ?? GENERICO;
    }

    const mensaje = error.message?.trim();
    if (mensaje && !OPACOS.has(mensaje.toLowerCase())) return mensaje;

    return POR_ESTADO_CLIENTE[error.status] ?? GENERICO;
  }

  if (error instanceof Error) {
    // Un fallo de red llega como TypeError de fetch; "Failed to fetch" no
    // orienta a nadie.
    if (error.name === "TypeError") {
      return "No se pudo conectar con el servidor. Comprueba tu conexión.";
    }
    if (error.message?.trim()) return error.message;
  }

  return GENERICO;
}
