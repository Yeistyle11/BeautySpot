import { Injectable } from "@nestjs/common";
import { InternalHttpClient } from "../http/internal-http.client";
import { TokenVersionResolver } from "./token-version.resolver";
import { TOKEN_VERSION_DEFAULT } from "./token-version.store";

/** Lo que responde auth en `/internal/users/:id/token-version`. */
interface RespuestaDeVersion {
  version: number;
}

/**
 * TokenVersionResolver de los servicios que no son dueños de la tabla de
 * usuarios: pregunta a auth por HTTP interno.
 *
 * Con él, perder la clave de Redis deja de reactivar un token revocado en todo
 * el sistema y no solo en auth. La llamada no se hace en cada petición:
 * TokenVersionStore consulta Redis primero y solo baja aquí cuando falta el
 * dato, y repuebla la caché con lo que reciba.
 */
@Injectable()
export class HttpTokenVersionResolver implements TokenVersionResolver {
  constructor(private readonly http: InternalHttpClient) {}

  /**
   * Lee la versión que auth tiene guardada. Propaga el fallo a propósito: el
   * store distingue "no está revocado" de "no se ha podido averiguar", y esa
   * diferencia es la que deja decidir al guard.
   */
  async load(userId: string): Promise<number> {
    const respuesta = await this.http.pedir<RespuestaDeVersion>(
      "auth",
      `/internal/users/${userId}/token-version`
    );
    return respuesta?.version ?? TOKEN_VERSION_DEFAULT;
  }

  /** Revocar es de auth, que es quien posee la tabla. */
  async bump(): Promise<number> {
    throw new Error(
      "Solo auth-service puede revocar sesiones: este resolver es de lectura"
    );
  }
}
