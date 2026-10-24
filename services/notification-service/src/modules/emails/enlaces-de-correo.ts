/** Los enlaces que llevan los correos de una cita, armados en un solo sitio. */

/** Lo que hace falta saber de una cita para enlazarla. */
export interface CitaEnlazable {
  appointmentId?: string;
  /** Si el cliente tiene cuenta: sin ella no puede abrir su cita en el panel. */
  conCuenta?: boolean;
  serviceName?: string;
  businessName: string;
  businessAddress?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  endTime?: string;
  /** Huso del negocio, para que el calendario ponga la hora donde es. */
  timezone?: string;
}

/**
 * Fecha "YYYY-MM-DD" y hora "HH:MM" como "YYYYMMDDTHHMMSS", el formato de
 * Google Calendar. Las horas de madrugada se guardan pasadas de 24 («24:30»),
 * así que se suman al día siguiente.
 */
export function fechaHoraCompacta(fecha: string, hora: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const instante = new Date(Date.UTC(anio, mes - 1, dia, 0, 0, 0));
  instante.setUTCMinutes(h * 60 + m);
  const dos = (n: number) => String(n).padStart(2, "0");
  return (
    `${instante.getUTCFullYear()}${dos(instante.getUTCMonth() + 1)}${dos(instante.getUTCDate())}` +
    `T${dos(instante.getUTCHours())}${dos(instante.getUTCMinutes())}00`
  );
}

/** Enlaces de una cita según lo que se sepa de ella; los que no aplican no se dan. */
export function enlacesDeCita(
  appUrl: string,
  cita: CitaEnlazable
): {
  enlaceCita?: string;
  enlaceReagendar?: string;
  enlaceMapa?: string;
  enlaceCalendario?: string;
  enlaceReservar: string;
} {
  const enlaces: ReturnType<typeof enlacesDeCita> = {
    // El negocio aún no tiene un enlace público estable que dar desde aquí: la
    // búsqueda por su nombre lo encuentra.
    enlaceReservar: `${appUrl}/marketplace?q=${encodeURIComponent(cita.businessName)}`,
  };

  if (cita.conCuenta && cita.appointmentId) {
    enlaces.enlaceCita = `${appUrl}/dashboard/client/appointments/${cita.appointmentId}`;
    enlaces.enlaceReagendar = `${enlaces.enlaceCita}/reschedule`;
  }

  if (cita.businessAddress) {
    enlaces.enlaceMapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cita.businessAddress)}`;
  }

  if (cita.appointmentDate && cita.appointmentTime && cita.endTime) {
    const parametros = new URLSearchParams({
      action: "TEMPLATE",
      text: `${cita.serviceName ?? "Cita"} · ${cita.businessName}`,
      dates: `${fechaHoraCompacta(cita.appointmentDate, cita.appointmentTime)}/${fechaHoraCompacta(cita.appointmentDate, cita.endTime)}`,
    });
    if (cita.businessAddress) parametros.set("location", cita.businessAddress);
    if (cita.timezone) parametros.set("ctz", cita.timezone);
    enlaces.enlaceCalendario = `https://calendar.google.com/calendar/render?${parametros}`;
  }

  return enlaces;
}
