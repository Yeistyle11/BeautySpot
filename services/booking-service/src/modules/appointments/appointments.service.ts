import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, ILike, In } from "typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import {
  AppointmentStatus,
  CancelReason,
  IPaginatedResponse,
} from "@beautyspot/shared-types";
import {
  AppointmentCreatedPayload,
  EventNames,
  ServicioDeLaCita,
} from "@beautyspot/event-types";
import {
  InternalHttpClient,
  OutboxService,
  withSerializableRetry,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import { serviciosDelEvento } from "../../common/servicios-del-evento";
import { AvailabilityQueryService } from "./availability-query.service";
import { PoliticaDeReservaService } from "./politica-de-reserva.service";
import { PROPORCION_PUNTOS_FIDELIDAD } from "@beautyspot/shared-constants";
import {
  calculateEndTime,
  escapeLikePattern,
  esInstantePasadoEn,
  duracionDeCliente,
  finDeOcupacion,
  horaDeReloj,
  repartoPorProfesional,
  instanteDe,
} from "@beautyspot/shared-utils";

/**
 * Fichas como mucho que se devuelven al preguntar a quien ha atendido un
 * profesional.
 */
const TOPE_DE_CLIENTES_POR_PROFESIONAL = 500;

/** Estados desde los que se puede mover una cita. */
const ESTADOS_REAGENDABLES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

/** Servicio tal y como lo devuelve el catálogo del core-service. */
interface ServicioResuelto {
  id: string;
  name: string;
  price: number;
  duration: number;
  procesadoDesde: number | null;
  procesadoMinutos: number | null;
  bufferDespues: number;
}

/** Servicio ya colocado en la cita: con su posición y con quién lo atiende. */
interface LineaDeCita extends ServicioResuelto {
  orden: number;
  professionalId: string | null;
}

/**
 * Cuerpo comun de los eventos de una cita. Los seis —alta, confirmacion,
 * atendida, cancelacion, ausencia y cambio de hora— describen la misma cita, y
 * escribirlo en cada uno hacia que anadir un campo pidiera seis ediciones
 * iguales; olvidar una no rompia la compilacion, porque los campos son
 * opcionales, y el evento salia incompleto hasta que faltaba un dato en
 * analytics.
 *
 * `cambios` es para lo que el evento sabe mejor que la fila: al reagendar, la
 * fecha y la hora nuevas todavia no estan escritas.
 */
function cuerpoDeCita(
  appt: Appointment,
  businessId: string,
  cambios: Partial<AppointmentCreatedPayload> = {}
): AppointmentCreatedPayload {
  return {
    appointmentId: appt.id,
    businessId,
    branchId: appt.branchId,
    clientId: appt.clientId,
    professionalId: appt.professionalId,
    date: appt.date,
    startTime: appt.startTime,
    endTime: appt.endTime,
    ocupadoHasta: appt.ocupadoHasta ?? undefined,
    totalAmount: appt.totalAmount,
    services: serviciosDelEvento(appt.appointmentServices),
    ...cambios,
  };
}

/**
 * Orquesta el ciclo de vida de las citas, evita el doble-booking con
 * transacciones SERIALIZABLE y publica cada cambio por el Outbox.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly http: InternalHttpClient,
    private readonly disponibilidad: AvailabilityQueryService,
    private readonly zonas: ZonaDelNegocioService,
    private readonly politica: PoliticaDeReservaService
  ) {}

  /** Indica si a la cita le falta menos de la antelación mínima. */
  private async faltaMenosDeLoMinimo(
    businessId: string,
    appt: Pick<Appointment, "date" | "startTime">
  ): Promise<boolean> {
    const [zona, minimas] = await Promise.all([
      this.zonas.de(businessId),
      this.politica.horasMinimasDeCancelacion(businessId),
    ]);
    const inicio = instanteDe(zona, appt.date, appt.startTime);
    const horasQueFaltan = (inicio.getTime() - Date.now()) / (1000 * 60 * 60);

    return horasQueFaltan < minimas;
  }

  /**
   * Precio y duracion que el catalogo del core-service aplica a estos
   * servicios para este profesional; si no responde, la reserva falla.
   */
  private async resolverServicios(
    businessId: string,
    ids: string[],
    professionalId?: string
  ): Promise<ServicioResuelto[]> {
    const servicios = await this.http.enviar<ServicioResuelto[]>(
      "core",
      "/internal/services/resolve",
      { businessId, ids, professionalId }
    );

    if (!Array.isArray(servicios) || servicios.length === 0) {
      throw new BadRequestException(
        "No se pudieron resolver los servicios de la cita"
      );
    }

    return servicios;
  }

  /**
   * Resuelve cada servicio con la tarifa del profesional que lo atiende y
   * devuelve las líneas en el orden pedido.
   */
  private async lineasDeLaCita(
    businessId: string,
    serviceIds: string[],
    titular: string,
    asignaciones: Map<string, string>
  ): Promise<LineaDeCita[]> {
    const ajeno = [...asignaciones.keys()].find(
      (id) => !serviceIds.includes(id)
    );
    if (ajeno) {
      throw new BadRequestException(
        "Se asigno un profesional a un servicio que no esta en la cita"
      );
    }

    const porProfesional = new Map<string, string[]>();
    for (const serviceId of serviceIds) {
      const profesional = asignaciones.get(serviceId) ?? titular;
      const suyos = porProfesional.get(profesional) ?? [];
      suyos.push(serviceId);
      porProfesional.set(profesional, suyos);
    }

    // Una llamada por profesional, porque el precio y la duracion dependen de
    // quien atiende, pero todas a la vez: en serie, una cita repartida entre
    // varios profesionales sumaba un viaje a core detras de otro.
    const porProfesionalResueltos = await Promise.all(
      [...porProfesional].map(([profesional, ids]) =>
        this.resolverServicios(businessId, ids, profesional)
      )
    );

    const resueltos = new Map<string, ServicioResuelto>();
    for (const servicio of porProfesionalResueltos.flat()) {
      resueltos.set(servicio.id, servicio);
    }

    return serviceIds.map((serviceId, orden) => {
      const servicio = resueltos.get(serviceId);
      if (!servicio) {
        throw new BadRequestException(
          "No se pudieron resolver los servicios de la cita"
        );
      }
      const asignado = asignaciones.get(serviceId);
      return {
        ...servicio,
        orden,
        professionalId: asignado && asignado !== titular ? asignado : null,
      };
    });
  }

  /** Comprueba que la sede indicada sea una sede activa del negocio. */
  private async validarSede(
    businessId: string,
    branchId?: string
  ): Promise<void> {
    if (!branchId) return;

    const sedes = await this.http.pedir<{ id: string }[]>(
      "core",
      `/internal/branches?businessId=${businessId}`
    );
    if (!Array.isArray(sedes) || !sedes.some((s) => s.id === branchId)) {
      throw new BadRequestException("La sede indicada no es de este negocio");
    }
  }

  /** Crea una cita comprobando que la franja siga libre. */
  async create(
    businessId: string,
    data: {
      professionalId: string;
      clientId: string;
      serviceIds: string[];
      date: string;
      startTime: string;
      notes?: string;
      branchId?: string;
      createdBy?: string;
      /** Profesional propio de algunos servicios; el resto los hace el titular. */
      asignaciones?: { serviceId: string; professionalId: string }[];
    }
  ): Promise<Appointment> {
    await this.validarSede(businessId, data.branchId);
    // El orden es el que se pidió, y de él sale el reparto de la agenda.
    const lineas = await this.lineasDeLaCita(
      businessId,
      data.serviceIds,
      data.professionalId,
      new Map(
        (data.asignaciones ?? []).map((a) => [a.serviceId, a.professionalId])
      )
    );
    const totalAmount = lineas.reduce((sum, s) => sum + s.price, 0);
    const endTime = calculateEndTime(data.startTime, duracionDeCliente(lineas));
    const ocupadoHasta = finDeOcupacion(data.startTime, lineas);
    const reparto = repartoPorProfesional(
      data.startTime,
      endTime,
      lineas,
      data.professionalId
    );

    // Pasa el fin de la escala extendida ("24:30") a la hora del reloj
    // ("00:30"), que es lo que se guarda y se publica.
    const finGuardado = horaDeReloj(endTime);
    const ocupadoHastaGuardado = horaDeReloj(ocupadoHasta);

    const zona = await this.zonas.de(businessId);
    if (esInstantePasadoEn(zona, data.date, data.startTime)) {
      throw new BadRequestException(
        "No se puede agendar una cita en el pasado"
      );
    }

    // Pre-check rapido (UX): fast-fail en slots obviamente invalidos fuera
    // de transaccion. El check autoritativo corre DENTRO de la tx SERIALIZABLE.
    const dayOfWeek = new Date(data.date + "T12:00:00").getDay();
    const available = await this.disponibilidad.franjaDentroDelHorario(
      businessId,
      data.date,
      dayOfWeek,
      reparto
    );
    if (!available) {
      throw new BadRequestException(
        "El horario seleccionado no está disponible"
      );
    }

    // Pre-check de conflicto (UX) fuera de la tx
    if (
      await this.disponibilidad.hayConflicto(businessId, data.date, reparto)
    ) {
      throw new BadRequestException("Ya existe una cita en ese horario");
    }

    // Dentro de la transaccion SERIALIZABLE se repite la comprobacion de
    // conflicto; el error 40001 lo reintenta withSerializableRetry.
    const appointment = await withSerializableRetry(() =>
      this.dataSource.transaction("SERIALIZABLE", async (manager) => {
        const conflictInTx = await this.disponibilidad.hayConflictoEn(
          manager,
          businessId,
          data.date,
          reparto
        );
        if (conflictInTx) {
          throw new BadRequestException("Ya existe una cita en ese horario");
        }

        const created = manager.create(Appointment, {
          businessId,
          branchId: data.branchId,
          clientId: data.clientId,
          professionalId: data.professionalId,
          date: data.date,
          startTime: data.startTime,
          endTime: finGuardado,
          ocupadoHasta: ocupadoHastaGuardado,
          totalAmount,
          notes: data.notes,
          createdBy: data.createdBy,
        });
        const saved = await manager.save(Appointment, created);

        // Se congela el precio y el nombre del momento de la reserva: si el
        // negocio cambia la tarifa mañana, esta cita conserva la suya.
        const apptServices = lineas.map((s) =>
          manager.create(AppointmentServiceEntity, {
            appointmentId: saved.id,
            serviceId: s.id,
            serviceName: s.name,
            price: s.price,
            duration: s.duration,
            orden: s.orden,
            procesadoDesde: s.procesadoDesde,
            procesadoMinutos: s.procesadoMinutos,
            bufferDespues: s.bufferDespues,
            professionalId: s.professionalId,
          })
        );
        await manager.save(AppointmentServiceEntity, apptServices);

        // El evento se persiste en la misma transaccion que la cita; el
        // OutboxRelayWorker lo publica tras el commit.
        await this.outbox.enqueue(manager, {
          eventType: EventNames.BOOKING_APPOINTMENT_CREATED,
          aggregateType: "appointment",
          aggregateId: saved.id,
          payload: {
            ...cuerpoDeCita(saved, businessId, {
              services: serviciosDelEvento(apptServices),
            }),
          },
        });

        const result = await manager.findOne(Appointment, {
          where: { id: saved.id },
          relations: ["appointmentServices"],
        });
        return result!;
      })
    );

    return appointment;
  }

  /** Pasa la cita a confirmada. */
  async confirm(id: string, businessId: string): Promise<Appointment> {
    const appt = await this.findById(id, businessId);
    if (appt.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        `No se puede confirmar una cita en estado ${appt.status}`
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Appointment,
        { id, businessId },
        { status: AppointmentStatus.CONFIRMED }
      );
      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: { ...cuerpoDeCita(appt, businessId) },
      });
    });
    return this.findById(id, businessId);
  }

  /** Marca que el servicio ha empezado. */
  async startService(id: string, businessId: string): Promise<Appointment> {
    const appt = await this.findById(id, businessId);
    if (appt.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(
        "Solo se puede iniciar una cita confirmada"
      );
    }
    await this.apptRepo.update(
      { id, businessId },
      {
        status: AppointmentStatus.IN_PROGRESS,
        // Reiniciar una cita no debe perder la hora a la que empezó de verdad.
        startedAt: appt.startedAt ?? new Date(),
      }
    );
    return this.findById(id, businessId);
  }

  /** Da la cita por atendida y suma los puntos de fidelidad al cliente. */
  async complete(id: string, businessId: string): Promise<Appointment> {
    const appt = await this.findById(id, businessId);
    if (
      appt.status !== AppointmentStatus.CONFIRMED &&
      appt.status !== AppointmentStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        "Solo se puede completar una cita confirmada o en progreso"
      );
    }
    // No se da por atendida una cita que aun no ha empezado: completar
    // arrastra el cobro y los puntos de fidelidad.
    const zona = await this.zonas.de(businessId);
    if (!esInstantePasadoEn(zona, appt.date, appt.startTime)) {
      throw new BadRequestException(
        "La cita todavía no ha empezado: no se puede dar por atendida"
      );
    }
    const pointsEarned = Math.round(
      appt.totalAmount * PROPORCION_PUNTOS_FIDELIDAD
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Appointment,
        { id, businessId },
        {
          status: AppointmentStatus.COMPLETED,
          pointsEarned,
          completedAt: appt.completedAt ?? new Date(),
        }
      );
      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_COMPLETED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: { ...cuerpoDeCita(appt, businessId), pointsEarned },
      });
    });

    return this.findById(id, businessId);
  }

  /**
   * Cancela la cita. La antelacion minima solo se le exige al cliente.
   */
  async cancel(
    id: string,
    businessId: string,
    motivo: {
      tipo: CancelReason;
      nota?: string;
      /** Usuario que la cancela; nulo en los caminos sin sesión. */
      canceladaPor?: string;
    },
    opciones: { esCliente: boolean } = { esCliente: false }
  ): Promise<Appointment> {
    const appt = await this.findById(id, businessId);
    if (
      appt.status === AppointmentStatus.COMPLETED ||
      appt.status === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `No se puede cancelar una cita en estado ${appt.status}`
      );
    }

    if (
      opciones.esCliente &&
      (await this.faltaMenosDeLoMinimo(businessId, appt))
    ) {
      const horas = await this.politica.horasMinimasDeCancelacion(businessId);
      throw new ForbiddenException(
        `No se puede cancelar con menos de ${horas} horas de anticipacion`
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Appointment,
        { id, businessId },
        {
          status: AppointmentStatus.CANCELLED,
          cancelReason: motivo.nota ?? null,
          cancelReasonType: motivo.tipo,
          cancelledBy: motivo.canceladaPor ?? null,
          cancelledAt: new Date(),
        }
      );
      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_CANCELLED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: {
          ...cuerpoDeCita(appt, businessId),
          cancelReason: motivo.nota,
          cancelReasonType: motivo.tipo,
          cancelledBy: motivo.canceladaPor,
        },
      });
    });

    return this.findById(id, businessId);
  }

  /** Marca que el cliente no se presentó. */
  async markNoShow(id: string, businessId: string): Promise<Appointment> {
    const appt = await this.findById(id, businessId);
    if (
      appt.status !== AppointmentStatus.PENDING &&
      appt.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        "Solo se puede marcar no-show en citas pendientes o confirmadas"
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Appointment,
        { id, businessId },
        { status: AppointmentStatus.NO_SHOW }
      );
      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_NO_SHOWED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: { ...cuerpoDeCita(appt, businessId) },
      });
    });
    return this.findById(id, businessId);
  }

  /** Mueve la cita a otra fecha y hora, conservando su duración y su estado. */
  async reschedule(
    id: string,
    businessId: string,
    newDate: string,
    newStartTime: string,
    opciones: { esCliente: boolean } = { esCliente: false }
  ): Promise<Appointment> {
    const appt = await this.findById(id, businessId);

    if (!ESTADOS_REAGENDABLES.includes(appt.status)) {
      throw new BadRequestException(
        `No se puede reagendar una cita en estado ${appt.status}`
      );
    }

    // Duración y reparto salen de los servicios congelados en la cita.
    const serviceDuration = duracionDeCliente(appt.appointmentServices);
    if (serviceDuration <= 0) {
      throw new BadRequestException(
        "La cita no tiene servicios: no se puede calcular su duracion"
      );
    }

    if (
      opciones.esCliente &&
      (await this.faltaMenosDeLoMinimo(businessId, appt))
    ) {
      const horas = await this.politica.horasMinimasDeCancelacion(businessId);
      throw new ForbiddenException(
        `No se puede reagendar con menos de ${horas} horas de anticipacion`
      );
    }

    const zona = await this.zonas.de(businessId);
    if (esInstantePasadoEn(zona, newDate, newStartTime)) {
      throw new BadRequestException(
        "No se puede reagendar a un horario pasado"
      );
    }

    const newEndTime = calculateEndTime(newStartTime, serviceDuration);
    const nuevoOcupadoHasta = finDeOcupacion(
      newStartTime,
      appt.appointmentServices
    );
    const reparto = repartoPorProfesional(
      newStartTime,
      newEndTime,
      appt.appointmentServices,
      appt.professionalId
    );
    const finGuardado = horaDeReloj(newEndTime);
    const ocupadoHastaGuardado = horaDeReloj(nuevoOcupadoHasta);
    const dayOfWeek = new Date(newDate + "T12:00:00").getDay();
    const available = await this.disponibilidad.franjaDentroDelHorario(
      businessId,
      newDate,
      dayOfWeek,
      reparto
    );
    if (!available)
      throw new BadRequestException("El nuevo horario no está disponible");

    // Pre-check de conflicto (UX) excluyendo la propia cita
    if (
      await this.disponibilidad.hayConflicto(businessId, newDate, reparto, id)
    )
      throw new BadRequestException("Ya existe una cita en el nuevo horario");

    // Actualizar dentro de tx SERIALIZABLE con re-check autoritativo para
    // prevenir doble-booking en el nuevo horario (race condition).
    await this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const conflictInTx = await this.disponibilidad.hayConflictoEn(
        manager,
        businessId,
        newDate,
        reparto,
        id
      );
      if (conflictInTx)
        throw new BadRequestException("Ya existe una cita en el nuevo horario");

      // El estado no se toca: una cita confirmada sigue confirmada al moverla.
      await manager.update(
        Appointment,
        { id, businessId },
        {
          date: newDate,
          startTime: newStartTime,
          endTime: finGuardado,
          ocupadoHasta: ocupadoHastaGuardado,
        }
      );

      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_RESCHEDULED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: {
          ...cuerpoDeCita(appt, businessId, {
            date: newDate,
            startTime: newStartTime,
            endTime: finGuardado,
          }),
          previousDate: appt.date,
          previousStartTime: appt.startTime,
        },
      });
    });
    return this.findById(id, businessId);
  }

  /** Obtiene una cita del negocio con sus servicios; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<Appointment> {
    const appt = await this.apptRepo.findOne({
      where: { id, businessId },
      relations: {
        appointmentServices: true,
      },
    });
    if (!appt) throw new NotFoundException("Cita no encontrada");
    return appt;
  }

  /** Lista las citas del negocio con filtros (estado, fecha, profesional, cliente) y paginación. */
  async findByBusiness(
    businessId: string,
    filters: {
      status?: AppointmentStatus;
      date?: string;
      professionalId?: string;
      clientId?: string;
      search?: string;
      branchId?: string;
    },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Appointment>> {
    const base: Record<string, unknown> = { businessId };
    if (filters.status) base.status = filters.status;
    if (filters.date) base.date = filters.date;
    if (filters.professionalId) base.professionalId = filters.professionalId;
    if (filters.clientId) base.clientId = filters.clientId;
    if (filters.branchId) base.branchId = filters.branchId;

    return paginate(this.apptRepo, pagination, {
      where: await this.condicionesDeBusqueda(businessId, base, filters.search),
      relations: ["appointmentServices"],
      order: { date: "DESC", startTime: "ASC" },
    });
  }

  /**
   * Traduce el texto buscado a condiciones sobre la cita: el cliente se
   * resuelve en core y el servicio por el nombre congelado en la cita.
   */
  private async condicionesDeBusqueda(
    businessId: string,
    base: Record<string, unknown>,
    search?: string
  ): Promise<Record<string, unknown> | Record<string, unknown>[]> {
    const texto = search?.trim();
    if (!texto) return base;

    const clientIds = await this.http.pedirONulo<string[]>(
      "core",
      `/internal/clients/search?businessId=${businessId}&q=${encodeURIComponent(texto)}`
    );

    const patron = ILike(`%${escapeLikePattern(texto)}%`);
    const condiciones: Record<string, unknown>[] = [
      { ...base, appointmentServices: { serviceName: patron } },
    ];
    if (clientIds?.length) {
      condiciones.push({ ...base, clientId: In(clientIds) });
    }

    return condiciones;
  }

  /**
   * Citas de un usuario cliente en todos los negocios donde haya reservado,
   * traduciendo antes sus fichas de cliente en core.
   */
  async findByClientUser(
    userId: string,
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Appointment>> {
    const clientIds = await this.clientIdsDelUsuario(userId);
    if (clientIds.length === 0) {
      return {
        data: [],
        meta: {
          page: pagination.page,
          limit: pagination.limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    return paginate(this.apptRepo, pagination, {
      where: { clientId: In(clientIds) },
      relations: ["appointmentServices"],
      order: { date: "DESC", startTime: "ASC" },
    });
  }

  /**
   * Cita concreta del cliente autenticado. El negocio sale de la propia cita,
   * no de la cabecera: un cliente no pertenece a ningún negocio.
   */
  async findByIdForClientUser(
    id: string,
    userId: string
  ): Promise<Appointment> {
    const cita = await this.apptRepo.findOne({
      where: { id },
      relations: ["appointmentServices"],
    });
    if (!cita) throw new NotFoundException("Cita no encontrada");

    const clientIds = await this.clientIdsDelUsuario(userId);
    if (!clientIds.includes(cita.clientId)) {
      throw new NotFoundException("Cita no encontrada");
    }

    return cita;
  }

  /** Cancela una cita propia del cliente, sujeta a la antelación mínima. */
  async cancelForClientUser(
    id: string,
    userId: string,
    nota?: string
  ): Promise<Appointment> {
    const cita = await this.findByIdForClientUser(id, userId);
    return this.cancel(
      id,
      cita.businessId,
      { tipo: CancelReason.CLIENTE_CANCELA, nota, canceladaPor: userId },
      { esCliente: true }
    );
  }

  /** Reagenda una cita propia del cliente, sujeta a la antelación mínima. */
  async rescheduleForClientUser(
    id: string,
    userId: string,
    newDate: string,
    newStartTime: string
  ): Promise<Appointment> {
    const cita = await this.findByIdForClientUser(id, userId);
    return this.reschedule(id, cita.businessId, newDate, newStartTime, {
      esCliente: true,
    });
  }

  /** Pregunta a core qué fichas de cliente pertenecen a este usuario. */
  private async clientIdsDelUsuario(userId: string): Promise<string[]> {
    const fichas = await this.http.pedir<{ id?: unknown }[]>(
      "core",
      `/internal/clients/by-user/${userId}`
    );

    return Array.isArray(fichas)
      ? fichas
          .map((c) => c.id)
          .filter((id): id is string => typeof id === "string")
      : [];
  }

  /**
   * Cuenta las citas de un profesional, totales y atendidas; lo consulta core
   * para decidir si puede eliminarlo o solo inactivarlo.
   */
  async professionalHasHistory(
    professionalId: string,
    businessId: string
  ): Promise<{
    hasHistory: boolean;
    totalAppointments: number;
    completedAppointments: number;
  }> {
    const totalAppointments = await this.apptRepo.count({
      where: { professionalId, businessId },
    });

    const completedAppointments = await this.apptRepo.count({
      where: {
        professionalId,
        businessId,
        status: AppointmentStatus.COMPLETED,
      },
    });

    return {
      hasHistory: totalAppointments > 0,
      totalAppointments,
      completedAppointments,
    };
  }

  /**
   * Fichas que ha atendido un profesional en el negocio, de la mas reciente a
   * la mas antigua, contando todas las citas menos las canceladas.
   */
  async clientIdsAtendidosPor(
    professionalId: string,
    businessId: string,
    tope = TOPE_DE_CLIENTES_POR_PROFESIONAL
  ): Promise<{ clientIds: string[]; truncado: boolean }> {
    // Agrupa en vez de DISTINCT para poder ordenar por la cita mas reciente,
    // y pide una de mas para saber si hubo corte.
    const filas = await this.apptRepo
      .createQueryBuilder("a")
      .select("a.client_id", "clientId")
      .where("a.professional_id = :professionalId", { professionalId })
      .andWhere("a.business_id = :businessId", { businessId })
      .andWhere("a.status != :cancelada", {
        cancelada: AppointmentStatus.CANCELLED,
      })
      .groupBy("a.client_id")
      .orderBy("MAX(a.date)", "DESC")
      .limit(tope + 1)
      .getRawMany<{ clientId: string }>();

    return {
      clientIds: filas.slice(0, tope).map((f) => f.clientId),
      truncado: filas.length > tope,
    };
  }

  /**
   * Importe, estado y cliente de una cita del negocio, o `null` si no existe o
   * es de otro. Lo consulta payment para contrastar el cobro.
   */
  async datosDeCobro(
    appointmentId: string,
    businessId: string
  ): Promise<{
    clientId: string;
    totalAmount: number;
    status: AppointmentStatus;
    services: ServicioDeLaCita[];
  } | null> {
    const cita = await this.apptRepo.findOne({
      where: { id: appointmentId, businessId },
      // Los servicios viajan con el cobro para que el recibo diga qué se pagó:
      // payment no guarda el detalle, solo el importe.
      relations: { appointmentServices: true },
    });
    if (!cita) return null;

    return {
      clientId: cita.clientId,
      totalAmount: Number(cita.totalAmount),
      status: cita.status,
      services: serviciosDelEvento(cita.appointmentServices),
    };
  }

  /**
   * Indica si un usuario puede resenar una cita, y devuelve a quien y que se
   * atendio.
   */
  async citaReseñablePor(
    appointmentId: string,
    userId: string,
    businessId: string
  ): Promise<{
    resenable: boolean;
    professionalId?: string;
    servicios?: string[];
  }> {
    const cita = await this.apptRepo.findOne({
      where: { id: appointmentId, businessId },
      relations: { appointmentServices: true },
    });
    if (!cita || cita.status !== AppointmentStatus.COMPLETED) {
      return { resenable: false };
    }

    const fichas = await this.clientIdsDelUsuario(userId);
    if (!fichas.includes(cita.clientId)) return { resenable: false };

    return {
      resenable: true,
      professionalId: cita.professionalId,
      servicios: cita.appointmentServices.map((s) => s.serviceName),
    };
  }
}
