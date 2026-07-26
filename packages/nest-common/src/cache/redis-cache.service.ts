import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Envoltorio delgado sobre un cliente Redis para operaciones de caché básicas
 * (get/set con TTL, incr, del, exists). Cierra la conexión al destruir el módulo.
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis({
      host: configService.get<string>("REDIS_HOST", "localhost"),
      port: configService.get<number>("REDIS_PORT", 6379),
      password: configService.get<string>("REDIS_PASSWORD"),
      retryStrategy: (times) => Math.min(times * 200, 2000),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async incr(key: string): Promise<number> {
    const value = await this.client.incr(key);
    return value;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /** Comprueba que el servidor responde al PING. */
  async ping(): Promise<boolean> {
    const respuesta = await this.client.ping();
    return respuesta === "PONG";
  }

  /**
   * Devuelve el valor cacheado o lo calcula y lo guarda. Si Redis falla, recurre
   * al origen. La clave no distingue usuario: no usar para datos por permisos.
   */
  async remember<T>(
    clave: string,
    ttlSegundos: number,
    cargar: () => Promise<T>
  ): Promise<T> {
    try {
      const cacheado = await this.client.get(clave);
      if (cacheado !== null) return JSON.parse(cacheado) as T;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la caché de ${clave}: ${this.mensaje(error)}`
      );
    }

    const valor = await cargar();

    try {
      await this.client.set(clave, JSON.stringify(valor), "EX", ttlSegundos);
    } catch (error) {
      this.logger.warn(
        `No se pudo guardar en caché ${clave}: ${this.mensaje(error)}`
      );
    }

    return valor;
  }

  /** Borra con SCAN todas las claves que empiezan por el prefijo. */
  async delByPrefix(prefijo: string): Promise<number> {
    let cursor = "0";
    let borradas = 0;

    try {
      do {
        const [siguiente, claves] = await this.client.scan(
          cursor,
          "MATCH",
          `${prefijo}*`,
          "COUNT",
          100
        );
        cursor = siguiente;
        if (claves.length > 0) {
          borradas += await this.client.del(...claves);
        }
      } while (cursor !== "0");
    } catch (error) {
      // Invalidar es "mejor esfuerzo": si falla, las entradas caducan solas por
      // TTL. Propagar el error rompería la escritura que acaba de tener éxito.
      this.logger.warn(
        `No se pudo invalidar la caché de ${prefijo}: ${this.mensaje(error)}`
      );
    }

    return borradas;
  }

  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
