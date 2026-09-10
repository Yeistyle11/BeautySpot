import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { RedisCacheService } from "../cache/redis-cache.service";
import {
  TOKEN_VERSION_RESOLVER,
  TokenVersionResolver,
} from "./token-version.resolver";

export const TOKEN_VERSION_KEY_PREFIX = "tokenVersion";
export const TOKEN_VERSION_DEFAULT = 0;

/**
 * Versión de token de un usuario, distinguiendo "está en la versión N" de "no
 * se ha podido averiguar".
 */
export type VersionDeToken =
  | { conocida: true; version: number }
  | { conocida: false };

/**
 * Controla la invalidación global de los JWT de un usuario: cada token lleva
 * la versión con la que se emitió y el guard rechaza el que no la iguale.
 * Redis es la caché; con un TokenVersionResolver inyectado, la BD manda.
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

  private key(userId: string): string {
    return `${TOKEN_VERSION_KEY_PREFIX}:${userId}`;
  }

  /**
   * Versión vigente del usuario. Intenta Redis y, ante un fallo, consulta al
   * resolver autoritativo y repuebla la caché, de modo que un flush de Redis
   * no reactive tokens revocados.
   */
  async getVersion(userId: string): Promise<number> {
    const resultado = await this.consultarVersion(userId);
    return resultado.conocida ? resultado.version : TOKEN_VERSION_DEFAULT;
  }

  /**
   * Como {@link getVersion}, pero diciendo si el dato se pudo averiguar. El
   * guard deja pasar una lectura sin comprobar, una acción no.
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
   * Incrementa la versión del usuario, revocando sus tokens ya emitidos. Con
   * resolver la BD manda; si falla el escribir en Redis, la siguiente lectura
   * lo reconstruye desde ella.
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
