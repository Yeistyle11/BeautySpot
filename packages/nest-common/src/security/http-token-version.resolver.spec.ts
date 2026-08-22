import { HttpTokenVersionResolver } from "./http-token-version.resolver";
import { InternalHttpClient } from "../http/internal-http.client";

const USUARIO = "22222222-2222-4222-8222-222222222222";

describe("HttpTokenVersionResolver", () => {
  let http: { pedir: jest.Mock };

  function construir(): HttpTokenVersionResolver {
    return new HttpTokenVersionResolver(http as unknown as InternalHttpClient);
  }

  beforeEach(() => {
    http = { pedir: jest.fn().mockResolvedValue({ version: 7 }) };
  });

  it("pregunta a auth por la versión del usuario", async () => {
    const version = await construir().load(USUARIO);

    expect(version).toBe(7);
    expect(http.pedir).toHaveBeenCalledWith(
      "auth",
      `/internal/users/${USUARIO}/token-version`
    );
  });

  it("da la versión inicial cuando auth no devuelve cuerpo", async () => {
    http.pedir.mockResolvedValue(null);

    await expect(construir().load(USUARIO)).resolves.toBe(0);
  });

  it("propaga el fallo para que el store sepa que no pudo averiguarlo", async () => {
    http.pedir.mockRejectedValue(new Error("auth-service no está disponible"));

    await expect(construir().load(USUARIO)).rejects.toThrow(
      "auth-service no está disponible"
    );
  });

  it("no deja revocar desde un servicio que no posee la tabla", async () => {
    await expect(construir().bump()).rejects.toThrow(
      "Solo auth-service puede revocar sesiones"
    );
  });
});
