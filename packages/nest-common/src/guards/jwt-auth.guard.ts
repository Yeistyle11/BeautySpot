import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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

    if (decoded.sub && decoded.tokenVersion !== undefined) {
      const currentVersion = await this.tokenVersionStore.getVersion(
        decoded.sub
      );
      if (currentVersion !== decoded.tokenVersion) {
        throw new UnauthorizedException("Sesión invalidada");
      }
    } else if (decoded.sub) {
      const currentVersion = await this.tokenVersionStore.getVersion(
        decoded.sub
      );
      if (currentVersion !== TOKEN_VERSION_DEFAULT) {
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
