import { Injectable } from "@nestjs/common";
import { RedisCacheService } from "../cache/redis-cache.service";

export const TOKEN_VERSION_KEY_PREFIX = "tokenVersion";
export const TOKEN_VERSION_DEFAULT = 0;

@Injectable()
export class TokenVersionStore {
  constructor(private readonly cache: RedisCacheService) {}

  private key(userId: string): string {
    return `${TOKEN_VERSION_KEY_PREFIX}:${userId}`;
  }

  /**
   * Obtiene la versión actual del token del usuario desde Redis.
   * Si la clave no existe (Redis flush / primer login), retorna 0
   * (valor por defecto consistente con tokens emitidos sin bump previo).
   */
  async getVersion(userId: string): Promise<number> {
    const raw = await this.cache.get(this.key(userId));
    if (raw === null || raw === undefined) {
      return TOKEN_VERSION_DEFAULT;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? TOKEN_VERSION_DEFAULT : parsed;
  }

  /**
   * Incrementa la versión del token del usuario en Redis.
   * Invalida inmediatamente todos los tokens JWT emitidos previamente
   * para ese usuario en cualquier microservicio.
   */
  async bumpVersion(userId: string): Promise<number> {
    return this.cache.incr(this.key(userId));
  }
}
