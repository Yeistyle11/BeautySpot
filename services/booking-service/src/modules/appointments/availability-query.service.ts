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
  esInstantePasadoEn,
} from "@beautyspot/shared-utils";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { HorarioDelNegocioService, Tramo } from "./horario-del-negocio.service";

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

/** Ordena tramos por hora de inicio, que es como se recorren. */
function porHora(a: Tramo, b: Tramo): number {
  return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
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
    private readonly blockRepo: Repository<BlockedSlot>,
    private readonly zonas: ZonaDelNegocioService,
    private readonly horarioDelNegocio: HorarioDelNegocioService
  ) {}

  /** Franjas de un profesional, con el negocio resuelto desde su horario. */
  async franjasDeProfesionalPublico(
    professionalId: string,
    date: string,
    duration: number
  ): Promise<Franja[]> {
    const horarios = await this.availRepo.find({
      where: { professionalId, active: true },
    });
    const negocios = [...new Set(horarios.map((h) => h.businessId))];

    // Esta ruta pública no dice de qué negocio se pregunta, así que solo puede
    // responder cuando el profesional trabaja en uno.
    if (negocios.length !== 1) return [];

    return this.franjasDeProfesional(
      negocios[0],
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
    const [bloqueos, citas, apertura, zona] = await Promise.all([
      this.blockRepo.find({
        where: { businessId, professionalId: In(profesionales), date },
      }),
      this.apptRepo.find({
        where: {
          businessId,
          professionalId: In(profesionales),
          date,
          status: In(ESTADOS_QUE_OCUPAN),
        },
      }),
      this.horarioDelNegocio.tramosDelDia(businessId, dayOfWeek),
      this.zonas.de(businessId),
    ]);

    const bloqueosPorProfesional = agruparPorProfesional(bloqueos);
    const citasPorProfesional = agruparPorProfesional(citas);
    const tramosPorProfesional = agruparPorProfesional(horarios);

    const porProfesional = profesionales.map((professionalId) =>
      this.calcularFranjas(
        tramosPorProfesional.get(professionalId) ?? [],
        apertura,
        bloqueosPorProfesional.get(professionalId) ?? [],
        citasPorProfesional.get(professionalId) ?? [],
        duration,
        date,
        zona
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

    const tramos = await this.availRepo.find({
      where: { businessId, professionalId, dayOfWeek, active: true },
    });
    if (tramos.length === 0) return [];

    const [blocks, allAppointments, apertura, zona] = await Promise.all([
      this.blockRepo.find({ where: { businessId, professionalId, date } }),
      this.apptRepo.find({
        where: {
          businessId,
          professionalId,
          date,
          status: In(ESTADOS_QUE_OCUPAN),
        },
      }),
      this.horarioDelNegocio.tramosDelDia(businessId, dayOfWeek),
      this.zonas.de(businessId),
    ]);

    return this.calcularFranjas(
      tramos,
      apertura,
      blocks,
      allAppointments,
      duration,
      date,
      zona
    );
  }

  /**
   * Comprueba que la franja cabe entera en un tramo del profesional y en el
   * horario del negocio, y que no choca con un bloqueo.
   */
  async franjaDentroDelHorario(
    businessId: string,
    professionalId: string,
    date: string,
    start: string,
    end: string,
    dayOfWeek: number
  ): Promise<boolean> {
    const [tramos, apertura] = await Promise.all([
      this.availRepo.find({
        where: { businessId, professionalId, dayOfWeek, active: true },
      }),
      this.horarioDelNegocio.tramosDelDia(businessId, dayOfWeek),
    ]);

    // Entera dentro de un mismo tramo: una cita no cruza la hora del almuerzo.
    if (!this.cabeEnAlgunTramo(tramos, start, end)) return false;
    if (apertura && !this.cabeEnAlgunTramo(apertura, start, end)) return false;

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

  /** Indica si el rango cabe completo dentro de alguno de los tramos. */
  private cabeEnAlgunTramo(
    tramos: Tramo[],
    start: string,
    end: string
  ): boolean {
    const inicio = timeToMinutes(start);
    const fin = timeToMinutes(end);

    return tramos.some(
      (t) =>
        inicio >= timeToMinutes(t.startTime) && fin <= timeToMinutes(t.endTime)
    );
  }

  /**
   * Divide en franjas cada tramo de trabajo y marca como ocupadas las que chocan
   * con un bloqueo, con una cita o con el cierre del negocio.
   *
   * `apertura` en `null` significa negocio sin horario configurado: no acota.
   */
  private calcularFranjas(
    tramos: Tramo[],
    apertura: Tramo[] | null,
    blocks: BlockedSlot[],
    appointments: Appointment[],
    duration: number,
    date: string,
    zona: string
  ): Franja[] {
    const franjas = new Map<string, Franja>();

    for (const tramo of [...tramos].sort(porHora)) {
      const finDelTramo = timeToMinutes(tramo.endTime);

      for (const slotStart of getTimeSlots(
        tramo.startTime,
        tramo.endTime,
        DURACION_FRANJA_MINUTOS
      )) {
        const slotEnd = calculateEndTime(slotStart, duration);
        const franja: Franja = {
          startTime: slotStart,
          endTime: slotEnd,
          available: this.franjaLibre(
            slotStart,
            slotEnd,
            finDelTramo,
            apertura,
            blocks,
            appointments,
            date,
            zona
          ),
        };

        // Dos tramos pueden proponer la misma hora; gana la que esté libre.
        const previa = franjas.get(slotStart);
        if (!previa || (!previa.available && franja.available)) {
          franjas.set(slotStart, franja);
        }
      }
    }

    return [...franjas.values()].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
  }

  /** Decide si una franja concreta puede reservarse. */
  private franjaLibre(
    slotStart: string,
    slotEnd: string,
    finDelTramo: number,
    apertura: Tramo[] | null,
    blocks: BlockedSlot[],
    appointments: Appointment[],
    date: string,
    zona: string
  ): boolean {
    // La cita termina dentro del mismo tramo en que empieza.
    if (timeToMinutes(slotEnd) > finDelTramo) return false;

    if (esInstantePasadoEn(zona, date, slotStart)) return false;

    if (apertura && !this.cabeEnAlgunTramo(apertura, slotStart, slotEnd)) {
      return false;
    }

    if (
      blocks.some((b) =>
        timesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
      )
    ) {
      return false;
    }

    return !appointments.some((a) =>
      timesOverlap(slotStart, slotEnd, a.startTime, a.endTime)
    );
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
