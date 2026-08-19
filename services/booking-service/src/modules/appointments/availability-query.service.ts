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
  arrastreDelDiaAnterior,
  arrastreDeJornada,
  diaAnterior,
  diaAnteriorDeLaSemana,
  finExtendido,
  MINUTOS_DEL_DIA,
  type Intervalo,
  type OcupacionDeProfesional,
} from "@beautyspot/shared-utils";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { HorarioDelNegocioService, Tramo } from "./horario-del-negocio.service";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import {
  intervalosPorProfesional,
  lineasPorCita,
  ocupacionDeCita,
} from "./intervalos-de-cita";

/** Franja de la agenda con su hora de inicio, de fin y si está libre. */
export interface Franja {
  startTime: string;
  endTime: string;
  available: boolean;
}

/** Jornada de un profesional, en la forma mínima que consume la agenda. */
interface Jornada extends Tramo {
  professionalId: string;
}

/** Tamaño de las franjas en que se divide la jornada al ofrecer disponibilidad. */
const DURACION_FRANJA_MINUTOS = 30;

/** Estados de cita que ocupan una franja e impiden reservar encima. */
const ESTADOS_QUE_OCUPAN = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

/** Agrupa por profesional bloqueos u horarios ya cargados. */
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

    // La ruta publica no dice de que negocio se pregunta: solo responde cuando
    // el profesional trabaja en uno.
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
    const horarios = await this.jornadasDelDia(businessId, dayOfWeek);
    const profesionales = [...new Set(horarios.map((h) => h.professionalId))];
    if (profesionales.length === 0) return [];

    // Bloqueos y citas del día de todo el equipo en dos consultas, sea cual sea
    // su tamaño.
    const [bloqueos, ocupados, apertura, zona] = await Promise.all([
      this.blockRepo.find({
        where: { businessId, professionalId: In(profesionales), date },
      }),
      this.ocupacionDelDia(businessId, date),
      this.aperturaDelDia(businessId, dayOfWeek),
      this.zonas.de(businessId),
    ]);

    const bloqueosPorProfesional = agruparPorProfesional(bloqueos);
    const tramosPorProfesional = agruparPorProfesional(horarios);

    // Sobre el equipo entero: el hueco que abre uno lo evalúan todos.
    const iniciosExtra = finalesDeOcupacion([...ocupados.values()]);

    const porProfesional = profesionales.map((professionalId) =>
      this.calcularFranjas(
        tramosPorProfesional.get(professionalId) ?? [],
        apertura,
        bloqueosPorProfesional.get(professionalId) ?? [],
        ocupados.get(professionalId) ?? [],
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

    const tramos = await this.jornadasDelDia(businessId, dayOfWeek, [
      professionalId,
    ]);
    if (tramos.length === 0) return [];

    const [blocks, ocupados, apertura, zona] = await Promise.all([
      this.blockRepo.find({ where: { businessId, professionalId, date } }),
      this.ocupacionDelDia(businessId, date),
      this.aperturaDelDia(businessId, dayOfWeek),
      this.zonas.de(businessId),
    ]);

    const suyos = ocupados.get(professionalId) ?? [];

    return this.calcularFranjas(
      tramos,
      apertura,
      blocks,
      suyos,
      finalesDeOcupacion([suyos]),
      duration,
      date,
      zona
    );
  }

  /**
   * Jornadas que se trabajan ese dia: las del propio dia mas la madrugada que
   * arrastra la del dia anterior, pasada a la escala del calculo.
   */
  private async jornadasDelDia(
    businessId: string,
    dayOfWeek: number,
    profesionales?: string[]
  ): Promise<Jornada[]> {
    const base = { businessId, active: true };
    const filtro = profesionales
      ? { ...base, professionalId: In(profesionales) }
      : base;

    const filas = await this.availRepo.find({
      where: [
        { ...filtro, dayOfWeek },
        { ...filtro, dayOfWeek: diaAnteriorDeLaSemana(dayOfWeek) },
      ],
    });

    const anterior = diaAnteriorDeLaSemana(dayOfWeek);
    const deHoy: Jornada[] = [];
    const deAyer: Jornada[] = [];
    for (const fila of filas) {
      const jornada = {
        professionalId: fila.professionalId,
        startTime: fila.startTime,
        endTime: finExtendido(fila.startTime, fila.endTime),
      };
      if (fila.dayOfWeek === dayOfWeek) deHoy.push(jornada);
      else if (fila.dayOfWeek === anterior) deAyer.push(jornada);
    }

    return [...deHoy, ...arrastreDeJornada(deAyer)];
  }

  /**
   * Apertura del negocio ese día, con la madrugada que arrastra la del día
   * anterior. `null` sigue significando "sin horario configurado".
   */
  private async aperturaDelDia(
    businessId: string,
    dayOfWeek: number
  ): Promise<Tramo[] | null> {
    const [hoy, ayer] = await Promise.all([
      this.horarioDelNegocio.tramosDelDia(businessId, dayOfWeek),
      this.horarioDelNegocio.tramosDelDia(
        businessId,
        diaAnteriorDeLaSemana(dayOfWeek)
      ),
    ]);

    if (hoy === null) return null;
    return [...hoy, ...arrastreDeJornada(ayer ?? [])];
  }

  /** Lo que cada profesional del negocio tiene ocupado ese día. */
  private async ocupacionDelDia(
    businessId: string,
    date: string,
    manager?: EntityManager,
    excludeId?: string
  ): Promise<Map<string, Intervalo[]>> {
    const citas = await this.citasVivas(businessId, date, manager);
    const otras = excludeId ? citas.filter((c) => c.id !== excludeId) : citas;

    const ocupacion = intervalosPorProfesional(
      await this.repartoDe(otras, manager)
    );

    // Trae el sobrante del dia anterior: una cita de 23:30 que dura una hora
    // termina a las "24:30", ya en esta madrugada.
    const deAyer = await this.citasVivas(
      businessId,
      diaAnterior(date),
      manager
    );
    const arrastradas = excludeId
      ? deAyer.filter((c) => c.id !== excludeId)
      : deAyer;
    for (const [profesional, intervalos] of intervalosPorProfesional(
      await this.repartoDe(arrastradas, manager)
    )) {
      const arrastre = arrastreDelDiaAnterior(intervalos);
      if (arrastre.length === 0) continue;
      ocupacion.set(profesional, [
        ...(ocupacion.get(profesional) ?? []),
        ...arrastre,
      ]);
    }

    return ocupacion;
  }

  /** Citas del día que ocupan agenda, con o sin transacción. */
  private async citasVivas(
    businessId: string,
    date: string,
    manager?: EntityManager
  ): Promise<Appointment[]> {
    const where = { businessId, date, status: In(ESTADOS_QUE_OCUPAN) };
    return manager
      ? manager.find(Appointment, { where })
      : this.apptRepo.find({ where });
  }

  /** Reparto por profesional de cada cita, resuelto con sus líneas. */
  private async repartoDe(
    citas: Appointment[],
    manager?: EntityManager
  ): Promise<OcupacionDeProfesional[][]> {
    if (citas.length === 0) return [];

    const ids = citas.map((c) => c.id);
    const repo = manager
      ? manager.getRepository(AppointmentServiceEntity)
      : this.lineaRepo;
    const lineas = await repo.find({ where: { appointmentId: In(ids) } });
    const porCita = lineasPorCita(lineas);

    return citas.map((cita) =>
      ocupacionDeCita(cita, porCita.get(cita.id) ?? [])
    );
  }

  /**
   * Comprueba que cada profesional de la cita trabaje a esa hora, quepa en el
   * horario del negocio y no tenga un bloqueo encima.
   */
  async franjaDentroDelHorario(
    businessId: string,
    date: string,
    dayOfWeek: number,
    reparto: OcupacionDeProfesional[]
  ): Promise<boolean> {
    const profesionales = reparto.map((o) => o.professionalId);
    const [horarios, apertura] = await Promise.all([
      this.jornadasDelDia(businessId, dayOfWeek, profesionales),
      this.aperturaDelDia(businessId, dayOfWeek),
    ]);

    const tramosPorProfesional = agruparPorProfesional(horarios);
    const trabajan = reparto.every((ocupacion) => {
      const tramos = tramosPorProfesional.get(ocupacion.professionalId) ?? [];
      // Entera dentro de un mismo tramo del profesional, limpieza incluida.
      if (!this.cabeEnAlgunTramo(tramos, ocupacion.inicio, ocupacion.fin)) {
        return false;
      }
      // A la apertura del negocio solo se le exige la parte con cliente delante.
      return (
        !apertura ||
        this.cabeEnAlgunTramo(
          apertura,
          ocupacion.inicio,
          ocupacion.finDeCliente
        )
      );
    });
    if (!trabajan) return false;

    const bloqueos = agruparPorProfesional(
      await this.blockRepo.find({
        where: { businessId, professionalId: In(profesionales), date },
      })
    );

    return reparto.every((ocupacion) =>
      (bloqueos.get(ocupacion.professionalId) ?? []).every(
        (b) =>
          !timesOverlap(ocupacion.inicio, ocupacion.fin, b.startTime, b.endTime)
      )
    );
  }

  /** Indica si alguna cita viva se solapa con lo que ocuparía la reserva. */
  async hayConflicto(
    businessId: string,
    date: string,
    reparto: OcupacionDeProfesional[],
    excludeId?: string
  ): Promise<boolean> {
    return this.seSolapan(
      await this.ocupacionDelDia(businessId, date, undefined, excludeId),
      reparto
    );
  }

  /**
   * Re-check de conflicto dentro de la transaccion SERIALIZABLE; por eso recibe
   * su manager y no el repositorio.
   */
  async hayConflictoEn(
    manager: EntityManager,
    businessId: string,
    date: string,
    reparto: OcupacionDeProfesional[],
    excludeId?: string
  ): Promise<boolean> {
    return this.seSolapan(
      await this.ocupacionDelDia(businessId, date, manager, excludeId),
      reparto
    );
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
    const horarios = await this.jornadasDelDia(businessId, dayOfWeek);
    const profesionales = [...new Set(horarios.map((h) => h.professionalId))];
    if (profesionales.length === 0) return [];

    const [bloqueos, apertura] = await Promise.all([
      this.blockRepo.find({
        where: { businessId, professionalId: In(profesionales), date },
      }),
      this.aperturaDelDia(businessId, dayOfWeek),
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
   * Divide en franjas cada tramo de trabajo y marca las que chocan con un
   * bloqueo, una cita o el cierre. `apertura` en `null` no acota.
   */
  private calcularFranjas(
    tramos: Tramo[],
    apertura: Tramo[] | null,
    blocks: BlockedSlot[],
    ocupados: Intervalo[],
    iniciosExtra: string[],
    duration: number,
    date: string,
    zona: string
  ): Franja[] {
    const franjas = new Map<string, Franja>();

    for (const tramo of [...tramos].sort(porHora)) {
      const finDelTramo = timeToMinutes(tramo.endTime);

      for (const slotStart of this.iniciosCandidatos(tramo, iniciosExtra)) {
        // Lo que empieza pasada la medianoche se ofrece bajo el dia siguiente,
        // traido por el arrastre de la jornada.
        if (timeToMinutes(slotStart) >= MINUTOS_DEL_DIA) continue;

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
            ocupados,
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
    ocupados: Intervalo[],
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
    return !algunSolape(ocupados, [{ inicio: slotStart, fin: slotEnd }]);
  }

  /** Compara lo ocupado del día contra lo que ocuparía la reserva. */
  private seSolapan(
    ocupados: Map<string, Intervalo[]>,
    reparto: OcupacionDeProfesional[]
  ): boolean {
    return reparto.some((o) =>
      algunSolape(ocupados.get(o.professionalId) ?? [], o.intervalos)
    );
  }
}
