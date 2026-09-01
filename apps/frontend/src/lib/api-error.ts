import { CODIGO_EDICION_SIMULTANEA } from "@beautyspot/shared-constants";

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

  /**
   * Codigo del sobre de error (`error.code`), con el que el backend distingue
   * dos fallos que comparten estado. `null` cuando la respuesta no lo trae.
   */
  readonly codigo: string | null;

  constructor(
    status: number,
    message: string,
    detalles: string[] = [],
    codigo: string | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detalles = detalles;
    this.codigo = codigo;
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

/**
 * 409 de edicion simultanea: lo que se estaba editando cambio mientras tanto.
 * Se resuelve recargando, no corrigiendo el formulario, asi que se distingue
 * del otro 409, el del dato que ya existe.
 */
export function esConflictoDeEdicion(err: unknown): boolean {
  return isApiError(err) && err.codigo === CODIGO_EDICION_SIMULTANEA;
}
