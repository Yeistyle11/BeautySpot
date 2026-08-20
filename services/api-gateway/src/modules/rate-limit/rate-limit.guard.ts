import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  RATE_LIMIT_AUTH_REQUESTS,
  RATE_LIMIT_GENERAL_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
} from "@beautyspot/shared-constants";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.module";

/**
 * Incrementa el contador y fija su expiracion en una sola llamada atomica, y
 * devuelve el conteo y el TTL. KEYS[1]=clave, ARGV[1]=ventana en segundos.
 */
const INCR_WITH_EXPIRE = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return { count, redis.call('TTL', KEYS[1]) }
`;

/** Lo que un contador responde al anotar una petición: cuántas van y cuánto queda. */
interface Marca {
  count: number;
  espera: number;
}

/** Rutas que exponen credenciales y quedan bajo el límite estricto. */
const RUTAS_DE_CREDENCIALES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/resend-verification",
];

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  private readonly limiteCredenciales: number;
  private readonly limiteGeneral: number;
  private readonly ventanaSegundos: number;

  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    configService: ConfigService
  ) {
    // Los límites salen de la configuración; las constantes son el respaldo.
    this.limiteCredenciales = this.numero(
      configService,
      "RATE_LIMIT_AUTH_MAX",
      RATE_LIMIT_AUTH_REQUESTS
    );
    this.limiteGeneral = this.numero(
      configService,
      "RATE_LIMIT_GENERAL_MAX",
      RATE_LIMIT_GENERAL_REQUESTS
    );
    this.ventanaSegundos = this.numero(
      configService,
      "RATE_LIMIT_WINDOW_SECONDS",
      RATE_LIMIT_WINDOW_SECONDS
    );
  }

  /** Lee un número de la configuración, con valor por defecto si falta o no es válido. */
  private numero(
    configService: ConfigService,
    clave: string,
    porDefecto: number
  ): number {
    const crudo = configService.get(clave);
    if (crudo === undefined || crudo === null || crudo === "")
      return porDefecto;
    const valor = Number(crudo);
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
  }

  /** Cuenta la petición y la rechaza si supera el límite de su ventana. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const isAuthRoute = this.isAuthRoute(request.path);

    // En rutas de autenticacion se limita tambien por cuenta objetivo, no solo
    // por IP.
    const buckets = this.buildBuckets(request, isAuthRoute);
    const limit = isAuthRoute ? this.limiteCredenciales : this.limiteGeneral;

    // De los dos contadores manda el que va mas lleno.
    let usados = 0;
    let esperaSegundos = this.ventanaSegundos;

    for (const bucket of buckets) {
      const marca = await this.hit(bucket);
      if (marca === null) continue;

      if (marca.count > usados) {
        usados = marca.count;
        esperaSegundos = marca.espera;
      }
    }

    this.anotarCabeceras(response, limit, usados, esperaSegundos);

    if (usados > limit) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: this.mensajeDeEspera(isAuthRoute, esperaSegundos),
          },
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  /** Dice cuanto falta para poder reintentar. */
  private mensajeDeEspera(esDeCredenciales: boolean, segundos: number): string {
    const que = esDeCredenciales
      ? "Demasiados intentos"
      : "Demasiadas solicitudes";
    return `${que}. Espera ${segundos} ${
      segundos === 1 ? "segundo" : "segundos"
    } y vuelve a intentarlo.`;
  }

  /**
   * Cabeceras estandar del limitador, tambien cuando la peticion pasa.
   */
  private anotarCabeceras(
    response: Response,
    limite: number,
    usados: number,
    espera: number
  ): void {
    // `setHeader` no existe si quien llama no trae una respuesta de Express,
    // como pasa en algunas pruebas del guard.
    if (typeof response?.setHeader !== "function") return;

    response.setHeader("RateLimit-Limit", limite);
    response.setHeader("RateLimit-Remaining", Math.max(0, limite - usados));
    response.setHeader("RateLimit-Reset", espera);
    if (usados > limite) response.setHeader("Retry-After", espera);
  }

  /**
   * Indica si la ruta es de credenciales y le toca el limite estricto; deja
   * fuera `/auth/refresh`.
   */
  private isAuthRoute(path: string): boolean {
    const normalizado = path.replace(/^(\/api\/v\d+\/[a-z]+)-service\//, "$1/");
    return RUTAS_DE_CREDENCIALES.some((ruta) => normalizado.includes(ruta));
  }

  /** Contadores que se aplican a la petición: por IP y, en credenciales, por cuenta. */
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

  /** IP a la que se le imputa la petición. */
  private resolveIp(request: Request): string {
    // request.ip respeta el ajuste "trust proxy" de Express, que hay que
    // configurar junto con este guard.
    return request.ip || request.socket?.remoteAddress || "unknown";
  }

  /** Correo del cuerpo, normalizado, para contar los intentos por cuenta. */
  private extractEmail(request: Request): string | null {
    const body = request.body as { email?: unknown } | undefined;
    if (!body || typeof body.email !== "string") return null;
    return body.email.trim().toLowerCase() || null;
  }

  /**
   * Registra un impacto en el contador de la ventana. Devuelve el conteo o
   * null si Redis no responde, y entonces la peticion pasa (fail-open).
   */
  private async hit(key: string): Promise<Marca | null> {
    try {
      const [count, ttl] = (await this.redis.eval(
        INCR_WITH_EXPIRE,
        1,
        key,
        String(this.ventanaSegundos)
      )) as [number, number];

      return {
        count,
        // Un TTL negativo es una clave sin caducidad o ya ida; en ese caso lo
        // que queda es, como mucho, una ventana entera.
        espera: ttl > 0 ? ttl : this.ventanaSegundos,
      };
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
