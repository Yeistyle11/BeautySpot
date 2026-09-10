/**
 * Fuente autoritativa y duradera de la versión de token de un usuario: auth la
 * implementa sobre su base, de modo que la revocación sobreviva a Redis. Quien
 * no la provee opera solo con la caché, con la ventana del access token.
 */
export interface TokenVersionResolver {
  /** Lee la versión persistida del usuario. Devuelve 0 si el usuario no existe. */
  load(userId: string): Promise<number>;

  /** Incrementa la versión persistida de forma atómica y devuelve el nuevo valor. */
  bump(userId: string): Promise<number>;
}

/** Token de inyección del TokenVersionResolver opcional. */
export const TOKEN_VERSION_RESOLVER = Symbol("TOKEN_VERSION_RESOLVER");
