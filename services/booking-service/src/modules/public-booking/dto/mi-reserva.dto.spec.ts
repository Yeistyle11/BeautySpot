import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { MiReservaDto } from "./mi-reserva.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = {
  type: "body" as const,
  metatype: MiReservaDto,
};

const SERVICIO = "cd0596c0-01b4-47c4-aabc-2d50cd73c345";

/** Lo que envía el escaparate cuando quien reserva tiene sesión. */
const reservaConSesion = {
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  professionalId: "904dbbed-a416-44f2-acfa-1e9278b3b09c",
  serviceIds: [SERVICIO],
  date: "2026-08-01",
  startTime: "20:00",
  guestName: "Camila Cliente",
  guestEmail: "camila@example.com",
};

describe("MiReservaDto", () => {
  it("acepta la reserva del cliente autenticado", async () => {
    await expect(
      pipe.transform(reservaConSesion, metadata)
    ).resolves.toMatchObject({ serviceIds: [SERVICIO], startTime: "20:00" });
  });

  // Quien reserva sale del token. Aceptarlo del cuerpo dejaría reservar a
  // nombre de otro, que es justo lo que la ruta pública evita.
  it("rechaza un userId en el cuerpo", async () => {
    await expect(
      pipe.transform(
        {
          ...reservaConSesion,
          userId: "afe1accd-8dae-49aa-979a-53c9074aa983",
        },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza el precio y la duración enviados por el navegador", async () => {
    await expect(
      pipe.transform(
        { ...reservaConSesion, totalAmount: 1, totalDuration: 5 },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("no exige contacto: la cuenta ya lo tiene", async () => {
    const { guestEmail: _omitido, ...sinCorreo } = reservaConSesion;

    await expect(pipe.transform(sinCorreo, metadata)).resolves.toBeDefined();
  });

  it("rechaza una fecha que no existe en el calendario", async () => {
    await expect(
      pipe.transform({ ...reservaConSesion, date: "2027-02-29" }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza una reserva sin servicios", async () => {
    await expect(
      pipe.transform({ ...reservaConSesion, serviceIds: [] }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
