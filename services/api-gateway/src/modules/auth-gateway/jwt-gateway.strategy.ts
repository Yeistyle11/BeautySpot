import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { assertJwtSecret } from "@beautyspot/nest-common";
import { ACCESS_COOKIE, leerCookie } from "../session/session-cookies";

/** Toma el token de la cookie httpOnly de sesión, que es como viaja desde el navegador. */
function desdeCookie(req: Request): string | null {
  return leerCookie(req, ACCESS_COOKIE) ?? null;
}

/** Estrategia Passport que valida el JWT (firma y expiración) en el gateway. */
@Injectable()
export class JwtGatewayStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // La cookie primero: es la vía del navegador. La cabecera Bearer se
      // mantiene para clientes que no usan cookies (pruebas, integraciones,
      // una app móvil futura), que no están expuestos a XSS del mismo modo.
      jwtFromRequest: ExtractJwt.fromExtractors([
        desdeCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      // passport-jwt v11 exige un secreto definido (string|Buffer, no undefined)
      secretOrKey: assertJwtSecret(
        configService.get<string>("JWT_SECRET"),
        "JWT_SECRET"
      ),
    });
  }

  /** Convierte el payload del token en el objeto `user` que se adjunta a la petición. */
  validate(payload: {
    sub: string;
    email: string;
    role: string;
    businessId?: string;
    businessIds?: string[];
  }) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      businessId: payload.businessId,
      businessIds: payload.businessIds,
    };
  }
}
