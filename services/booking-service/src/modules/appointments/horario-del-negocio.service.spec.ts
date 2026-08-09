import { InternalHttpClient, RedisCacheService } from "@beautyspot/nest-common";
import { HorarioDelNegocioService } from "./horario-del-negocio.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const MIERCOLES = 3;

describe("HorarioDelNegocioService", () => {
  let http: { pedirONulo: jest.Mock };
  let cache: { remember: jest.Mock };
  let service: HorarioDelNegocioService;

  beforeEach(() => {
    http = {
      pedirONulo: jest.fn().mockResolvedValue([
        { dayOfWeek: 3, openTime: "09:00", closeTime: "13:00" },
        { dayOfWeek: 3, openTime: "15:00", closeTime: "19:00" },
        { dayOfWeek: 4, openTime: "09:00", closeTime: "19:00" },
      ]),
    };

    // Caché que ejecuta la carga y recuerda el resultado, como la real.
    const guardado = new Map<string, unknown>();
    cache = {
      remember: jest.fn(async (clave: string, _ttl: number, cargar) => {
        if (guardado.has(clave)) return guardado.get(clave);
        const valor = await cargar();
        guardado.set(clave, valor);
        return valor;
      }),
    };

    service = new HorarioDelNegocioService(
      http as unknown as InternalHttpClient,
      cache as unknown as RedisCacheService
    );
  });

  it("devuelve los tramos del día pedido, traducidos al contrato de la agenda", async () => {
    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toEqual([
      { startTime: "09:00", endTime: "13:00" },
      { startTime: "15:00", endTime: "19:00" },
    ]);
  });

  it("no vuelve a preguntar a core para otro día de la misma semana", async () => {
    await service.tramosDelDia(NEGOCIO, MIERCOLES);
    await service.tramosDelDia(NEGOCIO, 4);

    expect(http.pedirONulo).toHaveBeenCalledTimes(1);
  });

  // Vacío es "cerrado ese día", y quien lo consume no ofrece nada.
  it("devuelve lista vacía para un día sin tramos", async () => {
    await expect(service.tramosDelDia(NEGOCIO, 0)).resolves.toEqual([]);
  });

  // `null` es "sin horario configurado", que no restringe la agenda: si
  // restringiera, todos los negocios que nunca tocaron Ajustes se quedarían sin
  // poder vender.
  it("devuelve null si el negocio no ha configurado ningún horario", async () => {
    http.pedirONulo.mockResolvedValue([]);

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toBeNull();
  });

  it("devuelve null si core no responde, en vez de dejar el negocio sin agenda", async () => {
    http.pedirONulo.mockResolvedValue(null);

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toBeNull();
  });
});
