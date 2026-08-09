import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require("supertest");
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { CircuitBreakerService } from "../circuit-breaker/circuit-breaker.service";
import { SessionService } from "../session/session.service";

/**
 * Comprueba, a través del router real de Express 5, que la ruta comodín
 * ":service/*splat" captura el nombre del servicio y reenvía cualquier
 * sub-ruta.
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
        {
          // El paso por sesión se prueba aparte; aquí sólo debe dejar el
          // cuerpo y la respuesta tal cual para no enmascarar el enrutado.
          provide: SessionService,
          useValue: {
            esRutaDeSesion: () => false,
            cuerpoReenviado: (_req: unknown, cuerpo: unknown) => cuerpo,
            aplicarRespuesta: (_req: unknown, _res: unknown, cuerpo: unknown) =>
              cuerpo,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Sustituye el reenvío real: registra qué servicio y ruta llegaron y corta.
    const controller = app.get(ProxyController);
    (controller as unknown as Record<string, unknown>)["proxiedRequest"] = (
      service: string,
      req: { path: string }
    ) => {
      handled = { service, path: req.path };
      return { estado: 200, cuerpo: { ok: true } };
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

  // La ruta se concatena con la URL del servicio sin normalizar, y el
  // analizador de URL de fetch resuelve `%2e%2e` como un `..`: sin este
  // rechazo se podría alcanzar /internal/* del backend.
  it.each([
    "/api/v1/core-service/x/../../internal/businesses/resolve",
    "/api/v1/core-service/x/%2e%2e/%2e%2e/internal/businesses/resolve",
    "/api/v1/core-service/x/%2E%2E/internal/algo",
  ])("rechaza el salto de directorio en %s", async (path) => {
    handled = null;

    await request(app.getHttpServer()).get(path).expect(400);

    // Se rechaza antes de reenviar: el backend no llega a ver la petición.
    expect(handled).toBeNull();
  });

  it("no confunde con un salto los puntos dentro de un segmento", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/core-service/businesses/mi..negocio")
      .expect(200);

    expect(handled?.service).toBe("core-service");
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
  let breakerFallos: number;
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
      originalUrl: string;
      method: string;
      headers: Record<string, string>;
      body: unknown;
      user: { businessId?: string; businessIds?: string[] };
    }> = {}
  ) => {
    const path = overrides.path ?? "/api/v1/core-service/businesses";
    return {
      path,
      originalUrl: path,
      method: "GET",
      headers: {},
      body: undefined,
      ...overrides,
    } as never;
  };

  /** Response Express mínima que registra status, cuerpo y cuántas veces se escribió. */
  const fakeResponseOut = () => {
    const sent: { status?: number; body?: unknown } = {};
    const contador = { escrituras: 0 };
    const res = {
      status: (code: number) => {
        sent.status = code;
        return {
          json: (body: unknown) => {
            contador.escrituras++;
            sent.body = body;
          },
        };
      },
    };
    return { res: res as never, sent, contador };
  };

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    breakerFallos = 0;

    const moduleRef = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        {
          // Servicio real: estos tests ejercitan justamente su mecánica
          // (URL destino, cabeceras, cuerpo de la respuesta y traducción de
          // errores).
          provide: ProxyService,
          useFactory: () =>
            new ProxyService({
              getUrl: () => SERVICE_URL,
              hasUrl: () => true,
            } as never),
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: async <T>(_service: string, fn: () => Promise<T>) => {
              try {
                return await fn();
              } catch (error) {
                breakerFallos++;
                throw error;
              }
            },
          },
        },
        {
          // El paso por sesión se prueba aparte; aquí sólo debe dejar el
          // cuerpo y la respuesta tal cual para no enmascarar el enrutado.
          provide: SessionService,
          useValue: {
            esRutaDeSesion: () => false,
            cuerpoReenviado: (_req: unknown, cuerpo: unknown) => cuerpo,
            aplicarRespuesta: (_req: unknown, _res: unknown, cuerpo: unknown) =>
              cuerpo,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ProxyController);
  });

  describe("construcción de la URL destino", () => {
    it("quita el prefijo /api/v1/{service}", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core",
        fakeRequest({ path: "/api/v1/core/businesses/1" }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(`${SERVICE_URL}/businesses/1`);
    });

    it("conserva la cadena de consulta", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core",
        fakeRequest({
          path: "/api/v1/core/clients",
          originalUrl: "/api/v1/core/clients?page=2&limit=5&search=ana",
        }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(
        `${SERVICE_URL}/clients?page=2&limit=5&search=ana`
      );
    });

    it("acepta también el prefijo /v1/{service}", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core",
        fakeRequest({ path: "/v1/core/businesses" }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(`${SERVICE_URL}/businesses`);
    });

    // Regresión: la forma larga producía /marketplace/feed en vez de /feed, así
    // que TODA petición con sufijo -service devolvía 404. Los microservicios no
    // definen setGlobalPrefix: sus controladores cuelgan de la raíz.
    it("resuelve igual la forma larga {service}-service", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "marketplace-service",
        fakeRequest({ path: "/api/v1/marketplace-service/feed" }),
        res
      );

      expect(fetchMock.mock.calls[0][0]).toBe(`${SERVICE_URL}/feed`);
    });

    it("deja la ruta intacta con el nombre corto", async () => {
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
    // El navegador manda la cookie httpOnly; los servicios leen Authorization.
    it("traduce la cookie de sesión a una cabecera Bearer", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({
          headers: { cookie: "bs_access=token-de-cookie; otra=x" },
          user: { businessId: "negocio-1" },
        }),
        res
      );

      expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(
        "Bearer token-de-cookie"
      );
    });

    it("da preferencia a la cabecera Authorization sobre la cookie", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest(
        "core-service",
        fakeRequest({
          headers: {
            authorization: "Bearer de-cabecera",
            cookie: "bs_access=de-cookie",
          },
        }),
        res
      );

      expect(fetchMock.mock.calls[0][1].headers.authorization).toBe(
        "Bearer de-cabecera"
      );
    });

    it("no inventa cabecera de autorización si no hay ni cookie ni cabecera", async () => {
      fetchMock.mockResolvedValue(fakeResponse(200, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest({}), res);

      expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
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
    // El 5xx cuenta como fallo para el breaker, pero el cuerpo del backend se
    // propaga tal cual y se escribe UNA sola vez: si el controlador relanzara
    // después de responder, el filtro global reventaría con
    // ERR_HTTP_HEADERS_SENT en cada 500 de cualquier servicio.
    it("propaga el 5xx del backend sin relanzar tras haber respondido", async () => {
      fetchMock.mockResolvedValue(fakeResponse(500, '{"error":"boom"}'));
      const { res, sent, contador } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(sent).toEqual({ status: 500, body: { error: "boom" } });
      expect(contador.escrituras).toBe(1);
    });

    it("cuenta el 5xx como fallo del circuit breaker", async () => {
      fetchMock.mockResolvedValue(fakeResponse(500, "{}"));
      const { res } = fakeResponseOut();

      await controller.proxyRequest("core-service", fakeRequest(), res);

      expect(breakerFallos).toBe(1);
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
