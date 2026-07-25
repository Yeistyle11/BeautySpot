import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Envoltorio delgado sobre un cliente Redis para operaciones de caché básicas
 * (get/set con TTL, incr, del, exists). Cierra la conexión al destruir el módulo.
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
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

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
