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
  IPaginatedResponse,
} from "@beautyspot/shared-types";
import { EventNames } from "@beautyspot/event-types";
import {
  InternalHttpClient,
  OutboxService,
  withSerializableRetry,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import { AvailabilityQueryService } from "./availability-query.service";
import { PoliticaDeReservaService } from "./politica-de-reserva.service";
import { PROPORCION_PUNTOS_FIDELIDAD } from "@beautyspot/shared-constants";
import {
  calculateEndTime,
  escapeLikePattern,
  esInstantePasadoEn,
  duracionDeCliente,
  finDeOcupacion,
  intervalosDeAgenda,
  instanteDe,
} from "@beautyspot/shared-utils";

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

/**
 * Orquesta el ciclo de vida de las citas (creación, confirmación, ejecución,
 * cancelación y reagendado) evitando el doble-booking con transacciones
 * SERIALIZABLE y publicando cada cambio vía el patrón Outbox.
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
   * Precio y duración que el catálogo del core-service aplica a estos servicios
   * para este profesional.
   *
   * Es la única fuente: tomarlos del cuerpo dejaría reservar por $0 desde la
   * ruta pública. Se usa `enviar` y no `pedirONulo` a propósito — un catálogo
   * que no responde tiene que hacer fallar la reserva, no degradarla a precio
   * cero.
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
    }
  ): Promise<Appointment> {
    const servicios = await this.resolverServicios(
      businessId,
      data.serviceIds,
      data.professionalId
    );
    const totalAmount = servicios.reduce((sum, s) => sum + s.price, 0);
    // El orden es el que se pidió, y de él sale el reparto de la agenda.
    const lineas = servicios.map((s, orden) => ({ ...s, orden }));
    const endTime = calculateEndTime(data.startTime, duracionDeCliente(lineas));
    const ocupadoHasta = finDeOcupacion(data.startTime, lineas);
    const intervalos = intervalosDeAgenda(data.startTime, endTime, lineas);

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
      data.professionalId,
      data.date,
      data.startTime,
      endTime,
      ocupadoHasta,
      dayOfWeek
    );
    if (!available) {
      throw new BadRequestException(
        "El horario seleccionado no esta disponible"
      );
    }

    // Pre-check de conflicto (UX) fuera de la tx
    if (
      await this.disponibilidad.hayConflicto(
        businessId,
        data.professionalId,
        data.date,
        intervalos
      )
    ) {
      throw new BadRequestException("Ya existe una cita en ese horario");
    }

    // Ejecutar dentro de transaccion SERIALIZABLE: el re-check del conflicto
    // dentro de la tx aislada es el que previene el doble-booking (race). Una
    // tx concurrente sobre el mismo slot recibe error de serializacion (40001),
    // que withSerializableRetry reintenta en vez de devolver un 500.
    const appointment = await withSerializableRetry(() =>
      this.dataSource.transaction("SERIALIZABLE", async (manager) => {
        const conflictInTx = await this.disponibilidad.hayConflictoEn(
          manager,
          businessId,
          data.professionalId,
          data.date,
          intervalos
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
          endTime,
          ocupadoHasta,
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
          })
        );
        await manager.save(AppointmentServiceEntity, apptServices);

        // El evento se persiste en la MISMA transacción que la cita (outbox):
        // si la tx hace rollback, no queda ni cita ni evento. El
        // OutboxRelayWorker lo publica a RabbitMQ una vez confirmado el commit.
        await this.outbox.enqueue(manager, {
          eventType: EventNames.BOOKING_APPOINTMENT_CREATED,
          aggregateType: "appointment",
          aggregateId: saved.id,
          payload: {
            appointmentId: saved.id,
            businessId,
            clientId: data.clientId,
            professionalId: data.professionalId,
            date: data.date,
            startTime: data.startTime,
            endTime,
            ocupadoHasta,
            totalAmount,
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
        payload: {
          appointmentId: id,
          businessId,
          clientId: appt.clientId,
          professionalId: appt.professionalId,
          date: appt.date,
          startTime: appt.startTime,
          endTime: appt.endTime,
          totalAmount: appt.totalAmount,
        },
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
    // Completar arrastra el cobro y los puntos de fidelidad: darla por atendida
    // antes de que empiece genera un ingreso por un servicio que no se ha
    // prestado.
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
        payload: {
          appointmentId: id,
          businessId,
          clientId: appt.clientId,
          professionalId: appt.professionalId,
          date: appt.date,
          startTime: appt.startTime,
          endTime: appt.endTime,
          totalAmount: appt.totalAmount,
          pointsEarned,
        },
      });
    });

    return this.findById(id, businessId);
  }

  /**
   * Cancela la cita.
   *
   * La antelación mínima solo se le exige al cliente: el negocio tiene que poder
   * cancelar lo que se le cae encima —un profesional enfermo, un imprevisto— sin
   * pelearse con su propio sistema.
   */
  async cancel(
    id: string,
    businessId: string,
    reason: string,
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
        { status: AppointmentStatus.CANCELLED, cancelReason: reason }
      );
      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_CANCELLED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: {
          appointmentId: id,
          businessId,
          clientId: appt.clientId,
          professionalId: appt.professionalId,
          date: appt.date,
          startTime: appt.startTime,
          endTime: appt.endTime,
          totalAmount: appt.totalAmount,
          cancelReason: reason,
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
        payload: {
          appointmentId: id,
          businessId,
          clientId: appt.clientId,
          professionalId: appt.professionalId,
          date: appt.date,
          startTime: appt.startTime,
          endTime: appt.endTime,
          totalAmount: appt.totalAmount,
        },
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
    const intervalos = intervalosDeAgenda(
      newStartTime,
      newEndTime,
      appt.appointmentServices
    );
    const dayOfWeek = new Date(newDate + "T12:00:00").getDay();
    const available = await this.disponibilidad.franjaDentroDelHorario(
      businessId,
      appt.professionalId,
      newDate,
      newStartTime,
      newEndTime,
      nuevoOcupadoHasta,
      dayOfWeek
    );
    if (!available)
      throw new BadRequestException("El nuevo horario no esta disponible");

    // Pre-check de conflicto (UX) excluyendo la propia cita
    if (
      await this.disponibilidad.hayConflicto(
        businessId,
        appt.professionalId,
        newDate,
        intervalos,
        id
      )
    )
      throw new BadRequestException("Ya existe una cita en el nuevo horario");

    // Actualizar dentro de tx SERIALIZABLE con re-check autoritativo para
    // prevenir doble-booking en el nuevo horario (race condition).
    await this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const conflictInTx = await this.disponibilidad.hayConflictoEn(
        manager,
        businessId,
        appt.professionalId,
        newDate,
        intervalos,
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
          endTime: newEndTime,
          ocupadoHasta: nuevoOcupadoHasta,
        }
      );

      await this.outbox.enqueue(manager, {
        eventType: EventNames.BOOKING_APPOINTMENT_RESCHEDULED,
        aggregateType: "appointment",
        aggregateId: id,
        payload: {
          appointmentId: id,
          businessId,
          clientId: appt.clientId,
          professionalId: appt.professionalId,
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          totalAmount: appt.totalAmount,
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
    },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Appointment>> {
    const base: Record<string, unknown> = { businessId };
    if (filters.status) base.status = filters.status;
    if (filters.date) base.date = filters.date;
    if (filters.professionalId) base.professionalId = filters.professionalId;
    if (filters.clientId) base.clientId = filters.clientId;

    return paginate(this.apptRepo, pagination, {
      where: await this.condicionesDeBusqueda(businessId, base, filters.search),
      relations: ["appointmentServices"],
      order: { date: "DESC", startTime: "ASC" },
    });
  }

  /**
   * Traduce el texto buscado a condiciones sobre la cita: el cliente se resuelve
   * en core, que es quien guarda su nombre, y el servicio se busca por el nombre
   * congelado en la propia cita.
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
   * Citas de un usuario cliente en todos los negocios donde haya reservado.
   * Las citas guardan el id de la ficha del negocio, asi que primero se
   * traducen las que core tiene atadas a ese usuario.
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
    reason: string
  ): Promise<Appointment> {
    const cita = await this.findByIdForClientUser(id, userId);
    return this.cancel(id, cita.businessId, reason, { esCliente: true });
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
  } | null> {
    const cita = await this.apptRepo.findOne({
      where: { id: appointmentId, businessId },
    });
    if (!cita) return null;

    return {
      clientId: cita.clientId,
      totalAmount: Number(cita.totalAmount),
      status: cita.status,
    };
  }

  /**
   * Indica si un usuario puede reseñar una cita: existe, es suya, es de ese
   * negocio y ya se atendió. Lo consulta el marketplace para decidir si acepta
   * la reseña.
   *
   * Devuelve también a quién y qué se atendió, para que el marketplace no
   * tenga que fiarse de lo que el autor escriba en el cuerpo.
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

  // ─── Helpers privados ──────────────────────────────────────
}
