import { api, setUnauthorizedHandler } from "../api";
import { ApiError, isAuthError } from "../api-error";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  } as unknown as Response;
}

function htmlResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => "text/html" },
    json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    },
  } as unknown as Response;
}

describe("api.request", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    setUnauthorizedHandler(null);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("llama al mismo origen, por el rewrite y no al gateway", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, data: null }));
    global.fetch = fetchMock;

    await api.get("/core/clients");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/core/clients",
      expect.anything()
    );
  });

  it("desenvuelve la forma { success, data } del gateway", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { success: true, data: { id: "1" } })
      );

    await expect(api.get("/x")).resolves.toEqual({ id: "1" });
  });

  it("lanza ApiError con el status y el mensaje del backend", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(422, { error: { message: "Faltan campos" } })
      );

    await expect(api.get("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "Faltan campos",
    });
  });

  // Un 400 sin sus motivos solo puede mostrarse como "Error de validacion",
  // que no dice que campo corregir.
  it("conserva los motivos de validacion que enumera el backend", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        error: {
          message: "Error de validación",
          details: {
            validation: ["La contraseña debe tener al menos 8 caracteres"],
          },
        },
      })
    );

    const error = (await api.get("/x").catch((e: unknown) => e)) as ApiError;

    expect(error.detalles).toEqual([
      "La contraseña debe tener al menos 8 caracteres",
    ]);
  });

  it("deja los motivos vacios cuando el error no los trae", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(409, { error: { message: "Ya existe" } })
      );

    const error = (await api.get("/x").catch((e: unknown) => e)) as ApiError;

    expect(error.detalles).toEqual([]);
  });

  it("no revienta cuando la respuesta de error no es JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse(502));

    const error = await api.get("/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toContain("502");
  });

  it("devuelve vacio en un 204 sin cuerpo", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
      json: async () => {
        throw new Error("no body");
      },
    } as unknown as Response);

    await expect(api.delete("/x")).resolves.toEqual({});
  });

  it("avisa al handler de sesion cuando el backend responde 401", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: "Token expirado" }));

    await expect(api.get("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("no renueva la sesion cuando el 401 viene del propio login", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(401, { error: { message: "Credenciales inválidas" } })
      );
    global.fetch = fetchMock;

    await expect(
      api.post("/auth/login", { email: "a@b.co", password: "mala" })
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.anything()
    );
  });

  it("no dispara el handler en un 403 (autenticado, sin permisos)", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(403, { message: "Sin permisos" }));

    await expect(api.get("/x")).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("isAuthError", () => {
  it("reconoce 401 y 403 como errores de sesion o permisos", () => {
    expect(isAuthError(new ApiError(401, "x"))).toBe(true);
    expect(isAuthError(new ApiError(403, "x"))).toBe(true);
  });

  it("no marca como error de sesion otros fallos", () => {
    expect(isAuthError(new ApiError(500, "x"))).toBe(false);
    expect(isAuthError(new Error("fallo de red"))).toBe(false);
  });
});
