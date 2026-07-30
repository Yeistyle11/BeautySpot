import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/** Dispersión que se aplica al TTL para que no caduquen todas las claves a la vez. */
const DISPERSION_TTL = 0.1;

/**
 * Envoltorio delgado sobre un cliente Redis para operaciones de caché básicas
 * (get/set con TTL, incr, del, exists). Cierra la conexión al destruir el módulo.
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;
  /** Cargas en vuelo, para que un fallo de caché no se recalcule en paralelo. */
  private readonly enVuelo = new Map<string, Promise<unknown>>();

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

  /** Lee un valor de la caché, o null si no está. */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** Guarda un valor, con vencimiento si se indica. */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /** Suma uno al contador de la clave y devuelve el nuevo valor. */
  async incr(key: string): Promise<number> {
    const value = await this.client.incr(key);
    return value;
  }

  /** Borra una clave. */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Indica si la clave existe. */
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
   *
   * Las cargas simultáneas de la misma clave se agrupan en una sola: al caducar
   * una clave muy visitada, todas las peticiones en vuelo fallaban a la vez y
   * cada una recalculaba por su cuenta.
   *
   * `etiquetaDe` permite asociar la clave a un grupo (por ejemplo, un negocio)
   * para poder invalidar después solo ese grupo con {@link invalidarEtiqueta}.
   */
  async remember<T>(
    clave: string,
    ttlSegundos: number,
    cargar: () => Promise<T>,
    etiquetaDe?: (valor: T) => string | undefined
  ): Promise<T> {
    try {
      const cacheado = await this.client.get(clave);
      if (cacheado !== null) return JSON.parse(cacheado) as T;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer la caché de ${clave}: ${this.mensaje(error)}`
      );
    }

    const enCurso = this.enVuelo.get(clave);
    if (enCurso) return enCurso as Promise<T>;

    const carga = this.cargarYGuardar(clave, ttlSegundos, cargar, etiquetaDe);
    this.enVuelo.set(clave, carga);
    try {
      return await carga;
    } finally {
      this.enVuelo.delete(clave);
    }
  }

  /** Calcula el valor, lo guarda con TTL disperso y lo asocia a su etiqueta. */
  private async cargarYGuardar<T>(
    clave: string,
    ttlSegundos: number,
    cargar: () => Promise<T>,
    etiquetaDe?: (valor: T) => string | undefined
  ): Promise<T> {
    const valor = await cargar();

    try {
      // El TTL se dispersa para que las claves guardadas a la vez no venzan
      // todas en el mismo instante.
      const ttl = Math.max(
        1,
        Math.round(ttlSegundos * (1 + (Math.random() * 2 - 1) * DISPERSION_TTL))
      );
      await this.client.set(clave, JSON.stringify(valor), "EX", ttl);

      const etiqueta = etiquetaDe?.(valor);
      if (etiqueta) {
        await this.client.sadd(etiqueta, clave);
        await this.client.expire(etiqueta, ttl * 2);
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo guardar en caché ${clave}: ${this.mensaje(error)}`
      );
    }

    return valor;
  }

  /** Borra las claves asociadas a una etiqueta. */
  async invalidarEtiqueta(etiqueta: string): Promise<number> {
    try {
      const claves = await this.client.smembers(etiqueta);
      const borradas = claves.length > 0 ? await this.client.del(...claves) : 0;
      await this.client.del(etiqueta);
      return borradas;
    } catch (error) {
      // Invalidar es "mejor esfuerzo": si falla, las entradas caducan solas por
      // TTL. Propagar el error rompería la escritura que acaba de tener éxito.
      this.logger.warn(
        `No se pudo invalidar la caché de ${etiqueta}: ${this.mensaje(error)}`
      );
      return 0;
    }
  }

  /** Extrae el texto de un error para poder registrarlo. */
  private mensaje(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /** Cierra la conexión con Redis al parar el servicio. */
  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
