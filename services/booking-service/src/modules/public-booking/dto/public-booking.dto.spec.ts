import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { PublicBookingDto } from "./public-booking.dto";

// Mismo pipe que monta createMicroserviceApp.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const metadata = {
  type: "body" as const,
  metatype: PublicBookingDto,
};

const SERVICIO = "cd0596c0-01b4-47c4-aabc-2d50cd73c345";

/** Lo que envía el widget de reserva del marketplace. */
const reservaDeInvitado = {
  businessId: "72c9ec5c-4116-4481-9a3b-dad43da27b46",
  professionalId: "904dbbed-a416-44f2-acfa-1e9278b3b09c",
  serviceIds: [SERVICIO],
  date: "2026-08-01",
  startTime: "10:00",
  guestName: "Ana Gómez",
  guestEmail: "ana@example.com",
  guestPhone: "+573001234567",
};

describe("PublicBookingDto", () => {
  it("acepta la reserva que envía el marketplace", async () => {
    await expect(
      pipe.transform(reservaDeInvitado, metadata)
    ).resolves.toMatchObject({ serviceIds: [SERVICIO], startTime: "10:00" });
  });

  it("acepta que no se pida profesional concreto", async () => {
    const { professionalId: _omitido, ...sinPreferencia } = reservaDeInvitado;

    await expect(
      pipe.transform(sinPreferencia, metadata)
    ).resolves.toBeDefined();
  });

  it("rechaza el precio y la duración enviados por el navegador", async () => {
    // La ruta es pública y sin token: fiarse de estos valores dejaría crear
    // citas de $0 o de 5 minutos.
    await expect(
      pipe.transform(
        {
          ...reservaDeInvitado,
          serviceIds: [{ id: SERVICIO, name: "Corte", price: 0, duration: 5 }],
        },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un userId en el cuerpo", async () => {
    // Sin token no hay identidad que dar por buena: aceptarlo dejaba atar la
    // ficha de cliente a la cuenta de otra persona.
    await expect(
      pipe.transform(
        {
          ...reservaDeInvitado,
          userId: "afe1accd-8dae-49aa-979a-53c9074aa983",
        },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza una reserva sin servicios", async () => {
    await expect(
      pipe.transform({ ...reservaDeInvitado, serviceIds: [] }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza una fecha con hora en vez del día suelto", async () => {
    await expect(
      pipe.transform(
        { ...reservaDeInvitado, date: "2026-08-01T15:00:00.000Z" },
        metadata
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rechaza un correo mal formado", async () => {
    await expect(
      pipe.transform({ ...reservaDeInvitado, guestEmail: "ana" }, metadata)
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
