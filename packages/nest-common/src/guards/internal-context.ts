import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  IS_INTERNAL_KEY,
  PREFIJO_INTERNO,
} from "../decorators/internal.decorator";
import { esContextoHttp } from "./http-context";

/**
 * Si la petición va a un endpoint servicio-a-servicio, sea por el decorador
 * `@Internal()` o por el prefijo de la ruta. La comparten los tres guards que lo
 * necesitan, para que no dependa de tres cadenas escritas igual.
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
