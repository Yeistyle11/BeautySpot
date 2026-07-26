import { isApiError } from "./api-error";

/** Mensajes por código de estado, cuando el del backend no le dice nada al usuario. */
const POR_ESTADO: Record<number, string> = {
  403: "No tienes permisos para hacer esto.",
  404: "No se encontró lo que buscabas. Puede que otra persona lo haya eliminado.",
  409: "Ese dato ya existe. Revisa los campos e inténtalo de nuevo.",
  502: "El servicio no está disponible ahora mismo. Vuelve a intentarlo en un momento.",
  503: "El servicio no está disponible ahora mismo. Vuelve a intentarlo en un momento.",
  504: "La operación tardó demasiado. Vuelve a intentarlo.",
};

/**
 * Texto que se le muestra al usuario ante un error de la API.
 *
 * Los mensajes de validación del backend son concretos y útiles —"la categoría
 * no existe", "el correo ya está registrado"—, así que se respetan tal cual. Los
 * de un fallo de infraestructura describen el sistema, no lo que el usuario
 * puede hacer, y para esos hay un texto propio por código de estado.
 */
export function mensajeDeError(error: unknown): string {
  if (isApiError(error)) {
    const propio = POR_ESTADO[error.status];
    if (propio) return propio;
    if (error.message) return error.message;
  }

  if (error instanceof Error && error.message) {
    // Un fallo de red llega como TypeError de fetch; su texto ("Failed to
    // fetch") no orienta a nadie.
    if (error.name === "TypeError") {
      return "No se pudo conectar con el servidor. Comprueba tu conexión.";
    }
    return error.message;
  }

  return "Ocurrió un error inesperado. Vuelve a intentarlo.";
}
