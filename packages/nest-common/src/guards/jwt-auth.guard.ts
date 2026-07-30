import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { SESION_VERIFICABLE_KEY } from "../decorators/sesion-verificable.decorator";
import { esContextoHttp } from "./http-context";
import { assertJwtSecret } from "../security/assert-jwt-secret";
import {
  TokenVersionStore,
  TOKEN_VERSION_DEFAULT,
} from "../security/token-version.store";

/**
 * Verifica el JWT (HS256) de cada petición y publica el usuario en `request.user`.
 *
 * Deja pasar las rutas marcadas con @Public, `/health` y las internas `/internal`.
 * Además de validar firma y expiración, compara la `tokenVersion` del token con la
 * almacenada para poder invalidar sesiones remotamente (logout global, cambio de
 * contraseña); si no coinciden, la sesión se considera revocada.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
    private readonly tokenVersionStore: TokenVersionStore
  ) {}

  /** Indica si la ruta exige poder comprobar que la sesión sigue vigente. */
  private exigeSesionVerificable(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(SESION_VERIFICABLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  /** Exige un token válido y vigente, salvo en las rutas públicas. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    if (!esContextoHttp(context)) return true;

    const request = context.switchToHttp().getRequest();
    if (request.url === "/health" || request.url.startsWith("/internal"))
      return true;

    const authHeader = request.headers["authorization"];
    if (!authHeader) {
      throw new UnauthorizedException("Token no proporcionado");
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    const secret = assertJwtSecret(
      this.configService.get<string>("JWT_SECRET"),
      "JWT_SECRET"
    );

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }

    if (decoded.sub) {
      const esperada = decoded.tokenVersion ?? TOKEN_VERSION_DEFAULT;
      const actual = await this.tokenVersionStore.consultarVersion(decoded.sub);

      if (!actual.conocida) {
        // No se pudo comprobar si la sesión sigue vigente. Se deja pasar salvo
        // en las acciones marcadas como verificables, donde actuar con una
        // sesión quizá revocada causa un daño que no se deshace.
        if (this.exigeSesionVerificable(context)) {
          throw new ServiceUnavailableException(
            "No se puede verificar la sesión en este momento; reintenta en unos segundos"
          );
        }
      } else if (actual.version !== esperada) {
        throw new UnauthorizedException("Sesión invalidada");
      }
    }

    request.user = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      businessId: decoded.businessId,
      businessIds: decoded.businessIds,
    };
    return true;
  }
}
