import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, In } from "typeorm";
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
} from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import { AvailabilityQueryService } from "./availability-query.service";
import {
  HORAS_MINIMAS_CANCELACION,
  PROPORCION_PUNTOS_FIDELIDAD,
} from "@beautyspot/shared-constants";
import { calculateEndTime } from "@beautyspot/shared-utils";

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
    private readonly disponibilidad: AvailabilityQueryService
  ) {}

  /** Crea una cita comprobando que la franja siga libre. */
  async create(
    businessId: string,
    data: {
      professionalId: string;
      clientId: string;
      serviceIds: {
        id: string;
        name: string;
        price: number;
        duration: number;
      }[];
      date: string;
      startTime: string;
      notes?: string;
      branchId?: string;
      createdBy?: string;
    }
  ): Promise<Appointment> {
    const totalDuration = data.serviceIds.reduce(
      (sum, s) => sum + s.duration,
      0
    );
    const totalAmount = data.serviceIds.reduce((sum, s) => sum + s.price, 0);
    const endTime = calculateEndTime(data.startTime, totalDuration);

    // Pre-check rapido (UX): fast-fail en slots obviamente invalidos fuera
    // de transaccion. El check autoritativo corre DENTRO de la tx SERIALIZABLE.
    const dayOfWeek = new Date(data.date + "T12:00:00").getDay();
    const available = await this.disponibilidad.franjaDentroDelHorario(
      businessId,
      data.professionalId,
      data.date,
      data.startTime,
      endTime,
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
        data.startTime,
        endTime
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
          data.startTime,
          endTime
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
          totalAmount,
          notes: data.notes,
          createdBy: data.createdBy,
        });
        const saved = await manager.save(Appointment, created);

        const apptServices = data.serviceIds.map((s) =>
          manager.create(AppointmentServiceEntity, {
            appointmentId: saved.id,
            serviceId: s.id,
            serviceName: s.name,
            price: s.price,
            duration: s.duration,
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
      { status: AppointmentStatus.IN_PROGRESS }
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
    const pointsEarned = Math.round(
      appt.totalAmount * PROPORCION_PUNTOS_FIDELIDAD
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Appointment,
        { id, businessId },
        { status: AppointmentStatus.COMPLETED, pointsEarned }
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

  /** Cancela la cita si aún queda margen suficiente antes de la hora. */
  async cancel(
    id: string,
    businessId: string,
    reason: string,
    _userId: string
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

    // Verificar politica de cancelacion (2 horas antes)
    const appointmentDate = new Date(`${appt.date}T${appt.startTime}:00`);
    const now = new Date();
    const hoursDiff =
      (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < HORAS_MINIMAS_CANCELACION) {
      throw new ForbiddenException(
        "No se puede cancelar con menos de 2 horas de anticipacion"
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

  /** Mueve la cita a otra fecha y hora. */
  async reschedule(
    id: string,
    businessId: string,
    newDate: string,
    newStartTime: string,
    serviceDuration: number
  ): Promise<Appointment> {
    const appt = await this.findById(id, businessId);

    const appointmentDate = new Date(`${appt.date}T${appt.startTime}:00`);
    const hoursDiff =
      (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursDiff < HORAS_MINIMAS_CANCELACION) {
      throw new ForbiddenException(
        "No se puede reagendar con menos de 2 horas de anticipacion"
      );
    }

    const newEndTime = calculateEndTime(newStartTime, serviceDuration);
    const dayOfWeek = new Date(newDate + "T12:00:00").getDay();
    const available = await this.disponibilidad.franjaDentroDelHorario(
      businessId,
      appt.professionalId,
      newDate,
      newStartTime,
      newEndTime,
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
        newStartTime,
        newEndTime,
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
        newStartTime,
        newEndTime,
        id
      );
      if (conflictInTx)
        throw new BadRequestException("Ya existe una cita en el nuevo horario");

      await manager.update(
        Appointment,
        { id, businessId },
        {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          status: AppointmentStatus.PENDING,
          cancelReason: undefined,
        }
      );
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
    },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Appointment>> {
    const where: Record<string, unknown> = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.date) where.date = filters.date;
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.clientId) where.clientId = filters.clientId;

    return paginate(this.apptRepo, pagination, {
      where,
      relations: ["appointmentServices"],
      order: { date: "DESC", startTime: "ASC" },
    });
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
  async professionalHasHistory(professionalId: string): Promise<{
    hasHistory: boolean;
    totalAppointments: number;
    completedAppointments: number;
  }> {
    const totalAppointments = await this.apptRepo.count({
      where: { professionalId },
    });

    const completedAppointments = await this.apptRepo.count({
      where: { professionalId, status: AppointmentStatus.COMPLETED },
    });

    return {
      hasHistory: totalAppointments > 0,
      totalAppointments,
      completedAppointments,
    };
  }

  /**
   * Indica si un usuario puede reseñar una cita: existe, es suya, es de ese
   * negocio y ya se atendió. Lo consulta el marketplace para conceder el
   * distintivo de reseña verificada.
   */
  async citaReseñablePor(
    appointmentId: string,
    userId: string,
    businessId: string
  ): Promise<{ resenable: boolean }> {
    const cita = await this.apptRepo.findOne({
      where: { id: appointmentId, businessId },
    });
    if (!cita || cita.status !== AppointmentStatus.COMPLETED) {
      return { resenable: false };
    }

    const fichas = await this.clientIdsDelUsuario(userId);
    return { resenable: fichas.includes(cita.clientId) };
  }

  // ─── Helpers privados ──────────────────────────────────────
}
