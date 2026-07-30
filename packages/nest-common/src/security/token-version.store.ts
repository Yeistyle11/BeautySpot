import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { RedisCacheService } from "../cache/redis-cache.service";
import {
  TOKEN_VERSION_RESOLVER,
  TokenVersionResolver,
} from "./token-version.resolver";

export const TOKEN_VERSION_KEY_PREFIX = "tokenVersion";
export const TOKEN_VERSION_DEFAULT = 0;

/**
 * Resultado de consultar la versión de token de un usuario.
 *
 * Distingue "el usuario está en la versión N" de "no se ha podido averiguar",
 * que antes se confundían: sin Redis y sin resolver se devolvía 0, con lo que
 * un token revocado volvía a aceptarse como si nunca lo hubieran revocado.
 */
export type VersionDeToken =
  | { conocida: true; version: number }
  | { conocida: false };

/**
 * Controla la invalidación global de los JWT de un usuario.
 *
 * Cada token lleva la versión vigente en el momento de emitirse; el guard la
 * compara contra la almacenada aquí y rechaza el token si difieren. Incrementar
 * la versión revoca de golpe todas las sesiones del usuario en todos los
 * microservicios (logout, cambio de contraseña, cambio de rol o membresía).
 *
 * Redis actúa como caché; cuando hay un TokenVersionResolver inyectado, la BD
 * es la fuente de verdad y la revocación sobrevive a la pérdida de Redis.
 */
@Injectable()
export class TokenVersionStore {
  private readonly logger = new Logger(TokenVersionStore.name);
  /** Si la última lectura de Redis se pudo completar (aunque no hubiera valor). */
  private cacheDisponible = true;

  constructor(
    private readonly cache: RedisCacheService,
    @Optional()
    @Inject(TOKEN_VERSION_RESOLVER)
    private readonly resolver?: TokenVersionResolver
  ) {}

  /** Clave en Redis donde vive la versión de token del usuario. */
  private key(userId: string): string {
    return `${TOKEN_VERSION_KEY_PREFIX}:${userId}`;
  }

  /**
   * Devuelve la versión de token vigente del usuario.
   *
   * Intenta Redis primero. Ante un fallo de caché consulta al resolver
   * autoritativo (si existe) y repuebla Redis, de modo que un flush de Redis no
   * reactive tokens previamente revocados.
   */
  async getVersion(userId: string): Promise<number> {
    const resultado = await this.consultarVersion(userId);
    return resultado.conocida ? resultado.version : TOKEN_VERSION_DEFAULT;
  }

  /**
   * Como {@link getVersion}, pero diciendo si el dato se pudo averiguar.
   *
   * Lo usa el guard para decidir qué hacer cuando no hay forma de comprobar la
   * revocación: dejar pasar una lectura es asumible, ejecutar una acción no.
   */
  async consultarVersion(userId: string): Promise<VersionDeToken> {
    const cached = await this.readCache(userId);
    if (cached !== null) return { conocida: true, version: cached };

    if (!this.resolver) {
      // Sin caché ni fuente autoritativa no hay forma de saberlo.
      return this.cacheDisponible
        ? { conocida: true, version: TOKEN_VERSION_DEFAULT }
        : { conocida: false };
    }

    try {
      const persisted = await this.resolver.load(userId);
      await this.writeCache(userId, persisted);
      return { conocida: true, version: persisted };
    } catch (error) {
      this.logger.warn(
        `No se pudo cargar la versión de token de ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return { conocida: false };
    }
  }

  /**
   * Incrementa la versión del usuario, revocando todos sus tokens ya emitidos.
   *
   * Con resolver, la BD manda y Redis se actualiza con el valor resultante; si
   * la escritura en Redis falla, la siguiente lectura la reconstruye desde BD.
   */
  async bumpVersion(userId: string): Promise<number> {
    if (this.resolver) {
      const next = await this.resolver.bump(userId);
      await this.writeCache(userId, next);
      return next;
    }
    return this.cache.incr(this.key(userId));
  }

  /**
   * Lee la versión cacheada. Devuelve null si no está en caché o si Redis falla,
   * señalando al llamador que debe recurrir a la fuente autoritativa.
   */
  private async readCache(userId: string): Promise<number | null> {
    try {
      const raw = await this.cache.get(this.key(userId));
      this.cacheDisponible = true;
      if (raw === null || raw === undefined) return null;
      const parsed = Number.parseInt(raw, 10);
      return Number.isNaN(parsed) ? null : parsed;
    } catch (error) {
      this.cacheDisponible = false;
      this.logger.warn(
        `No se pudo leer la versión de token de ${userId} desde Redis: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /** Persiste la versión en caché sin propagar fallos de Redis al llamador. */
  private async writeCache(userId: string, version: number): Promise<void> {
    try {
      await this.cache.set(this.key(userId), String(version));
    } catch (error) {
      this.logger.warn(
        `No se pudo cachear la versión de token de ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
