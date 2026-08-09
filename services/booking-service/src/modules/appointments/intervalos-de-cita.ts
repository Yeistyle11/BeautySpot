import { intervalosDeAgenda, type Intervalo } from "@beautyspot/shared-utils";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";

/** Tramos de agenda que ocupa una cita; sin líneas, su bloque continuo. */
export function intervalosDeCita(
  cita: Pick<Appointment, "startTime" | "endTime">,
  lineas: AppointmentServiceEntity[] = []
): Intervalo[] {
  return intervalosDeAgenda(cita.startTime, cita.endTime, lineas);
}

/** Agrupa las líneas por la cita a la que pertenecen. */
export function lineasPorCita(
  lineas: AppointmentServiceEntity[]
): Map<string, AppointmentServiceEntity[]> {
  const porCita = new Map<string, AppointmentServiceEntity[]>();
  for (const linea of lineas) {
    const actuales = porCita.get(linea.appointmentId) ?? [];
    actuales.push(linea);
    porCita.set(linea.appointmentId, actuales);
  }
  return porCita;
}
