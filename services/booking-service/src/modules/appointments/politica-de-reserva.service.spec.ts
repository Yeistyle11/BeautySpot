import { InternalHttpClient, RedisCacheService } from "@beautyspot/nest-common";
import { HORAS_MINIMAS_CANCELACION } from "@beautyspot/shared-constants";
import { PoliticaDeReservaService } from "./politica-de-reserva.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";

describe("PoliticaDeReservaService", () => {
  let service: PoliticaDeReservaService;
  let http: { pedirONulo: jest.Mock };
  let cache: { remember: jest.Mock; del: jest.Mock };

  beforeEach(() => {
    http = { pedirONulo: jest.fn() };

    // Caché que ejecuta la carga y recuerda el resultado, como la real.
    const guardado = new Map<string, unknown>();
    cache = {
      remember: jest.fn(async (clave: string, _ttl: number, cargar) => {
        if (guardado.has(clave)) return guardado.get(clave);
        const valor = await cargar();
        guardado.set(clave, valor);
        return valor;
      }),
      del: jest.fn(async (clave: string) => {
        guardado.delete(clave);
      }),
    };

    service = new PoliticaDeReservaService(
      http as unknown as InternalHttpClient,
      cache as unknown as RedisCacheService
    );
  });

  it("devuelve las horas que el negocio configuró", async () => {
    http.pedirONulo.mockResolvedValue({
      business: { reservas: { horasMinimasCancelacion: 6 } },
    });

    await expect(service.horasMinimasDeCancelacion(NEGOCIO)).resolves.toBe(6);
  });

  // Falla en abierto: sin respuesta de core se aplica la regla de serie, que
  // es preferible a bloquear una cancelación legítima.
  it("recurre a la regla de serie si core no responde", async () => {
    http.pedirONulo.mockResolvedValue(null);

    await expect(service.horasMinimasDeCancelacion(NEGOCIO)).resolves.toBe(
      HORAS_MINIMAS_CANCELACION
    );
  });

  it("descarta un valor que no sea un número de horas válido", async () => {
    http.pedirONulo.mockResolvedValue({
      business: { reservas: { horasMinimasCancelacion: -3 } },
    });

    await expect(service.horasMinimasDeCancelacion(NEGOCIO)).resolves.toBe(
      HORAS_MINIMAS_CANCELACION
    );
  });

  it("no vuelve a preguntar mientras la tenga cacheada", async () => {
    http.pedirONulo.mockResolvedValue({
      business: { reservas: { horasMinimasCancelacion: 6 } },
    });

    await service.horasMinimasDeCancelacion(NEGOCIO);
    await service.horasMinimasDeCancelacion(NEGOCIO);

    expect(http.pedirONulo).toHaveBeenCalledTimes(1);
  });

  describe("olvidar", () => {
    it("borra la política cacheada y obliga a volver a preguntarla", async () => {
      http.pedirONulo.mockResolvedValue({
        business: { reservas: { horasMinimasCancelacion: 6 } },
      });
      await service.horasMinimasDeCancelacion(NEGOCIO);

      await service.olvidar(NEGOCIO);
      await service.horasMinimasDeCancelacion(NEGOCIO);

      expect(cache.del).toHaveBeenCalledWith(`politica:reserva:${NEGOCIO}`);
      expect(http.pedirONulo).toHaveBeenCalledTimes(2);
    });

    it("no borra nada si no hay negocio", async () => {
      await service.olvidar("");

      expect(cache.del).not.toHaveBeenCalled();
    });
  });
});
