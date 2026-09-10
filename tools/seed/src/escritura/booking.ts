import { DataSource } from "typeorm";
import { AppointmentStatus, CancelReason } from "@beautyspot/shared-types";
import { Appointment } from "../../../../services/booking-service/src/entities/appointment.entity";
import { AppointmentServiceEntity } from "../../../../services/booking-service/src/entities/appointment-service.entity";
import { BlockedSlot } from "../../../../services/booking-service/src/entities/blocked-slot.entity";
import { Availability } from "../../../../services/booking-service/src/entities/availability.entity";
import type { Siembra } from "../datos";
import { instante } from "../fechas";
import { idDe } from "../identidades";
import { borrarHuerfanas, borrarPorNegocio, guardar } from "./comun";

/**
 * Agenda: las citas con sus líneas, la disponibilidad de cada profesional y
 * unas ausencias sueltas para que la vista Semana tenga bloqueos que pintar.
 */
export async function sembrarBooking(dataSource: DataSource, siembra: Siembra) {
  const citas: Appointment[] = [];
  const lineas: AppointmentServiceEntity[] = [];

  for (const c of siembra.citas) {
    const atendida = c.estado === "COMPLETED";
    const cancelada = c.estado === "CANCELLED";
    citas.push(
      Object.assign(new Appointment(), {
        id: c.id,
        businessId: c.negocioId,
        branchId: c.sedeId,
        clientId: c.clienteId,
        professionalId: c.profesionalId,
        date: c.fecha,
        startTime: c.inicio,
        endTime: c.fin,
        ocupadoHasta: c.fin,
        status: c.estado as AppointmentStatus,
        totalAmount: c.total,
        pointsEarned: atendida ? Math.round(c.total / 10000) : 0,
        // Las horas reales solo existen si la cita llegó a atenderse; es la
        // diferencia con las previstas la que dice si la duración estimada de
        // un servicio se parece a la realidad.
        startedAt: atendida ? instante(c.fecha, c.inicio) : null,
        completedAt: atendida ? instante(c.fecha, c.fin) : null,
        cancelReason: cancelada ? "El cliente avisó por WhatsApp" : null,
        cancelReasonType: cancelada ? CancelReason.CLIENTE_CANCELA : null,
        cancelledAt: cancelada ? instante(c.fecha, c.inicio) : null,
        cancelledBy: null,
      })
    );

    for (const l of c.lineas) {
      lineas.push(
        Object.assign(new AppointmentServiceEntity(), {
          id: l.id,
          appointmentId: c.id,
          serviceId: l.servicioId,
          serviceName: l.nombre,
          price: l.precio,
          duration: l.duracion,
          orden: l.orden,
          procesadoDesde: null,
          procesadoMinutos: null,
          bufferDespues: 0,
          professionalId: null,
        })
      );
    }
  }

  // La disponibilidad de cada profesional copia el horario de su negocio: sin
  // ella la reserva pública no encuentra huecos que ofrecer.
  const disponibilidad: Availability[] = siembra.negocios.flatMap((n) =>
    n.profesionales.flatMap((p) =>
      n.horario.map((h) =>
        Object.assign(new Availability(), {
          id: idDe(`disponibilidad:${p.id}:${h.dia}`),
          businessId: n.id,
          professionalId: p.id,
          dayOfWeek: h.dia,
          startTime: h.abre,
          endTime: h.cierra,
          active: true,
        })
      )
    )
  );

  const bloqueos = siembra.bloqueos.map((b) =>
    Object.assign(new BlockedSlot(), {
      id: b.id,
      businessId: b.negocioId,
      professionalId: b.profesionalId,
      date: b.fecha,
      startTime: b.inicio,
      endTime: b.fin,
      reason: b.motivo,
      serieId: null,
    })
  );

  return {
    citas: await guardar(dataSource, Appointment, citas),
    lineas: await guardar(dataSource, AppointmentServiceEntity, lineas),
    disponibilidad: await guardar(dataSource, Availability, disponibilidad),
    bloqueos: await guardar(dataSource, BlockedSlot, bloqueos),
  };
}

/** Retira la agenda de los negocios sembrados. */
export async function limpiarBooking(
  dataSource: DataSource,
  negocios: string[]
) {
  for (const tabla of ["appointments", "availabilities", "blocked_slots"]) {
    await borrarPorNegocio(dataSource, tabla, negocios);
  }
  // Las líneas no llevan negocio: se van con la cita que las sostenía.
  await borrarHuerfanas(
    dataSource,
    "appointment_services",
    "appointment_id",
    "appointments"
  );
}
