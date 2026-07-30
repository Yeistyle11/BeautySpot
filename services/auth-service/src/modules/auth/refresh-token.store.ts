import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

/** Resultado de canjear un refresh token. */
export type CanjeDeRefresh =
  | { resultado: "válido" }
  /** El identificador no está vivo: o ya se usó, o se revocó la sesión. */
  | { resultado: "reutilizado" }
  /** No se pudo comprobar; el llamador decide si sigue adelante. */
  | { resultado: "indeterminado" };

/** Días que se conserva la lista de refresh vivos, en línea con su vigencia. */
const VIGENCIA_POR_DEFECTO_DIAS = 7;
const SEGUNDOS_POR_DIA = 24 * 60 * 60;

/**
 * Lleva en Redis el conjunto de refresh tokens vivos de cada usuario —uno por
 * dispositivo—, de modo que canjear uno lo retira y reutilizarlo se detecta.
 */
@Injectable()
export class RefreshTokenStore {
  private readonly logger = new Logger(RefreshTokenStore.name);
  private readonly client: Redis;
  private readonly vigenciaSegundos: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>("REDIS_HOST", "localhost"),
      port: this.configService.get<number>("REDIS_PORT", 6379),
      password: this.configService.get<string>("REDIS_PASSWORD"),
      maxRetriesPerRequest: 2,
    });
    this.vigenciaSegundos =
      Number(this.configService.get("REFRESH_TOKEN_TTL_DAYS")) ||
      VIGENCIA_POR_DEFECTO_DIAS;
  }

  /** Registra un refresh recién emitido como vivo. */
  async registrar(userId: string, jti: string): Promise<void> {
    try {
      await this.client.sadd(this.clave(userId), jti);
      await this.client.expire(
        this.clave(userId),
        this.vigenciaSegundos * SEGUNDOS_POR_DIA
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar el refresh de ${userId}: ${this.texto(error)}`
      );
    }
  }

  /**
   * Consume un refresh: lo retira de los vivos y dice si estaba. Si Redis no
   * responde devuelve "indeterminado", no "reutilizado".
   */
  async canjear(userId: string, jti: string): Promise<CanjeDeRefresh> {
    try {
      const retirados = await this.client.srem(this.clave(userId), jti);
      return retirados > 0
        ? { resultado: "válido" }
        : { resultado: "reutilizado" };
    } catch (error) {
      this.logger.warn(
        `No se pudo canjear el refresh de ${userId}: ${this.texto(error)}`
      );
      return { resultado: "indeterminado" };
    }
  }

  /** Retira todos los refresh vivos de un usuario. */
  async revocarTodos(userId: string): Promise<void> {
    try {
      await this.client.del(this.clave(userId));
    } catch (error) {
      this.logger.warn(
        `No se pudieron revocar los refresh de ${userId}: ${this.texto(error)}`
      );
    }
  }

  /** Cierra la conexión al parar el servicio. */
  onModuleDestroy(): void {
    this.client.disconnect();
  }

  private clave(userId: string): string {
    return `refreshVivos:${userId}`;
  }

  private texto(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
