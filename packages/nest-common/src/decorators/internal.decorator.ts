import { SetMetadata } from "@nestjs/common";

/** Clave de metadata que marca un endpoint como servicio-a-servicio. */
export const IS_INTERNAL_KEY = "isInternal";

/** Prefijo bajo el que cuelgan los endpoints internos. */
export const PREFIJO_INTERNO = "/internal";

/**
 * Marca un controlador como interno: solo se entra con el secreto compartido,
 * y no se le exige token de usuario ni cabecera de negocio.
 *
 * Los guards reconocen un endpoint interno por este decorador **o** por el
 * prefijo de la ruta. Con los dos caminos, ni renombrar una ruta desprotege un
 * controlador ni olvidar el decorador lo deja fuera del secreto.
 */
export const Internal = () => SetMetadata(IS_INTERNAL_KEY, true);
