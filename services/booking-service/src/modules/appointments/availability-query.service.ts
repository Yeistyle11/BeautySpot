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
  algunSolape,
  type Intervalo,
} from "@beautyspot/shared-utils";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { HorarioDelNegocioService, Tramo } from "./horario-del-negocio.service";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { intervalosDeCita, lineasPorCita } from "./intervalos-de-cita";

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

/** Horas en que termina algún tramo ocupado, donde puede abrirse un hueco. */
function finalesDeOcupacion(intervalos: Intervalo[][]): string[] {
  return [...new Set(intervalos.flat().map((i) => i.fin))];
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
    @InjectRepository(AppointmentServiceEntity)
    private readonly lineaRepo: Repository<AppointmentServiceEntity>,
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
    const ocupacion = await this.ocupacionDe(citas);

    // Sobre el equipo entero: el hueco que abre uno lo evalúan todos.
    const iniciosExtra = finalesDeOcupacion([...ocupacion.values()]);

    const porProfesional = profesionales.map((professionalId) =>
      this.calcularFranjas(
        tramosPorProfesional.get(professionalId) ?? [],
        apertura,
        bloqueosPorProfesional.get(professionalId) ?? [],
        citasPorProfesional.get(professionalId) ?? [],
        ocupacion,
        iniciosExtra,
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

    const ocupacion = await this.ocupacionDe(allAppointments);

    return this.calcularFranjas(
      tramos,
      apertura,
      blocks,
      allAppointments,
      ocupacion,
      finalesDeOcupacion([...ocupacion.values()]),
      duration,
      date,
      zona
    );
  }

  /** Tramos ocupados de cada cita, resueltos con sus líneas de servicio. */
  private async ocupacionDe(
    citas: Appointment[],
    manager?: EntityManager
  ): Promise<Map<string, Intervalo[]>> {
    if (citas.length === 0) return new Map();

    const ids = citas.map((c) => c.id);
    const repo = manager
      ? manager.getRepository(AppointmentServiceEntity)
      : this.lineaRepo;
    const lineas = await repo.find({ where: { appointmentId: In(ids) } });
    const porCita = lineasPorCita(lineas);

    return new Map(
      citas.map((cita) => [
        cita.id,
        intervalosDeCita(cita, porCita.get(cita.id) ?? []),
      ])
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
    finDeCliente: string,
    finDeOcupacion: string,
    dayOfWeek: number
  ): Promise<boolean> {
    const [tramos, apertura] = await Promise.all([
      this.availRepo.find({
        where: { businessId, professionalId, dayOfWeek, active: true },
      }),
      this.horarioDelNegocio.tramosDelDia(businessId, dayOfWeek),
    ]);

    // Entera dentro de un mismo tramo del profesional, limpieza incluida.
    if (!this.cabeEnAlgunTramo(tramos, start, finDeOcupacion)) return false;
    // A la apertura del negocio solo se le exige la parte con cliente delante.
    if (apertura && !this.cabeEnAlgunTramo(apertura, start, finDeCliente)) {
      return false;
    }

    const blocks = await this.blockRepo.find({
      where: { businessId, professionalId, date },
    });
    return !blocks.some((b) =>
      timesOverlap(start, finDeOcupacion, b.startTime, b.endTime)
    );
  }

  /** Indica si ya hay una cita viva del profesional que se solape con la reserva. */
  async hayConflicto(
    businessId: string,
    professionalId: string,
    date: string,
    intervalos: Intervalo[],
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

    return this.seSolapan(appointments, intervalos, excludeId);
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
    intervalos: Intervalo[],
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

    return this.seSolapan(appointments, intervalos, excludeId, manager);
  }

  /**
   * Minutos que cada profesional del negocio tiene disponibles ese día: su
   * jornada, acotada a la apertura del negocio y descontados los bloqueos.
   */
  async capacidadDelDia(
    businessId: string,
    date: string
  ): Promise<{ professionalId: string; minutosDisponibles: number }[]> {
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const horarios = await this.availRepo.find({
      where: { businessId, dayOfWeek, active: true },
    });
    const profesionales = [...new Set(horarios.map((h) => h.professionalId))];
    if (profesionales.length === 0) return [];

    const [bloqueos, apertura] = await Promise.all([
      this.blockRepo.find({
        where: { businessId, professionalId: In(profesionales), date },
      }),
      this.horarioDelNegocio.tramosDelDia(businessId, dayOfWeek),
    ]);

    const tramosPorProfesional = agruparPorProfesional(horarios);
    const bloqueosPorProfesional = agruparPorProfesional(bloqueos);

    return profesionales.map((professionalId) => ({
      professionalId,
      minutosDisponibles: this.minutosDisponibles(
        tramosPorProfesional.get(professionalId) ?? [],
        apertura,
        bloqueosPorProfesional.get(professionalId) ?? []
      ),
    }));
  }

  /** Suma los minutos de los tramos, acotados por la apertura y sin bloqueos. */
  private minutosDisponibles(
    tramos: Tramo[],
    apertura: Tramo[] | null,
    bloqueos: BlockedSlot[]
  ): number {
    let total = 0;

    for (const tramo of tramos) {
      for (const trozo of this.recortar(tramo, apertura)) {
        total += this.sinBloqueos(trozo, bloqueos);
      }
    }

    return total;
  }

  /** Parte del tramo que cae dentro de la apertura; sin apertura, entero. */
  private recortar(tramo: Tramo, apertura: Tramo[] | null): Tramo[] {
    if (!apertura) return [tramo];

    return apertura
      .map((abierto) => ({
        startTime: this.mayor(tramo.startTime, abierto.startTime),
        endTime: this.menor(tramo.endTime, abierto.endTime),
      }))
      .filter((t) => timeToMinutes(t.startTime) < timeToMinutes(t.endTime));
  }

  /** Minutos del tramo que ningún bloqueo se lleva por delante. */
  private sinBloqueos(tramo: Tramo, bloqueos: BlockedSlot[]): number {
    const inicio = timeToMinutes(tramo.startTime);
    const fin = timeToMinutes(tramo.endTime);
    let ocupado = 0;

    for (const bloqueo of bloqueos) {
      const desde = Math.max(inicio, timeToMinutes(bloqueo.startTime));
      const hasta = Math.min(fin, timeToMinutes(bloqueo.endTime));
      if (desde < hasta) ocupado += hasta - desde;
    }

    return Math.max(fin - inicio - ocupado, 0);
  }

  private mayor(a: string, b: string): string {
    return timeToMinutes(a) >= timeToMinutes(b) ? a : b;
  }

  private menor(a: string, b: string): string {
    return timeToMinutes(a) <= timeToMinutes(b) ? a : b;
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
    ocupacion: Map<string, Intervalo[]>,
    iniciosExtra: string[],
    duration: number,
    date: string,
    zona: string
  ): Franja[] {
    const franjas = new Map<string, Franja>();

    for (const tramo of [...tramos].sort(porHora)) {
      const finDelTramo = timeToMinutes(tramo.endTime);

      for (const slotStart of this.iniciosCandidatos(tramo, iniciosExtra)) {
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
            ocupacion,
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

  /**
   * Horas que se ofrecen dentro de un tramo: la rejilla más los finales de
   * ocupación que caen dentro de él.
   */
  private iniciosCandidatos(tramo: Tramo, iniciosExtra: string[]): string[] {
    const rejilla = getTimeSlots(
      tramo.startTime,
      tramo.endTime,
      DURACION_FRANJA_MINUTOS
    );
    const inicio = timeToMinutes(tramo.startTime);
    const fin = timeToMinutes(tramo.endTime);
    const dentro = iniciosExtra.filter((hora) => {
      const minuto = timeToMinutes(hora);
      return minuto >= inicio && minuto < fin;
    });

    return [...new Set([...rejilla, ...dentro])].sort();
  }

  /** Decide si una franja concreta puede reservarse. */
  private franjaLibre(
    slotStart: string,
    slotEnd: string,
    finDelTramo: number,
    apertura: Tramo[] | null,
    blocks: BlockedSlot[],
    appointments: Appointment[],
    ocupacion: Map<string, Intervalo[]>,
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

    // Bloque continuo: al listar horas no se sabe qué servicios la ocuparán.
    const candidato: Intervalo[] = [{ inicio: slotStart, fin: slotEnd }];
    return !appointments.some((a) =>
      algunSolape(ocupacion.get(a.id) ?? [], candidato)
    );
  }

  /** Solapamiento por intervalos, compartido por ambas comprobaciones. */
  private async seSolapan(
    appointments: Appointment[],
    intervalos: Intervalo[],
    excludeId?: string,
    manager?: EntityManager
  ): Promise<boolean> {
    const otras = appointments.filter((a) => a.id !== excludeId);
    if (otras.length === 0) return false;

    const ocupacion = await this.ocupacionDe(otras, manager);
    return otras.some((a) =>
      algunSolape(ocupacion.get(a.id) ?? [], intervalos)
    );
  }
}
