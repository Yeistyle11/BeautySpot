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
});
