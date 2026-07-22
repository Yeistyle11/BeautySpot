/**
 * Fuente autoritativa y duradera de la versión de token de un usuario.
 *
 * TokenVersionStore usa Redis como caché de lectura, pero Redis es volátil:
 * un FLUSHALL, un failover o una evicción por maxmemory devolvería todas las
 * versiones a cero y revalidaría tokens ya revocados. El servicio que posee la
 * tabla de usuarios (auth-service) implementa esta interfaz sobre su base de
 * datos para que la revocación sobreviva a la pérdida de Redis.
 *
 * Los servicios que no la proveen operan solo con Redis: su ventana de riesgo
 * queda acotada a la vigencia del access token (15m por defecto).
 */
export interface TokenVersionResolver {
  /** Lee la versión persistida del usuario. Devuelve 0 si el usuario no existe. */
  load(userId: string): Promise<number>;

  /** Incrementa la versión persistida de forma atómica y devuelve el nuevo valor. */
  bump(userId: string): Promise<number>;
}

/** Token de inyección del TokenVersionResolver opcional. */
export const TOKEN_VERSION_RESOLVER = Symbol("TOKEN_VERSION_RESOLVER");
