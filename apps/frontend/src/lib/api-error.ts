/**
 * Error de una respuesta HTTP no-2xx del gateway. Lleva el `status` ademas del
 * mensaje porque quien decide que hacer (desloguear en 401, avisar de permisos
 * en 403, reintentar o no) necesita el codigo, no el texto: el mensaje lo
 * redacta el backend y cambia segun el servicio y el idioma.
 */
export class ApiError extends Error {
  readonly status: number;

  /**
   * Motivos concretos de un fallo de validación, tal como los enumera el
   * backend en `error.details.validation`. Sin ellos, un 400 solo puede
   * mostrarse como "Error de validacion", que no dice qué campo corregir.
   */
  readonly detalles: string[];

  constructor(status: number, message: string, detalles: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detalles = detalles;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** 401/403: la sesion no sirve o no alcanza; reintentar no cambia el resultado. */
export function isAuthError(err: unknown): boolean {
  return isApiError(err) && (err.status === 401 || err.status === 403);
}

/**
 * 404: lo que se pide no existe. Reintentar no lo crea, así que quien llama
 * suele querer ofrecer crearlo en vez de un botón de "Reintentar".
 */
export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.status === 404;
}
