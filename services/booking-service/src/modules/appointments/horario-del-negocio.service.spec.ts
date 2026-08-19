import { InternalHttpClient, RedisCacheService } from "@beautyspot/nest-common";
import { HorarioDelNegocioService } from "./horario-del-negocio.service";

const NEGOCIO = "11111111-1111-4111-8111-111111111111";
const MIERCOLES = "2026-08-19";
const JUEVES = "2026-08-20";

/** Respuesta de core para un día que sale del horario semanal. */
const semanal = (tramos: { openTime: string; closeTime: string }[]) => ({
  tramos,
  origen: "semanal" as const,
  configurado: true,
});

describe("HorarioDelNegocioService", () => {
  let http: { pedirONulo: jest.Mock };
  let cache: { remember: jest.Mock };
  let service: HorarioDelNegocioService;

  beforeEach(() => {
    http = {
      pedirONulo: jest.fn().mockResolvedValue(
        semanal([
          { openTime: "09:00", closeTime: "13:00" },
          { openTime: "15:00", closeTime: "19:00" },
        ])
      ),
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

  it("no vuelve a preguntar a core por la misma fecha", async () => {
    await service.tramosDelDia(NEGOCIO, MIERCOLES);
    await service.tramosDelDia(NEGOCIO, MIERCOLES);

    expect(http.pedirONulo).toHaveBeenCalledTimes(1);
  });

  it("pregunta una vez por cada fecha, que puede ser especial", async () => {
    await service.tramosDelDia(NEGOCIO, MIERCOLES);
    await service.tramosDelDia(NEGOCIO, JUEVES);

    expect(http.pedirONulo).toHaveBeenCalledTimes(2);
  });

  // Vacío es "cerrado ese día", y quien lo consume no ofrece nada.
  it("devuelve lista vacía para un día sin tramos", async () => {
    http.pedirONulo.mockResolvedValue(semanal([]));

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toEqual([]);
  });

  // Un festivo declarado cierra aunque ese día de la semana se abra.
  it("cierra el día declarado como especial y cerrado", async () => {
    http.pedirONulo.mockResolvedValue({
      tramos: [],
      origen: "especial",
      configurado: true,
      motivo: "20 de julio",
    });

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toEqual([]);
  });

  it("aplica el horario propio del día especial", async () => {
    http.pedirONulo.mockResolvedValue({
      tramos: [{ openTime: "09:00", closeTime: "14:00" }],
      origen: "especial",
      configurado: true,
      motivo: "24 de diciembre",
    });

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toEqual([
      { startTime: "09:00", endTime: "14:00" },
    ]);
  });

  // `null` es "sin horario configurado", que no restringe la agenda: si
  // restringiera, todos los negocios que nunca tocaron Ajustes se quedarían sin
  // poder vender.
  it("devuelve null si el negocio no ha configurado ningún horario", async () => {
    http.pedirONulo.mockResolvedValue({
      tramos: [],
      origen: "semanal",
      configurado: false,
    });

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toBeNull();
  });

  // Un día especial sí es configuración deliberada: cierra aunque el negocio no
  // tenga horario semanal.
  it("respeta el día especial de un negocio sin horario semanal", async () => {
    http.pedirONulo.mockResolvedValue({
      tramos: [],
      origen: "especial",
      configurado: true,
      motivo: "Vacaciones",
    });

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toEqual([]);
  });

  it("devuelve null si core no responde, en vez de dejar el negocio sin agenda", async () => {
    http.pedirONulo.mockResolvedValue(null);

    await expect(service.tramosDelDia(NEGOCIO, MIERCOLES)).resolves.toBeNull();
  });
});
