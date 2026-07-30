import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { ACCESS_COOKIE, leerCookie } from "./session-cookies";

/** Métodos que cambian estado y por tanto merecen protección CSRF. */
const METODOS_MUTANTES = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Rechaza las peticiones autenticadas por cookie que vengan de otro origen. Las
 * que llegan con cabecera `Authorization` pasan sin comprobación.
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  private readonly logger = new Logger(CsrfOriginGuard.name);

  constructor(private readonly configService: ConfigService) {}

  /** Rechaza las peticiones con cookie de sesión que vengan de otro origen. */
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (!METODOS_MUTANTES.includes(req.method)) return true;
    if (!leerCookie(req, ACCESS_COOKIE)) return true;

    const origen = this.origenDe(req);
    // Sin Origin ni Referer no es una petición de navegador entre sitios: los
    // navegadores envían Origin en toda petición mutante desde una página.
    if (!origen) return true;

    if (this.permitido(origen)) return true;

    this.logger.warn(
      `Petición ${req.method} ${req.path} rechazada por origen no permitido: ${origen}`
    );
    throw new ForbiddenException("Origen no permitido");
  }

  /** Origen de la petición, tomado de Origin o, en su defecto, de Referer. */
  private origenDe(req: Request): string | undefined {
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.length > 0) return origin;

    const referer = req.headers.referer;
    if (typeof referer !== "string" || referer.length === 0) return undefined;
    try {
      return new URL(referer).origin;
    } catch {
      return undefined;
    }
  }

  /** Comprueba el origen contra la misma lista que gobierna CORS. */
  private permitido(origen: string): boolean {
    const configurados = (this.configService.get<string>("CORS_ORIGINS") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    if (configurados.includes(origen)) return true;

    // En desarrollo el frontend corre en localhost:8080 y la API en :3000, que
    // son orígenes distintos.
    if (process.env.NODE_ENV !== "production") {
      return /^https?:\/\/localhost(:\d+)?$/.test(origen);
    }
    return false;
  }
}
