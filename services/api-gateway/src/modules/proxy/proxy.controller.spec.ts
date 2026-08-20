import { HttpStatus, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require("supertest");
import { ProxyController } from "./proxy.controller";
import { ProxyService } from "./proxy.service";
import { CircuitBreakerService } from "../circuit-breaker/circuit-breaker.service";
import { SessionService } from "../session/session.service";

/**
 * Comprueba, a traves del router real de Express 5, que la ruta comodin
 * ":service/*splat" captura el servicio y reenvia cualquier sub-ruta.
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
          // El paso por sesion se prueba aparte: aqui deja el cuerpo y la
          // respuesta tal cual.
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

  // La ruta se concatena sin normalizar y el analizador de URL de fetch
  // resuelve `%2e%2e` como `..`, que alcanzaria /internal/*.
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
 * Reenvio real (sin router): ejercita buildTargetUrl, buildForwardedHeaders,
 * parseResponseBody y mapProxyError contra un `fetch` simulado.
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
          // Servicio real: estos tests ejercitan su mecanica (URL destino,
          // cabeceras, cuerpo y traduccion de errores).
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
          // El paso por sesion se prueba aparte: aqui deja el cuerpo y la
          // respuesta tal cual.
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

    // La forma larga tiene que dar /feed y no /marketplace/feed: los
    // microservicios no definen setGlobalPrefix.
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
    // propaga tal cual y se escribe una sola vez.
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

/**
 * El paso por sesion corre tambien cuando el servicio rechaza la peticion: una
 * renovacion fallida es la que tiene que borrar las cookies.
 */
describe("ProxyController (rutas de sesión)", () => {
  let controller: ProxyController;
  let fetchMock: jest.Mock;
  let aplicarRespuesta: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    aplicarRespuesta = jest.fn(
      (_req: unknown, _res: unknown, cuerpo: unknown) => cuerpo
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        {
          provide: ProxyService,
          useFactory: () =>
            new ProxyService({
              getUrl: () => "http://auth:3001",
              hasUrl: () => true,
            } as never),
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: <T>(_service: string, fn: () => Promise<T>) => fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            esRutaDeSesion: (path: string) => path.includes("/auth/"),
            cuerpoReenviado: (_req: unknown, cuerpo: unknown) => cuerpo,
            aplicarRespuesta,
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(ProxyController);
  });

  /** Reenvía esa ruta con la respuesta que devuelva el servicio de destino. */
  async function reenviar(path: string, estado: number) {
    fetchMock.mockResolvedValue({ status: estado, text: async () => "{}" });
    const req = {
      path,
      originalUrl: path,
      method: "POST",
      headers: {},
      body: {},
    } as never;
    const res = {
      status: () => ({ json: () => undefined }),
    } as never;

    try {
      await controller.proxyRequest("auth", req, res);
    } catch {
      // Un 4xx se propaga como excepción; lo que importa es lo que pasó antes.
    }
  }

  it("pasa por sesión una renovación correcta", async () => {
    await reenviar("/api/v1/auth/refresh", 200);

    expect(aplicarRespuesta).toHaveBeenCalled();
  });

  // Sin esto, la sesion rechazada conserva su pista y el guard devuelve al
  // panel a quien acaba de ser echado.
  it("pasa por sesión una renovación rechazada", async () => {
    await reenviar("/api/v1/auth/refresh", 401);

    expect(aplicarRespuesta).toHaveBeenCalled();
  });

  it("pasa por sesión un cierre de sesión, responda lo que responda", async () => {
    await reenviar("/api/v1/auth/logout", 500);

    expect(aplicarRespuesta).toHaveBeenCalled();
  });

  it("no toca las rutas que no son de sesión", async () => {
    await reenviar("/api/v1/core/businesses", 401);

    expect(aplicarRespuesta).not.toHaveBeenCalled();
  });
});
