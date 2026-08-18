import { BadRequestException, ValidationPipe } from "@nestjs/common";
import {
  AvailabilityQueryDto,
  CreateAppointmentDto,
  RescheduleDto,
} from "./appointment.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = {
  type: "body" as const,
  metatype: CreateAppointmentDto,
};

const SERVICIO = "cd0596c0-01b4-47c4-aabc-2d50cd73c345";

/** Lo que envía el formulario de cita del panel. */
const citaDelPanel = {
  professionalId: "904dbbed-a416-44f2-acfa-1e9278b3b09c",
  clientId: "afe1accd-8dae-49aa-979a-53c9074aa983",
  serviceIds: [SERVICIO],
  date: "2026-08-01",
  startTime: "10:00",
  notes: "Cliente habitual",
};

describe("CreateAppointmentDto", () => {
  it("acepta la cita que envía el panel", async () => {
    await expect(pipe.transform(citaDelPanel, metadata)).resolves.toMatchObject(
      {
        professionalId: citaDelPanel.professionalId,
        startTime: "10:00",
      }
    );
  });

  it("rechaza una cita sin servicios", async () => {
    await expect(
      pipe.transform({ ...citaDelPanel, serviceIds: [] }, metadata)
    ).rejects.toThrow();
  });

  it("rechaza un servicio que no sea un id valido", async () => {
    await expect(
      pipe.transform({ ...citaDelPanel, serviceIds: ["corte"] }, metadata)
    ).rejects.toThrow();
  });

  it("rechaza el precio y la duración enviados por el cliente", async () => {
    // El importe lo resuelve el backend contra el catálogo. Si el DTO dejara
    // pasar estos objetos, cualquiera reservaría por $0.
    await expect(
      pipe.transform(
        {
          ...citaDelPanel,
          serviceIds: [{ id: SERVICIO, name: "Corte", price: 0, duration: 5 }],
        },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza una fecha con hora en vez del día suelto", async () => {
    const error = await pipe
      .transform(
        { ...citaDelPanel, date: "2026-08-01T15:00:00.000Z" },
        metadata
      )
      .then(
        () => null,
        (e: BadRequestException) => e
      );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error!.getResponse()).toMatchObject({
      message: expect.arrayContaining([expect.stringContaining("YYYY-MM-DD")]),
    });
  });

  it.each(["9:0", "abc", "24:30", "10:60", ""])(
    "rechaza la hora %p",
    async (startTime) => {
      // Sin validar el formato, timeToMinutes devuelve NaN y las comparaciones
      // de horario se evalúan a false: la cita entra sin que nadie avise.
      const error = await pipe
        .transform({ ...citaDelPanel, startTime }, metadata)
        .then(
          () => null,
          (e: BadRequestException) => e
        );

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error!.getResponse()).toMatchObject({
        message: expect.arrayContaining([expect.stringContaining("HH:MM")]),
      });
    }
  );

  it("rechaza un profesional que no sea un id valido", async () => {
    await expect(
      pipe.transform({ ...citaDelPanel, professionalId: "any" }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un profesional vacio", async () => {
    await expect(
      pipe.transform({ ...citaDelPanel, professionalId: "" }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un cliente que no sea un id valido", async () => {
    await expect(
      pipe.transform({ ...citaDelPanel, clientId: "invitado" }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un businessId en el cuerpo", async () => {
    await expect(
      pipe.transform(
        { ...citaDelPanel, businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46" },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /** Mensajes con los que el pipe rechaza esa fecha. */
  async function motivosDe(date: string): Promise<string> {
    try {
      await pipe.transform({ ...citaDelPanel, date }, metadata);
      return "";
    } catch (error) {
      const respuesta = (error as BadRequestException).getResponse();
      return JSON.stringify(respuesta);
    }
  }

  // Tenían los ocho dígitos y los dos guiones, así que el patrón las dejaba
  // pasar; aguas abajo daban una fecha inválida y la petición reventaba con un
  // 500, o se rechazaba diciendo que el 30 de febrero está en el pasado.
  it.each([
    "2027-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
  ])("rechaza %s, que no existe en el calendario", async (date) => {
    const motivos = await motivosDe(date);

    expect(motivos).toContain("no existe en el calendario");
  });

  it("acepta el 29 de febrero de un año bisiesto", async () => {
    await expect(motivosDe("2028-02-29")).resolves.toBe("");
  });

  // Equivocarse de formato y elegir un día que no existe son dos correcciones
  // distintas, y el mensaje tiene que decir cuál toca.
  it("distingue el formato mal escrito del día inexistente", async () => {
    const formato = await motivosDe("13-08-2026");

    expect(formato).toContain("formato YYYY-MM-DD");
    expect(formato).not.toContain("no existe en el calendario");
  });
});

/**
 * Las tres rutas que fechan comparten el mismo decorador, así que el día
 * imposible se corta en todas por igual: reservar, mover la cita y preguntar
 * por los huecos de un día.
 */
describe("el día imposible se corta en toda la agenda", () => {
  it("no deja reagendar al 31 de abril", async () => {
    await expect(
      pipe.transform(
        { date: "2026-04-31", startTime: "10:00" },
        { type: "body", metatype: RescheduleDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("no deja pedir los huecos de un 29 de febrero que no existe", async () => {
    await expect(
      pipe.transform(
        {
          professionalId: citaDelPanel.professionalId,
          date: "2027-02-29",
          duration: 30,
        },
        { type: "body", metatype: AvailabilityQueryDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("sigue dejando pasar los días que sí existen", async () => {
    await expect(
      pipe.transform(
        { date: "2026-04-30", startTime: "10:00" },
        { type: "body", metatype: RescheduleDto }
      )
    ).resolves.toMatchObject({ date: "2026-04-30" });
  });
});
