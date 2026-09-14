import { FichasDelUsuarioService } from "./fichas-del-usuario.service";
import { InternalHttpClient } from "../http/internal-http.client";

const USUARIO = "22222222-2222-4222-8222-222222222222";

describe("FichasDelUsuarioService", () => {
  let http: { pedir: jest.Mock };

  function construir(): FichasDelUsuarioService {
    return new FichasDelUsuarioService(http as unknown as InternalHttpClient);
  }

  beforeEach(() => {
    http = { pedir: jest.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]) };
  });

  it("pregunta a core por las fichas de ese usuario", async () => {
    const ids = await construir().de(USUARIO);

    expect(http.pedir).toHaveBeenCalledWith(
      "core",
      `/internal/clients/by-user/${USUARIO}`
    );
    expect(ids).toEqual(["a", "b"]);
  });

  it("descarta las fichas cuyo id no es un texto", async () => {
    http.pedir.mockResolvedValue([{ id: "a" }, { id: 7 }, {}]);

    expect(await construir().de(USUARIO)).toEqual(["a"]);
  });

  it("da la lista por vacia cuando core responde algo que no es una lista", async () => {
    http.pedir.mockResolvedValue(null);

    expect(await construir().de(USUARIO)).toEqual([]);
  });

  it("falla si core no responde, en vez de decir que no tiene nada", async () => {
    http.pedir.mockRejectedValue(new Error("core caido"));

    await expect(construir().de(USUARIO)).rejects.toThrow("core caido");
  });
});
