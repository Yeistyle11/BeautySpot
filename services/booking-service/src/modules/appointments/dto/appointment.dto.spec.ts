import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateAppointmentDto } from "./appointment.dto";

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

/** Lo que envía el formulario de cita del panel. */
const citaDelPanel = {
  professionalId: "904dbbed-a416-44f2-acfa-1e9278b3b09c",
  clientId: "afe1accd-8dae-49aa-979a-53c9074aa983",
  serviceIds: [
    {
      id: "cd0596c0-01b4-47c4-aabc-2d50cd73c345",
      name: "Corte básico",
      price: 25000,
      duration: 30,
    },
  ],
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

  it("rechaza un servicio con duración por debajo del mínimo", async () => {
    await expect(
      pipe.transform(
        {
          ...citaDelPanel,
          serviceIds: [{ ...citaDelPanel.serviceIds[0], duration: 1 }],
        },
        metadata
      )
    ).rejects.toThrow();
  });

  // El servicio combina `date` con la hora para situar la cita en el huso del
  // negocio; un ISO completo se concatenaba mal y acababa en un 500.
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

  // La reserva publica ofrece "cualquier profesional" y mandaba el literal
  // "any", que llegaba hasta la consulta y salia como 500 en vez de 400.
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

  // El negocio lo resuelve el gateway desde el token: aceptarlo en el cuerpo
  // dejaria reservar contra otro tenant.
  it("rechaza un businessId en el cuerpo", async () => {
    await expect(
      pipe.transform(
        { ...citaDelPanel, businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46" },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
