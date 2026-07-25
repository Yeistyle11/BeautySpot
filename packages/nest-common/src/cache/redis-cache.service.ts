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

  /**
   * Comprueba que el servidor responde. Se usa desde el health check: no vale
   * mirar el estado del socket, porque ioredis reconecta en segundo plano y
   * puede parecer conectado mientras Redis rechaza los comandos.
   */
  async ping(): Promise<boolean> {
    const respuesta = await this.client.ping();
    return respuesta === "PONG";
  }

  /**
   * Devuelve el valor cacheado o lo calcula y lo guarda (cache-aside).
   *
   * **Falla abierto**: si Redis no responde o el valor guardado no se puede
   * interpretar, se recurre al origen. Una caché caída debe degradar el
   * rendimiento, nunca convertir una lectura correcta en un error.
   *
   * Sólo para datos que se pueden servir ligeramente obsoletos. No usar para
   * nada que dependa de permisos del usuario: la clave no distingue quién
   * pregunta, así que dos usuarios distintos comparten la misma entrada.
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

  /**
   * Borra todas las claves que empiezan por el prefijo.
   *
   * Recorre con SCAN y no con KEYS: KEYS bloquea el servidor entero mientras
   * recorre el espacio de claves, y aquí se llama desde peticiones de usuario.
   */
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
