import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { InternalHttpClient } from "./internal-http.client";

/** Construye el cliente con la configuración indicada. */
function clienteCon(config: Record<string, string> = {}): InternalHttpClient {
  const configService = {
    get: (clave: string, porDefecto?: string) => config[clave] ?? porDefecto,
  } as unknown as ConfigService;
  const cliente = new InternalHttpClient(configService);
  jest.spyOn(cliente["logger"], "warn").mockImplementation(() => undefined);
  return cliente;
}

/** Respuesta simulada de fetch. */
function respuesta(cuerpo: unknown, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => cuerpo,
  } as unknown as Response;
}

describe("InternalHttpClient", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe("pedir", () => {
    it("resuelve la URL del servicio y manda el secreto interno", async () => {
      fetchMock.mockResolvedValue(
        respuesta({ success: true, data: { id: 1 } })
      );
      const cliente = clienteCon({
        CORE_SERVICE_URL: "http://core:3002",
        INTERNAL_API_SECRET: "s3creto",
      });

      await cliente.pedir("core", "/internal/algo");

      const [url, opciones] = fetchMock.mock.calls[0];
      expect(url).toBe("http://core:3002/internal/algo");
      expect(opciones.headers["x-internal-secret"]).toBe("s3creto");
    });

    it("usa el puerto local del servicio si no hay variable de entorno", async () => {
      fetchMock.mockResolvedValue(respuesta({ success: true, data: null }));

      await clienteCon().pedir("booking", "/internal/x");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "http://localhost:3003/internal/x"
      );
    });

    it("aplica un tiempo límite a la petición", async () => {
      fetchMock.mockResolvedValue(respuesta({ success: true, data: null }));

      await clienteCon().pedir("core", "/internal/x");

      // Sin límite, un servicio colgado retiene al que espera indefinidamente.
      expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    });

    it("saca el dato del sobre { success, data }", async () => {
      fetchMock.mockResolvedValue(
        respuesta({ success: true, data: [{ id: "a" }] })
      );

      const datos = await clienteCon().pedir("core", "/internal/x");

      expect(datos).toEqual([{ id: "a" }]);
    });

    it("acepta una respuesta que no venga envuelta", async () => {
      fetchMock.mockResolvedValue(respuesta({ nombre: "Peluquería" }));

      const datos = await clienteCon().pedir("core", "/internal/x");

      expect(datos).toEqual({ nombre: "Peluquería" });
    });

    it("falla si el sobre no trae datos, en vez de propagar un undefined", async () => {
      fetchMock.mockResolvedValue(respuesta({ success: true }));

      await expect(clienteCon().pedir("core", "/internal/x")).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it("falla si el otro servicio responde con error", async () => {
      fetchMock.mockResolvedValue(respuesta({}, { status: 503 }));

      await expect(clienteCon().pedir("core", "/internal/x")).rejects.toThrow(
        "core-service respondió 503"
      );
    });

    it("falla si no se puede conectar", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(clienteCon().pedir("core", "/internal/x")).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it("falla si el cuerpo no es JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Unexpected token");
        },
      } as unknown as Response);

      await expect(clienteCon().pedir("core", "/internal/x")).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it("devuelve null ante un 404 cuando se pide así", async () => {
      fetchMock.mockResolvedValue(respuesta({}, { status: 404 }));

      const datos = await clienteCon().pedir("core", "/internal/x", {
        noEncontradoComoNulo: true,
      });

      expect(datos).toBeNull();
    });
  });

  describe("enviar", () => {
    it("manda el cuerpo como JSON por POST", async () => {
      fetchMock.mockResolvedValue(
        respuesta({ success: true, data: { id: "c-1" } })
      );

      const datos = await clienteCon().enviar("core", "/internal/clientes", {
        nombre: "Ana",
      });

      const [, opciones] = fetchMock.mock.calls[0];
      expect(opciones.method).toBe("POST");
      expect(opciones.body).toBe('{"nombre":"Ana"}');
      expect(opciones.headers["Content-Type"]).toBe("application/json");
      expect(datos).toEqual({ id: "c-1" });
    });
  });

  describe("pedirONulo", () => {
    it("devuelve null en lugar de fallar cuando el servicio no responde", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

      const datos = await clienteCon().pedirONulo("core", "/internal/x");

      expect(datos).toBeNull();
    });

    it("devuelve el dato con normalidad cuando sí responde", async () => {
      fetchMock.mockResolvedValue(respuesta({ success: true, data: 42 }));

      await expect(
        clienteCon().pedirONulo("core", "/internal/x")
      ).resolves.toBe(42);
    });
  });
});
