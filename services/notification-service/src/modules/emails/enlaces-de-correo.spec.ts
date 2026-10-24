import { enlacesDeCita, fechaHoraCompacta } from "./enlaces-de-correo";

const APP = "https://appbeautyspot.com";

describe("fechaHoraCompacta", () => {
  it("escribe fecha y hora como las pide Google Calendar", () => {
    expect(fechaHoraCompacta("2026-10-25", "10:30")).toBe("20261025T103000");
  });

  // La madrugada se guarda pasada de 24: «24:30» es las 00:30 del día siguiente.
  it("pasa al día siguiente las horas de madrugada", () => {
    expect(fechaHoraCompacta("2026-10-31", "24:30")).toBe("20261101T003000");
  });
});

describe("enlacesDeCita", () => {
  const cita = {
    appointmentId: "cita-1",
    conCuenta: true,
    serviceName: "Corte",
    businessName: "Barbería La Noche",
    businessAddress: "Cra. 43A #7-50",
    appointmentDate: "2026-10-25",
    appointmentTime: "10:30",
    endTime: "11:30",
    timezone: "America/Bogota",
  };

  it("con cuenta enlaza a la cita y a reagendarla", () => {
    const enlaces = enlacesDeCita(APP, cita);

    expect(enlaces.enlaceCita).toBe(
      `${APP}/dashboard/client/appointments/cita-1`
    );
    expect(enlaces.enlaceReagendar).toBe(
      `${APP}/dashboard/client/appointments/cita-1/reschedule`
    );
  });

  // Un invitado no puede entrar al panel: un enlace ahí lo deja en el acceso.
  it("sin cuenta no ofrece enlaces al panel", () => {
    const enlaces = enlacesDeCita(APP, { ...cita, conCuenta: false });

    expect(enlaces.enlaceCita).toBeUndefined();
    expect(enlaces.enlaceReagendar).toBeUndefined();
  });

  it("el calendario lleva la franja, el lugar y el huso del negocio", () => {
    const url = new URL(enlacesDeCita(APP, cita).enlaceCalendario!);

    expect(url.searchParams.get("dates")).toBe(
      "20261025T103000/20261025T113000"
    );
    expect(url.searchParams.get("location")).toBe("Cra. 43A #7-50");
    expect(url.searchParams.get("ctz")).toBe("America/Bogota");
  });

  it("sin dirección no hay «Cómo llegar»", () => {
    const enlaces = enlacesDeCita(APP, { ...cita, businessAddress: "" });

    expect(enlaces.enlaceMapa).toBeUndefined();
  });

  it("reservar de nuevo busca el negocio por su nombre", () => {
    expect(enlacesDeCita(APP, cita).enlaceReservar).toBe(
      `${APP}/marketplace?q=Barber%C3%ADa%20La%20Noche`
    );
  });
});
