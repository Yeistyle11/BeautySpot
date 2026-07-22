import { INestApplication } from "@nestjs/common";
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
