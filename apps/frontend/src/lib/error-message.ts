import { ZodError } from "zod";
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

/** Texto para un desajuste de schema, cuyo `message` es un volcado de Zod. */
const CONTRATO =
  "La respuesta del servidor no tiene el formato esperado. Avisa al equipo si se repite.";

/**
 * Texto que se le muestra al usuario ante un error de la API: el mensaje del
 * backend en los 4xx y un texto propio en los 5xx y en los fallos de red.
 */
export function mensajeDeError(error: unknown, respaldo = GENERICO): string {
  if (error instanceof ZodError) return CONTRATO;

  if (isApiError(error)) {
    if (error.status >= 500) {
      return POR_ESTADO_SERVIDOR[error.status] ?? respaldo;
    }

    // El backend enumera qué campos fallaron; el mensaje que los acompaña
    // ("Error de validación") solo repite el código de estado.
    if (error.detalles.length > 0) return error.detalles.join(". ");

    const mensaje = error.message?.trim();
    if (mensaje && !OPACOS.has(mensaje.toLowerCase())) return mensaje;

    return POR_ESTADO_CLIENTE[error.status] ?? respaldo;
  }

  if (error instanceof Error) {
    // Un fallo de red llega como TypeError de fetch, con el mensaje del
    // navegador ("Failed to fetch").
    if (error.name === "TypeError") {
      return "No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo.";
    }
    if (error.message?.trim()) return error.message;
  }

  return respaldo;
}
