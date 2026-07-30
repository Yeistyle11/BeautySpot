import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import {
  RATE_LIMIT_AUTH_REQUESTS,
  RATE_LIMIT_GENERAL_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
} from "@beautyspot/shared-constants";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.module";

/**
 * Incrementa el contador y fija su expiración en una sola llamada atómica.
 * Un INCR seguido de un EXPIRE por separado deja la clave sin TTL si el proceso
 * muere entre ambos, bloqueando a la IP indefinidamente. KEYS[1]=clave,
 * ARGV[1]=ventana en segundos. Devuelve el nuevo valor del contador.
 */
const INCR_WITH_EXPIRE = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

/** Rutas que exponen credenciales y quedan bajo el límite estricto. */
const RUTAS_DE_CREDENCIALES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const isAuthRoute = this.isAuthRoute(request.path);

    // En rutas de autenticación se limita también por cuenta objetivo, no solo
    // por IP: así un ataque distribuido de credential stuffing contra un mismo
    // email se frena aunque cada intento venga de una IP distinta.
    const buckets = this.buildBuckets(request, isAuthRoute);
    const limit = isAuthRoute
      ? RATE_LIMIT_AUTH_REQUESTS
      : RATE_LIMIT_GENERAL_REQUESTS;

    for (const bucket of buckets) {
      const count = await this.hit(bucket);
      if (count !== null && count > limit) {
        throw new HttpException(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Demasiadas solicitudes",
            },
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    return true;
  }

  /**
   * Indica si la ruta es de credenciales y merece el límite estricto.
   *
   * Se normaliza antes de comparar porque el gateway acepta el nombre del
   * servicio con y sin sufijo: sin esto, `/api/v1/auth-service/login` esquivaba
   * el límite de autenticación y se colaba por el general, que es veinte veces
   * más alto y no crea el contador por cuenta.
   *
   * `/auth/refresh` queda fuera a propósito: el contador es por IP y detrás de
   * un NAT o un balanceador muchos usuarios comparten una, así que aplicarle un
   * límite tan bajo cerraría sesiones legítimas. Un refresh no se puede forzar
   * por fuerza bruta: es un JWT firmado.
   */
  private isAuthRoute(path: string): boolean {
    const normalizado = path.replace(/^(\/api\/v\d+\/[a-z]+)-service\//, "$1/");
    return RUTAS_DE_CREDENCIALES.some((ruta) => normalizado.includes(ruta));
  }

  private buildBuckets(request: Request, isAuthRoute: boolean): string[] {
    const ip = this.resolveIp(request);
    const scope = isAuthRoute ? "auth" : "general";
    const buckets = [`rate-limit:ip:${ip}:${scope}`];

    if (isAuthRoute) {
      const email = this.extractEmail(request);
      if (email) buckets.push(`rate-limit:account:${email}`);
    }

    return buckets;
  }

  private resolveIp(request: Request): string {
    // request.ip respeta el ajuste "trust proxy" de Express; si no está activo
    // detrás de un balanceador todas las peticiones comparten cuota, por lo que
    // debe configurarse junto con este guard.
    return request.ip || request.socket?.remoteAddress || "unknown";
  }

  private extractEmail(request: Request): string | null {
    const body = request.body as { email?: unknown } | undefined;
    if (!body || typeof body.email !== "string") return null;
    return body.email.trim().toLowerCase() || null;
  }

  /**
   * Registra un impacto en el contador de la ventana. Devuelve el conteo actual
   * o null si Redis no responde: ante un fallo de la caché se deja pasar la
   * petición (fail-open) en vez de tumbar todo el tráfico con errores 500.
   */
  private async hit(key: string): Promise<number | null> {
    try {
      const count = (await this.redis.eval(
        INCR_WITH_EXPIRE,
        1,
        key,
        String(RATE_LIMIT_WINDOW_SECONDS)
      )) as number;
      return count;
    } catch (error) {
      this.logger.warn(
        `Rate limit no disponible (Redis) para ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }
}
