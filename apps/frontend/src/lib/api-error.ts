/**
 * Error de una respuesta HTTP no-2xx del gateway. Lleva el `status` ademas del
 * mensaje porque quien decide que hacer (desloguear en 401, avisar de permisos
 * en 403, reintentar o no) necesita el codigo, no el texto: el mensaje lo
 * redacta el backend y cambia segun el servicio y el idioma.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** 401/403: la sesion no sirve o no alcanza; reintentar no cambia el resultado. */
export function isAuthError(err: unknown): boolean {
  return isApiError(err) && (err.status === 401 || err.status === 403);
}
