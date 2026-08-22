import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  IS_INTERNAL_KEY,
  PREFIJO_INTERNO,
} from "../decorators/internal.decorator";
import { esContextoHttp } from "./http-context";

/**
 * Si la petición va a un endpoint servicio-a-servicio.
 *
 * Lo decide el decorador `@Internal()` o el prefijo de la ruta, indistintamente:
 * los tres guards que necesitan saberlo comparten esta función para que la
 * respuesta no dependa de que tres ficheros escriban la misma cadena.
 */
export function esRutaInterna(
  context: ExecutionContext,
  reflector: Reflector
): boolean {
  const marcada = reflector.getAllAndOverride<boolean>(IS_INTERNAL_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (marcada === true) return true;

  if (!esContextoHttp(context)) return false;

  const url = context.switchToHttp().getRequest().url;
  return typeof url === "string" && url.startsWith(PREFIJO_INTERNO);
}
