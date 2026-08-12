import { Logger } from "@nestjs/common";
import { of, throwError, lastValueFrom } from "rxjs";
import { LatenciaInterceptor, UMBRAL_LENTO_MS } from "./latencia.interceptor";

/** Contexto HTTP mínimo con la petición y la respuesta que mira el interceptor. */
function contextoHttp(
  request: Record<string, unknown>,
  statusCode = 200
): never {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
  } as never;
}

describe("LatenciaInterceptor", () => {
  let interceptor: LatenciaInterceptor;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LatenciaInterceptor();
    log = jest.spyOn(Logger.prototype, "log").mockImplementation();
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it("registra método, ruta, estado y duración", async () => {
    const contexto = contextoHttp(
      { method: "GET", route: { path: "/appointments" } },
      200
    );

    await lastValueFrom(
      interceptor.intercept(contexto, { handle: () => of("ok") })
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/appointments 200 \d+ms$/)
    );
  });

  // Con la URL concreta cada identificador sería una ruta distinta y no se
  // podrían agregar los tiempos.
  it("prefiere el patrón de la ruta a la URL concreta", async () => {
    const contexto = contextoHttp({
      method: "GET",
      route: { path: "/appointments/:id" },
      url: "/appointments/7d3f",
    });

    await lastValueFrom(
      interceptor.intercept(contexto, { handle: () => of("ok") })
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("/appointments/:id")
    );
  });

  it("cae a la URL cuando no hay patrón", async () => {
    const contexto = contextoHttp({ method: "GET", url: "/salud" });

    await lastValueFrom(
      interceptor.intercept(contexto, { handle: () => of("ok") })
    );

    expect(log).toHaveBeenCalledWith(expect.stringContaining("/salud"));
  });

  // Una petición que tarda tres segundos en dar un error sigue siendo un
  // problema de rendimiento.
  it("mide también lo que falla", async () => {
    const contexto = contextoHttp({ method: "POST", url: "/pagos" }, 500);

    await expect(
      lastValueFrom(
        interceptor.intercept(contexto, {
          handle: () => throwError(() => new Error("falló")),
        })
      )
    ).rejects.toThrow("falló");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("POST /pagos"));
  });

  it("avisa cuando la petición pasa del umbral", async () => {
    const contexto = contextoHttp({ method: "GET", url: "/lento" });
    const ahora = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(UMBRAL_LENTO_MS);

    await lastValueFrom(
      interceptor.intercept(contexto, { handle: () => of("ok") })
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`${UMBRAL_LENTO_MS}ms`)
    );
    expect(log).not.toHaveBeenCalled();
    ahora.mockRestore();
  });

  it("no toca los contextos que no son HTTP", async () => {
    const contexto = { getType: () => "rpc" } as never;

    await lastValueFrom(
      interceptor.intercept(contexto, { handle: () => of("ok") })
    );

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
