import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  getTimeSlots,
  calculateEndTime,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";

/** Franja de la agenda con su hora de inicio, de fin y si está libre. */
export interface Franja {
  startTime: string;
  endTime: string;
  available: boolean;
}

/** Tamaño de las franjas en que se divide la jornada al ofrecer disponibilidad. */
const DURACION_FRANJA_MINUTOS = 30;

/** Estados de cita que ocupan una franja e impiden reservar encima. */
const ESTADOS_QUE_OCUPAN = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

/** Agrupa por profesional bloqueos o citas ya cargados. */
function agruparPorProfesional<T extends { professionalId: string }>(
  filas: T[]
): Map<string, T[]> {
  const porProfesional = new Map<string, T[]>();
  for (const fila of filas) {
    const acumulado = porProfesional.get(fila.professionalId);
    if (acumulado) acumulado.push(fila);
    else porProfesional.set(fila.professionalId, [fila]);
  }
  return porProfesional;
}

/**
 * Responde qué franjas de la agenda están libres y si una reserva concreta
 * cabe.
 */
@Injectable()
export class AvailabilityQueryService {
  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Availability)
    private readonly availRepo: Repository<Availability>,
    @InjectRepository(BlockedSlot)
    private readonly blockRepo: Repository<BlockedSlot>
  ) {}

  /** Franjas de un profesional, con el negocio resuelto desde su horario. */
  async franjasDeProfesionalPublico(
    professionalId: string,
    date: string,
    duration: number
  ): Promise<Franja[]> {
    const horario = await this.availRepo.findOne({
      where: { professionalId, active: true },
    });
    if (!horario) return [];

    return this.franjasDeProfesional(
      horario.businessId,
      professionalId,
      date,
      duration
    );
  }

  /**
   * Franjas de un negocio: una franja queda libre si la tiene libre al menos
   * un profesional del equipo.
   */
  async franjasDelNegocio(
    businessId: string,
    date: string,
    duration: number
  ): Promise<Franja[]> {
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const horarios = await this.availRepo.find({
      where: { businessId, dayOfWeek, active: true },
    });
    const profesionales = [...new Set(horarios.map((h) => h.professionalId))];
    if (profesionales.length === 0) return [];

    // Bloqueos y citas del día de todo el equipo en dos consultas, sea cual sea
    // su tamaño.
    const [bloqueos, citas] = await Promise.all([
      this.blockRepo.find({
        where: { businessId, professionalId: In(profesionales), date },
      }),
      this.apptRepo.find({
        where: {
          businessId,
          professionalId: In(profesionales),
          date,
          status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
        },
      }),
    ]);

    const bloqueosPorProfesional = agruparPorProfesional(bloqueos);
    const citasPorProfesional = agruparPorProfesional(citas);
    const horarioPorProfesional = new Map<string, Availability>();
    for (const horario of horarios) {
      if (!horarioPorProfesional.has(horario.professionalId)) {
        horarioPorProfesional.set(horario.professionalId, horario);
      }
    }

    const porProfesional = profesionales.map((professionalId) =>
      this.calcularFranjas(
        horarioPorProfesional.get(professionalId)!,
        bloqueosPorProfesional.get(professionalId) ?? [],
        citasPorProfesional.get(professionalId) ?? [],
        duration
      )
    );

    const union = new Map<string, Franja>();
    for (const slots of porProfesional) {
      for (const slot of slots) {
        const previo = union.get(slot.startTime);
        if (!previo || (!previo.available && slot.available)) {
          union.set(slot.startTime, slot);
        }
      }
    }

    return [...union.values()].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
  }

  /** Devuelve las franjas del día de un profesional, marcando cuáles están libres. */
  async franjasDeProfesional(
    businessId: string,
    professionalId: string,
    date: string,
    duration: number
  ): Promise<Franja[]> {
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    const workHours = await this.availRepo.findOne({
      where: { businessId, professionalId, dayOfWeek, active: true },
    });
    if (!workHours) return [];

    const [blocks, allAppointments] = await Promise.all([
      this.blockRepo.find({ where: { businessId, professionalId, date } }),
      this.apptRepo.find({
        where: {
          businessId,
          professionalId,
          date,
          status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
        },
      }),
    ]);

    return this.calcularFranjas(workHours, blocks, allAppointments, duration);
  }

  /** Comprueba que la franja cae dentro del horario del profesional y no choca con un bloqueo. */
  async franjaDentroDelHorario(
    businessId: string,
    professionalId: string,
    date: string,
    start: string,
    end: string,
    dayOfWeek: number
  ): Promise<boolean> {
    const workHours = await this.availRepo.findOne({
      where: { businessId, professionalId, dayOfWeek, active: true },
    });
    if (!workHours) return false;

    if (
      timeToMinutes(start) < timeToMinutes(workHours.startTime) ||
      timeToMinutes(end) > timeToMinutes(workHours.endTime)
    ) {
      return false;
    }

    const blocks = await this.blockRepo.find({
      where: { businessId, professionalId, date },
    });
    return !blocks.some((b) =>
      timesOverlap(start, end, b.startTime, b.endTime)
    );
  }

  /** Indica si ya hay una cita viva del profesional que se solape con la franja. */
  async hayConflicto(
    businessId: string,
    professionalId: string,
    date: string,
    start: string,
    end: string,
    excludeId?: string
  ): Promise<boolean> {
    const appointments = await this.apptRepo.find({
      where: {
        businessId,
        professionalId,
        date,
        status: In(ESTADOS_QUE_OCUPAN),
      },
    });

    return this.seSolapan(appointments, start, end, excludeId);
  }

  /**
   * Re-check de conflicto dentro de una transacción SERIALIZABLE. Es el check
   * autoritativo que previene el doble-booking, y por eso recibe el manager de
   * la transacción en lugar de usar el repositorio.
   */
  async hayConflictoEn(
    manager: EntityManager,
    businessId: string,
    professionalId: string,
    date: string,
    start: string,
    end: string,
    excludeId?: string
  ): Promise<boolean> {
    const appointments = await manager.find(Appointment, {
      where: {
        businessId,
        professionalId,
        date,
        status: In(ESTADOS_QUE_OCUPAN),
      },
    });

    return this.seSolapan(appointments, start, end, excludeId);
  }

  /** Divide la jornada en franjas y marca como ocupadas las que chocan con un bloqueo o una cita. */
  private calcularFranjas(
    workHours: Availability,
    blocks: BlockedSlot[],
    appointments: Appointment[],
    duration: number
  ): Franja[] {
    const slots = getTimeSlots(
      workHours.startTime,
      workHours.endTime,
      DURACION_FRANJA_MINUTOS
    );
    const workEndNum = timeToMinutes(workHours.endTime);

    return slots.map((slotStart) => {
      const slotEnd = calculateEndTime(slotStart, duration);

      if (timeToMinutes(slotEnd) > workEndNum) {
        return { startTime: slotStart, endTime: slotEnd, available: false };
      }

      const isBlocked = blocks.some((b) =>
        timesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
      );
      if (isBlocked) {
        return { startTime: slotStart, endTime: slotEnd, available: false };
      }

      const hasAppt = appointments.some((a) =>
        timesOverlap(slotStart, slotEnd, a.startTime, a.endTime)
      );

      return { startTime: slotStart, endTime: slotEnd, available: !hasAppt };
    });
  }

  /** Lógica pura de solapamiento, compartida por ambas comprobaciones. */
  private seSolapan(
    appointments: Pick<Appointment, "id" | "startTime" | "endTime">[],
    start: string,
    end: string,
    excludeId?: string
  ): boolean {
    return appointments
      .filter((a) => a.id !== excludeId)
      .some((a) => timesOverlap(start, end, a.startTime, a.endTime));
  }
}
