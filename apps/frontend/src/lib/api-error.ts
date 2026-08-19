/**
 * Error de una respuesta HTTP no-2xx del gateway, con el `status` ademas del
 * mensaje.
 */
export class ApiError extends Error {
  readonly status: number;

  /**
   * Motivos concretos de un fallo de validacion, tal como los enumera el
   * backend en `error.details.validation`.
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

/** 404: lo que se pide no existe. */
export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.status === 404;
}
