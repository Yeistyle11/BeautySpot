import { ValidationPipe } from "@nestjs/common";
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
});
