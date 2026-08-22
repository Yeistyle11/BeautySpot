import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { timingSafeEqual } from "crypto";
import { esContextoHttp } from "./http-context";
import { esRutaInterna } from "./internal-context";

/** Header que transporta el secreto compartido en las llamadas internas entre servicios. */
export const INTERNAL_API_SECRET_HEADER = "x-internal-secret";

/**
 * Protege los endpoints internos (`/internal/*`) exigiendo un secreto compartido.
 * La comparación usa {@link timingSafeEqual} para no filtrar información por el
 * tiempo de respuesta (ataques de temporización). El resto de rutas pasa sin tocar.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector
  ) {}

  /** Deja pasar solo las rutas /internal que traen el secreto correcto. */
  canActivate(context: ExecutionContext): boolean {
    if (!esContextoHttp(context)) return true;

    if (!esRutaInterna(context, this.reflector)) return true;

    const request = context.switchToHttp().getRequest();
    const secret = request.headers[INTERNAL_API_SECRET_HEADER];
    const expected = this.configService.get<string>("INTERNAL_API_SECRET");

    if (!this.isValidSecret(secret, expected)) {
      throw new ForbiddenException("Acceso denegado al endpoint interno");
    }

    return true;
  }

  /** Compara el secreto recibido con el configurado. */
  private isValidSecret(
    secret: unknown,
    expected: string | undefined
  ): boolean {
    if (!expected || typeof secret !== "string" || secret.length === 0) {
      return false;
    }
    const secretBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(expected);
    if (secretBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(secretBuffer, expectedBuffer);
  }
}
