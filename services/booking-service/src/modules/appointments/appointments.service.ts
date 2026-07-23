import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager, In } from "typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus, IPaginatedResponse } from "@beautyspot/shared-types";
import { EventNames } from "@beautyspot/event-types";
import {
  OutboxService,
  withSerializableRetry,
} from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import {
  getTimeSlots,
  calculateEndTime,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(Availability)
    private readonly availRepo: Repository<Availability>,
    @InjectRepository(BlockedSlot)
    private readonly blockRepo: Repository<BlockedSlot>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly outbox: OutboxService
  ) {}

  /** Crear cita verificando disponibilidad (transacción) */
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
    const available = await this.isSlotAvailable(
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
      await this.hasTimeConflict(
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
        const conflictInTx = await this.hasTimeConflictWith(
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

  /** Confirmar cita */
  async confirm(id: string, businessId: string): Promise<Appointment> {
    const appt = await this.findById(id, businessId);
    if (appt.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        `No se puede confirmar una cita en estado ${appt.status}`
      );
    }
    await this.apptRepo.update(
      { id, businessId },
      { status: AppointmentStatus.CONFIRMED }
    );
    return this.findById(id, businessId);
  }

  /** Iniciar servicio */
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

  /** Completar cita y otorgar puntos */
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
    const pointsEarned = Math.round(appt.totalAmount * 0.1);
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

  /** Cancelar cita con politica de 2 horas */
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
    if (hoursDiff < 2) {
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

  /** Marcar como no asistio */
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
    await this.apptRepo.update(
      { id, businessId },
      { status: AppointmentStatus.NO_SHOW }
    );
    return this.findById(id, businessId);
  }

  /** Reagendar cita */
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
    if (hoursDiff < 2) {
      throw new ForbiddenException(
        "No se puede reagendar con menos de 2 horas de anticipacion"
      );
    }

    const newEndTime = calculateEndTime(newStartTime, serviceDuration);
    const dayOfWeek = new Date(newDate + "T12:00:00").getDay();
    const available = await this.isSlotAvailable(
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
      await this.hasTimeConflict(
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
      const conflictInTx = await this.hasTimeConflictWith(
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

  /** Obtener slots disponibles */
  async findAvailableSlots(
    businessId: string,
    professionalId: string,
    date: string,
    duration: number
  ): Promise<{ startTime: string; endTime: string; available: boolean }[]> {
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    // Horario de trabajo del profesional
    const workHours = await this.availRepo.findOne({
      where: { businessId, professionalId, dayOfWeek, active: true },
    });
    if (!workHours) return [];

    // Bloqueos del dia
    const blocks = await this.blockRepo.find({
      where: { businessId, professionalId, date },
    });

    // Citas existentes del dia (una sola query en vez de dos)
    const allAppointments = await this.apptRepo.find({
      where: {
        businessId,
        professionalId,
        date,
        status: In([AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING]),
      },
    });

    // Generar slots de 30 minutos
    const slotDuration = 30;
    const slots = getTimeSlots(
      workHours.startTime,
      workHours.endTime,
      slotDuration
    );

    return slots.map((slotStart) => {
      const slotEnd = calculateEndTime(slotStart, duration);
      const slotEndTimeNum = timeToMinutes(slotEnd);
      const workEndNum = timeToMinutes(workHours.endTime);

      if (slotEndTimeNum > workEndNum) {
        return { startTime: slotStart, endTime: slotEnd, available: false };
      }

      // Verificar bloqueos
      const isBlocked = blocks.some((b) =>
        timesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
      );
      if (isBlocked) {
        return { startTime: slotStart, endTime: slotEnd, available: false };
      }

      // Verificar conflictos con citas
      const hasAppt = allAppointments.some((a) =>
        timesOverlap(slotStart, slotEnd, a.startTime, a.endTime)
      );

      return { startTime: slotStart, endTime: slotEnd, available: !hasAppt };
    });
  }

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
   * Verifica si un profesional tiene historial de citas.
   * Usado por core-service antes de permitir la eliminacion de un profesional.
   * Un profesional con citas solo puede ser inactivado, no eliminado.
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

  // ─── Helpers privados ──────────────────────────────────────

  private async isSlotAvailable(
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

    // Verificar que el slot esta dentro del horario de trabajo
    if (
      timeToMinutes(start) < timeToMinutes(workHours.startTime) ||
      timeToMinutes(end) > timeToMinutes(workHours.endTime)
    ) {
      return false;
    }

    // Verificar bloqueos
    const blocks = await this.blockRepo.find({
      where: { businessId, professionalId, date },
    });
    const isBlocked = blocks.some((b) =>
      timesOverlap(start, end, b.startTime, b.endTime)
    );
    return !isBlocked;
  }

  private async hasTimeConflict(
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
        status: In([
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_PROGRESS,
        ]),
      },
    });

    return this.appointmentsConflict(appointments, start, end, excludeId);
  }

  /**
   * Re-check de conflicto usando un EntityManager (dentro de una tx
   * SERIALIZABLE). Es el check autoritativo que previene el doble-booking.
   */
  private async hasTimeConflictWith(
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
        status: In([
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_PROGRESS,
        ]),
      },
    });

    return this.appointmentsConflict(appointments, start, end, excludeId);
  }

  /** Logica pura de solapamiento, compartida por ambos checks. */
  private appointmentsConflict(
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
