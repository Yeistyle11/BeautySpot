import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require("supertest");
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { CircuitBreakerService } from "../circuit-breaker/circuit-breaker.service";

/**
 * Regresión de enrutado bajo Express 5: la ruta comodín del proxy cambió de
 * ":service/*" a ":service/*splat" porque path-to-regexp v8 ya no acepta el
 * comodín sin nombre. Este test verifica, a través del router real, que el
 * gateway sigue capturando el nombre del servicio y reenviando cualquier
 * sub-ruta; si una futura actualización rompe el patrón, falla aquí y no en
 * producción.
 */
describe("ProxyController (enrutado Express 5)", () => {
  let app: INestApplication;
  let handled: { service: string; path: string } | null;

  beforeAll(async () => {
    handled = null;

    // El proxy real hace fetch a los microservicios; aquí se intercepta en el
    // borde (proxiedRequest) para observar solo el enrutado, sin red.
    const proxyServiceMock: Partial<ProxyService> = {
      isValidService: (service: string) =>
        ["core-service", "auth-service", "marketplace"].includes(service),
    };
    const circuitBreakerMock: Partial<CircuitBreakerService> = {
      execute: async (_service, fn) => fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        { provide: ProxyService, useValue: proxyServiceMock },
        { provide: CircuitBreakerService, useValue: circuitBreakerMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Sustituye el reenvío real: registra qué servicio y ruta llegaron y corta.
    const controller = app.get(ProxyController);
    (controller as unknown as Record<string, unknown>)["proxiedRequest"] = (
      service: string,
      req: { path: string },
      res: { status: (n: number) => { json: (b: unknown) => void } }
    ) => {
      handled = { service, path: req.path };
      res.status(200).json({ ok: true });
    };

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("captura el servicio y reenvía una sub-ruta con varios segmentos", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/core-service/businesses/123")
      .expect(200);

    expect(handled).toEqual({
      service: "core-service",
      path: "/api/v1/core-service/businesses/123",
    });
  });

  it("enruta cualquier método HTTP sobre el comodín", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth-service/login")
      .expect(200);

    expect(handled?.service).toBe("auth-service");
  });

  it("responde 404 ante un servicio no registrado", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/inexistente/algo")
      .expect(404);
  });
});

/**
 * Reenvío real (sin router): ejercita buildTargetUrl, buildForwardedHeaders,
 * parseResponseBody y mapProxyError contra un `fetch` simulado. El circuit
 * breaker se limita a ejecutar la función que recibe, para observar el proxy
 * aislado de la lógica de apertura/cierre del breaker.
 */
describe("ProxyController (reenvío)", () => {
  let controller: ProxyController;
  let fetchMock: jest.Mock;
  const SERVICE_URL = "http://localhost:3002";

  /** Respuesta mínima con la superficie que consume el controlador. */
  const fakeResponse = (status: number, body: string) => ({
    status,
    text: async () => body,
  });

  /** Petición Express mínima; `user` lo inyecta el guard de auth aguas arriba. */
  const fakeRequest = (
    overrides: Partial<{
      path: string;
      method: string;
      headers: Record<string, string>;
      body: unknown;
      user: { businessId?: string; businessIds?: string[] };
    }> = {}
  ) =>
    ({
      path: "/api/v1/core-service/businesses",
      method: "GET",
      headers: {},
      body: undefined,
      ...overrides,
    }) as never;

  /** Response Express mínima que registra status y cuerpo enviados. */
  const fakeResponseOut = () => {
    const sent: { status?: number; body?: unknown } = {};
    const res = {
      status: (code: number) => {
        sent.status = code;
        return { json: (body: unknown) => (sent.body = body) };
      },
    };
    return { res: res as never, sent };
  };

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        {
          provide: ProxyService,
          useValue: {
            isValidService: () => true,
            getServiceUrl: () => SERVICE_URL,
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: async (_service: string, fn: () => Promise<void>) => fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ProxyController);
  });

  describe("construcción de la URL destino", () => {
    it("quita el prefijo /api/v1/{service} y antepone el nombre de módulo", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({ path: "/api/v1/core-service/businesses/1" }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(
        `${SERVICE_URL}/core/businesses/1`
      );
    });

    it("acepta también el prefijo /v1/{service}", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({ path: "/v1/core-service/businesses" }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(`${SERVICE_URL}/core/businesses`);
    });

    it("deja la ruta intacta si el servicio no lleva sufijo -service", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "marketplace",
        fakeRequest({ path: "/api/v1/marketplace/profiles" }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(`${SERVICE_URL}/profiles`);
    });
  });

  describe("cabeceras reenviadas", () => {
    it("propaga authorization y resuelve el tenant desde user.businessId", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({
          headers: { authorization: "Bearer token" },
          user: { businessId: "negocio-1" },
        }),
        res
      );

      expect(fetchMock.mock.calls[0][1].headers).toEqual({
        authorization: "Bearer token",
        "x-business-id": "negocio-1",
      });
    });

    it("usa el primer businessIds cuando no hay businessId directo", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({ user: { businessIds: ["negocio-a", "negocio-b"] } }),
        res
      );

      expect(fetchMock.mock.calls[0][1].headers["x-business-id"]).toBe(
        "negocio-a"
      );
    });

    it("no inyecta tenant si el usuario no tiene negocios", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({ user: { businessIds: [] } }),
        res
      );

      expect(fetchMock.mock.calls[0][1].headers).toEqual({});
    });

    it("serializa el cuerpo y fija content-type en métodos con payload", async () => {
      fetchMock.mockResolvedValue(fakeResponse(201, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({ method: "POST", body: { nombre: "Sede Centro" } }),
        res
      );

      expect(fetchMock.mock.calls[0][1].headers["content-type"]).toBe(
        "application/json"
      );
      expect(fetchMock.mock.calls[0][1].body).toBe('{"nombre":"Sede Centro"}');
    });

    it("no envía cuerpo en GET", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
      expect(
        fetchMock.mock.calls[0][1].headers["content-type"]
      ).toBeUndefined();
    });
  });

  describe("cuerpo de la respuesta", () => {
    it("devuelve null en 204 sin leer el cuerpo", async () => {
      fetchMock.mockResolvedValue({
        status: 204,
        text: async () => {
          throw new Error("no debe leerse el cuerpo de un 204");
        },
      });
      const { res, sent } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(sent).toEqual({ status: 204, body: null });
    });

    it("devuelve null cuando el cuerpo viene vacío", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, ""));
      const { res, sent } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(sent).toEqual({ status: 200, body: null });
    });

    it("parsea el JSON del backend", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, '{"total":2}'));
      const { res, sent } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(sent.body).toEqual({ total: 2 });
    });

    it("envuelve como mensaje el cuerpo que no es JSON", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "texto plano"));
      const { res, sent } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(sent.body).toEqual({ message: "texto plano" });
    });
  });

  describe("traducción de errores", () => {
    it("convierte un 5xx del backend en 502 tras propagar la respuesta", async () => {
      fetchMock.mockResolvedValue(fakeResponse(500, '{"error":"boom"}'));
      const { res, sent } = fakeResponseOut();

      await expect(
        controller.proxyRequest("core-service", fakeRequest(), res)
      ).rejects.toMatchObject({ status: HttpStatus.BAD_GATEWAY });

      // El cliente recibe igualmente el cuerpo original del backend.
      expect(sent).toEqual({ status: 500, body: { error: "boom" } });
    });

    it("convierte el aborto por timeout en 504", async () => {
      const abort = new Error("abortado");
      abort.name = "AbortError";
      fetchMock.mockRejectedValue(abort);
      const { res } = fakeResponseOut();

      await expect(
        controller.proxyRequest("core-service", fakeRequest(), res)
      ).rejects.toMatchObject({ status: HttpStatus.GATEWAY_TIMEOUT });
    });

    it("convierte un fallo de red en 503", async () => {
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
      const { res } = fakeResponseOut();

      await expect(
        controller.proxyRequest("core-service", fakeRequest(), res)
      ).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
    });
  });
});
