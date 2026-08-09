import { ConfigService } from "@nestjs/config";
import { ZonaDelNegocioService } from "./zona-del-negocio.service";
import { InternalHttpClient } from "../http/internal-http.client";
import { RedisCacheService } from "../cache/redis-cache.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";

describe("ZonaDelNegocioService", () => {
  let http: { pedirONulo: jest.Mock };
  let cache: { remember: jest.Mock };

  /** Caché que ejecuta la carga y recuerda el resultado, como la real. */
  function cacheDeVerdad() {
    const guardado = new Map<string, unknown>();
    return {
      remember: jest.fn(async (clave: string, _ttl: number, cargar) => {
        if (guardado.has(clave)) return guardado.get(clave);
        const valor = await cargar();
        guardado.set(clave, valor);
        return valor;
      }),
    };
  }

  function construir(env: Record<string, string> = {}): ZonaDelNegocioService {
    const config = {
      get: (clave: string) => env[clave],
    } as unknown as ConfigService;

    return new ZonaDelNegocioService(
      http as unknown as InternalHttpClient,
      cache as unknown as RedisCacheService,
      config
    );
  }

  beforeEach(() => {
    http = {
      pedirONulo: jest
        .fn()
        .mockResolvedValue({ business: { timezone: "Europe/Madrid" } }),
    };
    cache = cacheDeVerdad();
  });

  it("devuelve el huso que tiene configurado el negocio", async () => {
    await expect(construir().de(NEGOCIO)).resolves.toBe("Europe/Madrid");

    expect(http.pedirONulo).toHaveBeenCalledWith(
      "core",
      expect.stringContaining(
        `/internal/profiles/resolve?businessId=${NEGOCIO}`
      )
    );
  });

  it("no vuelve a preguntar a core mientras la respuesta esté cacheada", async () => {
    const servicio = construir();

    await servicio.de(NEGOCIO);
    await servicio.de(NEGOCIO);

    expect(http.pedirONulo).toHaveBeenCalledTimes(1);
  });

  // Falla en abierto a propósito: negarse a pintar la agenda por no poder leer
  // un huso sería peor que el problema.
  it("cae al huso por defecto si core no responde", async () => {
    http.pedirONulo.mockResolvedValue(null);

    await expect(construir().de(NEGOCIO)).resolves.toBe("America/Bogota");
  });

  it("cae al huso por defecto si el negocio no existe", async () => {
    http.pedirONulo.mockResolvedValue({ business: null });

    await expect(construir().de(NEGOCIO)).resolves.toBe("America/Bogota");
  });

  it("respeta el huso por defecto que se configure por entorno", async () => {
    http.pedirONulo.mockResolvedValue(null);

    await expect(
      construir({ BUSINESS_TIMEZONE: "America/Mexico_City" }).de(NEGOCIO)
    ).resolves.toBe("America/Mexico_City");
  });

  it("no consulta nada si no hay negocio que resolver", async () => {
    await expect(construir().de("")).resolves.toBe("America/Bogota");

    expect(http.pedirONulo).not.toHaveBeenCalled();
    expect(cache.remember).not.toHaveBeenCalled();
  });
});
