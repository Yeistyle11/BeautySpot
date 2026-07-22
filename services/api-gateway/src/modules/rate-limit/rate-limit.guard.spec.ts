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
    guard = new RateLimitGuard(redis as any);
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

  it("deja pasar la petición si Redis falla (fail-open)", async () => {
    redis.eval.mockRejectedValue(new Error("Redis caído"));
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });
});
