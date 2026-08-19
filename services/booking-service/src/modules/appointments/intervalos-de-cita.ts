import {
  finExtendido,
  repartoPorProfesional,
  type OcupacionDeProfesional,
} from "@beautyspot/shared-utils";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";

/**
 * Agenda que ocupa la cita, profesional a profesional, con el fin devuelto a
 * la escala del reparto (de 23:30 a "24:30").
 */
export function ocupacionDeCita(
  cita: Pick<Appointment, "startTime" | "endTime" | "professionalId">,
  lineas: AppointmentServiceEntity[] = []
): OcupacionDeProfesional[] {
  return repartoPorProfesional(
    cita.startTime,
    finExtendido(cita.startTime, cita.endTime),
    lineas,
    cita.professionalId
  );
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

/** Une en una sola lista lo que cada profesional tiene ocupado. */
export function intervalosPorProfesional(
  ocupaciones: OcupacionDeProfesional[][]
): Map<string, { inicio: string; fin: string }[]> {
  const porProfesional = new Map<string, { inicio: string; fin: string }[]>();
  for (const ocupacion of ocupaciones.flat()) {
    const acumulado = porProfesional.get(ocupacion.professionalId) ?? [];
    acumulado.push(...ocupacion.intervalos);
    porProfesional.set(ocupacion.professionalId, acumulado);
  }
  return porProfesional;
}
