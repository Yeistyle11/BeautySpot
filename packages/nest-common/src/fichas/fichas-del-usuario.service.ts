import { Injectable } from "@nestjs/common";
import { InternalHttpClient } from "../http/internal-http.client";

/** Lo que interesa de `/internal/clients/by-user`: el id de cada ficha. */
interface FichaDeCliente {
  id?: unknown;
}

/** Resuelve las fichas de cliente que pertenecen a un usuario. */
@Injectable()
export class FichasDelUsuarioService {
  constructor(private readonly http: InternalHttpClient) {}

  /** Ids de las fichas del usuario. Falla si core no responde. */
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
