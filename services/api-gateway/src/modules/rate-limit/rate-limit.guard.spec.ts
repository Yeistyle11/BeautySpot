import { ExecutionContext, HttpException } from "@nestjs/common";
import { RateLimitGuard } from "./rate-limit.guard";
import {
  RATE_LIMIT_AUTH_REQUESTS,
  RATE_LIMIT_GENERAL_REQUESTS,
  RATE_LIMIT_RESERVA_PUBLICA_REQUESTS,
} from "@beautyspot/shared-constants";

describe("RateLimitGuard", () => {
  let redis: { eval: jest.Mock };
  let guard: RateLimitGuard;

  /** Respuesta de la ultima peticion, para poder leerle las cabeceras. */
  let cabeceras: Record<string, unknown>;

  const contextFor = (request: any): ExecutionContext => {
    cabeceras = {};
    const response = {
      setHeader: (nombre: string, valor: unknown) => {
        cabeceras[nombre] = valor;
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  /** El contador responde ese conteo, con lo que le queda a la ventana. */
  const cuenta = (count: number, ttl = 60) => [count, ttl];

  beforeEach(() => {
    redis = { eval: jest.fn() };
    // Sin valores configurados se usan los límites por defecto.
    guard = new RateLimitGuard(redis as any, { get: () => undefined } as any);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("permite peticiones por debajo del límite general", async () => {
    redis.eval.mockResolvedValue(cuenta(1));
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("bloquea al superar el límite general", async () => {
    redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_GENERAL_REQUESTS + 1));
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      HttpException
    );
  });

  it("aplica un contador por IP y otro por cuenta en login", async () => {
    redis.eval.mockResolvedValue(cuenta(1));
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
      .mockResolvedValueOnce(cuenta(1)) // contador por IP: primera desde esta IP
      .mockResolvedValueOnce(cuenta(RATE_LIMIT_AUTH_REQUESTS + 1)); // por cuenta: saturado
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
    redis.eval.mockResolvedValue(cuenta(1));
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
    redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_AUTH_REQUESTS + 1));
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
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
  ])("trata %s como ruta de credenciales", async (path) => {
    redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_AUTH_REQUESTS + 1));

    await expect(
      guard.canActivate(contextFor({ path, ip: "1.1.1.1", body: {} }))
    ).rejects.toThrow(HttpException);
  });

  it("deja el refresco de sesión en el límite general", async () => {
    // El contador es por IP y detrás de un NAT muchos usuarios comparten una:
    // con el límite estricto se cerrarían sesiones legítimas.
    redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_AUTH_REQUESTS + 1));
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
    redis.eval.mockResolvedValue(cuenta(3));
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    // El límite del .env manda sobre la constante por defecto.
    await expect(conConfig.canActivate(contextFor(request))).rejects.toThrow(
      HttpException
    );
  });

  it("deja pasar el trafico corriente si Redis falla", async () => {
    redis.eval.mockRejectedValue(new Error("Redis caído"));
    const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });

  describe("reserva publica", () => {
    const RUTA = "/api/v1/booking/public/appointments";

    const reserva = (body: Record<string, unknown> = {}) => ({
      path: RUTA,
      ip: "1.1.1.1",
      body,
    });

    it("tiene su propio presupuesto, mas estrecho que el general", async () => {
      redis.eval.mockResolvedValue(
        cuenta(RATE_LIMIT_RESERVA_PUBLICA_REQUESTS + 1)
      );

      await expect(guard.canActivate(contextFor(reserva()))).rejects.toThrow(
        HttpException
      );
      expect(RATE_LIMIT_RESERVA_PUBLICA_REQUESTS).toBeLessThan(
        RATE_LIMIT_GENERAL_REQUESTS
      );
    });

    it("cuenta tambien por el correo del invitado, no solo por IP", async () => {
      redis.eval.mockResolvedValue(cuenta(1));

      await guard.canActivate(
        contextFor(reserva({ guestEmail: " Ana@Example.com " }))
      );

      const claves = redis.eval.mock.calls.map((llamada) => llamada[2]);
      expect(claves).toContain("rate-limit:ip:1.1.1.1:reserva");
      expect(claves).toContain("rate-limit:invitado:ana@example.com");
    });

    it("si no dio correo, cuenta por el telefono", async () => {
      redis.eval.mockResolvedValue(cuenta(1));

      await guard.canActivate(
        contextFor(reserva({ guestPhone: "300 123 4567" }))
      );

      const claves = redis.eval.mock.calls.map((llamada) => llamada[2]);
      expect(claves).toContain("rate-limit:invitado:3001234567");
    });

    it("sin contacto se queda con el contador por IP", async () => {
      redis.eval.mockResolvedValue(cuenta(1));

      await guard.canActivate(contextFor(reserva({ guestName: "Ana" })));

      expect(redis.eval).toHaveBeenCalledTimes(1);
    });
  });

  describe("cuando Redis no responde", () => {
    /** Estado del rechazo, o null si la peticion paso. */
    async function estadoDe(request: any): Promise<number | null> {
      redis.eval.mockRejectedValue(new Error("Redis caído"));
      try {
        await guard.canActivate(contextFor(request));
        return null;
      } catch (error) {
        return (error as HttpException).getStatus();
      }
    }

    it("cierra la reserva publica: sin contar no hay limite", async () => {
      const estado = await estadoDe({
        path: "/api/v1/booking/public/appointments",
        ip: "1.1.1.1",
        body: { guestEmail: "ana@example.com" },
      });

      expect(estado).toBe(503);
    });

    it("cierra tambien las rutas de credenciales", async () => {
      const estado = await estadoDe({
        path: "/api/v1/auth/login",
        ip: "1.1.1.1",
        body: { email: "ana@example.com" },
      });

      expect(estado).toBe(503);
    });

    it("no confunde el cierre con un exceso de peticiones", async () => {
      redis.eval.mockRejectedValue(new Error("Redis caído"));
      const request = {
        path: "/api/v1/auth/login",
        ip: "1.1.1.1",
        body: {},
      };

      await guard
        .canActivate(contextFor(request))
        .then(() => {
          throw new Error("debería haber cerrado");
        })
        .catch((error: HttpException) => {
          const cuerpo = error.getResponse() as { error: { code: string } };
          expect(cuerpo.error.code).toBe("RATE_LIMIT_UNAVAILABLE");
        });
    });
  });

  describe("cuando bloquea, dice cuanto esperar", () => {
    /** Lanza una peticion saturada y devuelve el cuerpo del 429. */
    async function rechazo(path: string, ttl: number) {
      redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_AUTH_REQUESTS + 1, ttl));
      const request = { path, ip: "1.1.1.1", body: {} };

      try {
        await guard.canActivate(contextFor(request));
        throw new Error("no bloqueó");
      } catch (error) {
        return (error as HttpException).getResponse() as {
          error: { message: string };
        };
      }
    }

    // "Demasiadas solicitudes" a secas es indistinguible de una caída: quien lo
    // lee no sabe si esperar, corregir algo o llamar a soporte.
    it("nombra los segundos que faltan, no una espera generica", async () => {
      const cuerpo = await rechazo("/api/v1/auth/login", 42);

      expect(cuerpo.error.message).toBe(
        "Demasiados intentos. Espera 42 segundos y vuelve a intentarlo."
      );
    });

    it("concuerda el singular cuando falta un segundo", async () => {
      const cuerpo = await rechazo("/api/v1/auth/login", 1);

      expect(cuerpo.error.message).toContain("Espera 1 segundo y");
    });

    it("habla de solicitudes fuera de las rutas de credenciales", async () => {
      redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_GENERAL_REQUESTS + 1, 30));
      const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

      try {
        await guard.canActivate(contextFor(request));
      } catch (error) {
        const cuerpo = (error as HttpException).getResponse() as {
          error: { message: string };
        };
        expect(cuerpo.error.message).toBe(
          "Demasiadas solicitudes. Espera 30 segundos y vuelve a intentarlo."
        );
      }
    });

    it("emite Retry-After con lo que queda de la ventana", async () => {
      await rechazo("/api/v1/auth/login", 42);

      expect(cabeceras["Retry-After"]).toBe(42);
    });

    // Un TTL negativo es una clave sin caducidad o ya ida: se promete, como
    // mucho, una ventana entera.
    it("cae a la ventana completa si el contador no tiene caducidad", async () => {
      const cuerpo = await rechazo("/api/v1/auth/login", -1);

      expect(cuerpo.error.message).toContain("Espera 60 segundos");
    });
  });

  describe("cabeceras del limitador", () => {
    it("dice cuanto queda antes de chocar, tambien al dejar pasar", async () => {
      redis.eval.mockResolvedValue(cuenta(3, 45));
      const request = { path: "/api/v1/clients", ip: "1.1.1.1", body: {} };

      await guard.canActivate(contextFor(request));

      expect(cabeceras["RateLimit-Limit"]).toBe(RATE_LIMIT_GENERAL_REQUESTS);
      expect(cabeceras["RateLimit-Remaining"]).toBe(
        RATE_LIMIT_GENERAL_REQUESTS - 3
      );
      expect(cabeceras["RateLimit-Reset"]).toBe(45);
      expect(cabeceras["Retry-After"]).toBeUndefined();
    });

    it("no baja de cero lo que queda", async () => {
      redis.eval.mockResolvedValue(cuenta(RATE_LIMIT_AUTH_REQUESTS + 5, 20));
      const request = { path: "/api/v1/auth/login", ip: "1.1.1.1", body: {} };

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        HttpException
      );
      expect(cabeceras["RateLimit-Remaining"]).toBe(0);
    });

    // De los dos contadores manda el que va mas lleno: es el que decide.
    it("informa del contador que va mas lleno", async () => {
      redis.eval
        .mockResolvedValueOnce(cuenta(1, 55))
        .mockResolvedValueOnce(cuenta(4, 12));
      const request = {
        path: "/api/v1/auth/login",
        ip: "1.1.1.1",
        body: { email: "victima@example.com" },
      };

      await guard.canActivate(contextFor(request));

      expect(cabeceras["RateLimit-Remaining"]).toBe(
        RATE_LIMIT_AUTH_REQUESTS - 4
      );
      expect(cabeceras["RateLimit-Reset"]).toBe(12);
    });
  });
});
