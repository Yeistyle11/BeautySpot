import { SetMetadata } from "@nestjs/common";

/** Clave de metadata que marca un endpoint como servicio-a-servicio. */
export const IS_INTERNAL_KEY = "isInternal";

/** Prefijo bajo el que cuelgan los endpoints internos. */
export const PREFIJO_INTERNO = "/internal";

/**
 * Marca un controlador como interno: se entra con el secreto compartido y sin
 * token de usuario. Los guards lo reconocen por este decorador o por el prefijo
 * de la ruta, así que ni renombrarla ni olvidarlo lo desprotegen.
 */
export const Internal = () => SetMetadata(IS_INTERNAL_KEY, true);
