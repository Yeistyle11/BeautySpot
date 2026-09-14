import { Injectable } from "@nestjs/common";
import { InternalHttpClient } from "../http/internal-http.client";

/** Lo que interesa de `/internal/clients/by-user`: el id de cada ficha. */
interface FichaDeCliente {
  id?: unknown;
}

/**
 * Traduce un usuario a las fichas de cliente que le pertenecen, una por cada
 * negocio donde haya reservado. Es lo que separa «mis citas» y «mis facturas»
 * de las de los demas, asi que quien liste lo propio de un cliente pasa por
 * aqui en vez de preguntarle a core por su cuenta.
 */
@Injectable()
export class FichasDelUsuarioService {
  constructor(private readonly http: InternalHttpClient) {}

  /**
   * Ids de las fichas del usuario. Falla si core no responde: dar la lista por
   * vacia convertiria una caida en un «no tienes nada», que es peor que un
   * error, porque nadie lo mira dos veces.
   */
  async de(userId: string): Promise<string[]> {
    const fichas = await this.http.pedir<FichaDeCliente[]>(
      "core",
      `/internal/clients/by-user/${userId}`
    );

    return Array.isArray(fichas)
      ? fichas
          .map((ficha) => ficha.id)
          .filter((id): id is string => typeof id === "string")
      : [];
  }
}
