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
  RATE_LIMIT_RESERVA_PUBLICA_REQUESTS,
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

/**
 * Qué clase de tráfico es la petición, que decide con qué presupuesto se cuenta
 * y qué pasa si Redis no responde.
 */
type Trafico = "credenciales" | "reservaPublica" | "general";

/** Rutas que exponen credenciales y quedan bajo el límite estricto. */
const RUTAS_DE_CREDENCIALES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/resend-verification",
];

/**
 * Rutas públicas de escritura que no piden credenciales. Sin token no hay a
 * quién imputar el abuso, y lo que crean —una cita en la agenda de un salón,
 * más el correo que la anuncia— cuesta dinero a un tercero.
 */
const RUTAS_DE_RESERVA_PUBLICA = ["/booking/public/appointments"];

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  private readonly limiteCredenciales: number;
  private readonly limiteReservaPublica: number;
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
    this.limiteReservaPublica = this.numero(
      configService,
      "RATE_LIMIT_PUBLIC_BOOKING_MAX",
      RATE_LIMIT_RESERVA_PUBLICA_REQUESTS
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
    const trafico = this.traficoDe(request.path);

    // En credenciales se cuenta tambien por cuenta objetivo, y en la reserva
    // publica por el contacto del invitado: contar solo por IP no sirve contra
    // quien las rota.
    const buckets = this.buildBuckets(request, trafico);
    const limit = this.limiteDe(trafico);

    // De los contadores manda el que va mas lleno.
    let usados = 0;
    let esperaSegundos = this.ventanaSegundos;
    let sinContador = false;

    for (const bucket of buckets) {
      const marca = await this.hit(bucket);
      if (marca === null) {
        sinContador = true;
        continue;
      }

      if (marca.count > usados) {
        usados = marca.count;
        esperaSegundos = marca.espera;
      }
    }

    // Sin Redis no hay forma de contar. En el trafico corriente se deja pasar,
    // porque cerrar tumbaria el producto entero por una caida de la cache; en
    // lo que se escribe sin token se cierra, que es donde no contar equivale a
    // no tener limite.
    if (sinContador && trafico !== "general") {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_UNAVAILABLE",
            message:
              "No podemos atender esta solicitud ahora mismo. Vuelve a intentarlo en unos minutos.",
          },
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    this.anotarCabeceras(response, limit, usados, esperaSegundos);

    if (usados > limit) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: this.mensajeDeEspera(trafico, esperaSegundos),
          },
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  /** Presupuesto de peticiones que le toca a cada clase de trafico. */
  private limiteDe(trafico: Trafico): number {
    if (trafico === "credenciales") return this.limiteCredenciales;
    if (trafico === "reservaPublica") return this.limiteReservaPublica;
    return this.limiteGeneral;
  }

  /** Dice cuanto falta para poder reintentar. */
  private mensajeDeEspera(trafico: Trafico, segundos: number): string {
    const que =
      trafico === "credenciales"
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
   * Clasifica la ruta para saber con que presupuesto se cuenta. `/auth/refresh`
   * queda fuera de credenciales: la renueva quien ya tiene sesion.
   */
  private traficoDe(path: string): Trafico {
    const normalizado = path.replace(/^(\/api\/v\d+\/[a-z]+)-service\//, "$1/");

    if (RUTAS_DE_CREDENCIALES.some((ruta) => normalizado.includes(ruta))) {
      return "credenciales";
    }
    if (RUTAS_DE_RESERVA_PUBLICA.some((ruta) => normalizado.includes(ruta))) {
      return "reservaPublica";
    }
    return "general";
  }

  /** Contadores que se aplican a la petición: por IP y por a quién señala. */
  private buildBuckets(request: Request, trafico: Trafico): string[] {
    const ip = this.resolveIp(request);
    const ambito = {
      credenciales: "auth",
      reservaPublica: "reserva",
      general: "general",
    }[trafico];
    const buckets = [`rate-limit:ip:${ip}:${ambito}`];

    if (trafico === "credenciales") {
      const email = this.extractEmail(request);
      if (email) buckets.push(`rate-limit:account:${email}`);
    }

    if (trafico === "reservaPublica") {
      const invitado = this.identidadDelInvitado(request);
      if (invitado) buckets.push(`rate-limit:invitado:${invitado}`);
    }

    return buckets;
  }

  /**
   * Con qué se identifica al invitado que reserva: el correo primero, porque es
   * el que recibe el aviso, y el teléfono si no lo dio. Sin ninguno de los dos
   * solo queda el contador por IP.
   */
  private identidadDelInvitado(request: Request): string | null {
    const body = request.body as
      | { guestEmail?: unknown; guestPhone?: unknown }
      | undefined;
    if (!body) return null;

    if (typeof body.guestEmail === "string" && body.guestEmail.trim()) {
      return body.guestEmail.trim().toLowerCase();
    }
    if (typeof body.guestPhone === "string" && body.guestPhone.trim()) {
      return body.guestPhone.replace(/\s+/g, "");
    }
    return null;
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
   * Registra un impacto en el contador de la ventana. Devuelve el conteo, o
   * null si Redis no responde; quien llama decide entonces si la peticion pasa
   * o se rechaza.
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
