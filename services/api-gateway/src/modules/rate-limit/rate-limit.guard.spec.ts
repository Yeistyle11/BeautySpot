import { ExecutionContext, HttpException } from "@nestjs/common";
import { RateLimitGuard } from "./rate-limit.guard";
import {
  RATE_LIMIT_AUTH_REQUESTS,
  RATE_LIMIT_GENERAL_REQUESTS,
} from "@beautyspot/shared-constants";

describe("RateLimitGuard", () => {
  let redis: { eval: jest.Mock };
  let guard: RateLimitGuard;

  const contextFor = (request: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    redis = { eval: jest.fn() };
    // Sin valores configurados se usan los límites por defecto.
    guard = new RateLimitGuard(redis as any, { get: () => undefined } as any);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("permite peticiones por debajo del límite general", async () => {
    redis.eval.mockResolvedValue(1);
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("bloquea al superar el límite general", async () => {
    redis.eval.mockResolvedValue(RATE_LIMIT_GENERAL_REQUESTS + 1);
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      HttpException
    );
  });

  it("aplica un contador por IP y otro por cuenta en login", async () => {
    redis.eval.mockResolvedValue(1);
    const request = {
      path: "/api/v1/auth/login",
      ip: "1.1.1.1",
      body: { email: "Victima@Example.com" },
    };

    await guard.canActivate(contextFor(request));

    expect(redis.eval).toHaveBeenCalledTimes(2);
    const keys = redis.eval.mock.calls.map((call) => call[2]);
    expect(keys).toContain("rate-limit:ip:1.1.1.1:auth");
    // El email se normaliza para que el contador por cuenta no dependa de
    // mayúsculas ni espacios.
    expect(keys).toContain("rate-limit:account:victima@example.com");
  });

  it("bloquea por cuenta aunque la IP cambie (credential stuffing)", async () => {
    redis.eval
      .mockResolvedValueOnce(1) // contador por IP: primera desde esta IP
      .mockResolvedValueOnce(RATE_LIMIT_AUTH_REQUESTS + 1); // por cuenta: saturado
    const request = {
      path: "/api/v1/auth/login",
      ip: "9.9.9.9",
      body: { email: "victima@example.com" },
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      HttpException
    );
  });

  it("aplica el límite estricto también por el alias con sufijo -service", async () => {
    redis.eval.mockResolvedValue(1);
    const request = {
      path: "/api/v1/auth-service/login",
      ip: "1.1.1.1",
      body: { email: "victima@example.com" },
    };

    await guard.canActivate(contextFor(request));

    // La ruta alternativa apunta al mismo backend: debe crear también el
    // contador por cuenta, que es la defensa contra credential stuffing.
    const keys = redis.eval.mock.calls.map((call) => call[2]);
    expect(keys).toContain("rate-limit:ip:1.1.1.1:auth");
    expect(keys).toContain("rate-limit:account:victima@example.com");
  });

  it("bloquea el alias -service al superar el límite de autenticación", async () => {
    redis.eval.mockResolvedValue(RATE_LIMIT_AUTH_REQUESTS + 1);
    const request = {
      path: "/api/v1/auth-service/login",
      ip: "1.1.1.1",
      body: { email: "victima@example.com" },
    };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      HttpException
    );
  });

  it.each([
    "/api/v1/auth/forgot-password",
    "/api/v1/auth-service/reset-password",
  ])("trata %s como ruta de credenciales", async (path) => {
    redis.eval.mockResolvedValue(RATE_LIMIT_AUTH_REQUESTS + 1);

    await expect(
      guard.canActivate(contextFor({ path, ip: "1.1.1.1", body: {} }))
    ).rejects.toThrow(HttpException);
  });

  it("deja el refresco de sesión en el límite general", async () => {
    // El contador es por IP y detrás de un NAT muchos usuarios comparten una:
    // con el límite estricto se cerrarían sesiones legítimas.
    redis.eval.mockResolvedValue(RATE_LIMIT_AUTH_REQUESTS + 1);
    const request = { path: "/api/v1/auth/refresh", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });

  it("respeta el límite configurado en el entorno", async () => {
    const conConfig = new RateLimitGuard(
      redis as any,
      {
        get: (clave: string) =>
          clave === "RATE_LIMIT_GENERAL_MAX" ? "2" : undefined,
      } as any
    );
    redis.eval.mockResolvedValue(3);
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    // Estaba en los .env y el guard lo ignoraba, usando su constante fija.
    await expect(conConfig.canActivate(contextFor(request))).rejects.toThrow(
      HttpException
    );
  });

  it("deja pasar la petición si Redis falla (fail-open)", async () => {
    redis.eval.mockRejectedValue(new Error("Redis caído"));
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });
});
