import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  calculateEndTime,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";

/**
 * Permite reservar citas desde el marketplace sin autenticación, resolviendo al
 * cliente invitado contra el core-service y validando la disponibilidad.
 */
@Injectable()
export class PublicBookingService {
  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(AppointmentServiceEntity)
    private readonly apptServiceRepo: Repository<AppointmentServiceEntity>,
    @InjectRepository(Availability)
    private readonly availRepo: Repository<Availability>,
    @InjectRepository(BlockedSlot)
    private readonly blockRepo: Repository<BlockedSlot>,
    private configService: ConfigService
  ) {}

  /**
   * Crea una cita a partir de los datos de un invitado: resuelve/crea el cliente,
   * valida disponibilidad y conflictos, y registra la cita en estado PENDING.
   */
  async createPublicAppointment(data: {
    businessId: string;
    professionalId?: string;
    serviceIds: { id: string; name: string; price: number; duration: number }[];
    date: string;
    startTime: string;
    notes?: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    userId?: string;
  }) {
    // 1. Resolver o crear el cliente invitado vía el endpoint interno del core-service.
    const clientId = await this.findOrCreateGuestClient(
      data.businessId,
      data.guestName,
      data.guestEmail,
      data.guestPhone,
      data.userId
    );

    // 2. Calcular la hora de fin sumando la duración de los servicios.
    const totalDuration = data.serviceIds.reduce(
      (sum, s) => sum + s.duration,
      0
    );
    const totalAmount = data.serviceIds.reduce((sum, s) => sum + s.price, 0);
    const endTime = calculateEndTime(data.startTime, totalDuration);

    // 3. Verificar disponibilidad del horario.
    const dayOfWeek = new Date(data.date + "T12:00:00").getDay();

    // Sin profesional pedido se asigna el primero del negocio que tenga libre
    // la franja; con uno concreto se comprueba solo ese.
    const professionalId = data.professionalId
      ? await this.confirmarProfesionalLibre(
          data.businessId,
          data.professionalId,
          data.date,
          data.startTime,
          endTime,
          dayOfWeek
        )
      : await this.primerProfesionalLibre(
          data.businessId,
          data.date,
          data.startTime,
          endTime,
          dayOfWeek
        );

    // 4. Crear la cita con sus servicios.
    const appointment = this.apptRepo.create({
      businessId: data.businessId,
      clientId,
      professionalId,
      date: data.date,
      startTime: data.startTime,
      endTime,
      totalAmount,
      notes: data.notes,
      status: AppointmentStatus.PENDING,
    });
    const saved = await this.apptRepo.save(appointment);

    const apptServices = data.serviceIds.map((s) =>
      this.apptServiceRepo.create({
        appointmentId: saved.id,
        serviceId: s.id,
        serviceName: s.name,
        price: s.price,
        duration: s.duration,
      })
    );
    await this.apptServiceRepo.save(apptServices);

    return {
      id: saved.id,
      date: saved.date,
      startTime: saved.startTime,
      endTime: saved.endTime,
      status: saved.status,
      totalAmount,
      services: data.serviceIds.map((s) => s.name),
    };
  }

  /** Pide al core-service el cliente que coincida o uno nuevo; falla si el servicio no responde. */
  private async findOrCreateGuestClient(
    businessId: string,
    name: string,
    email?: string,
    phone?: string,
    userId?: string
  ): Promise<string> {
    const coreServiceUrl = this.configService.get<string>(
      "CORE_SERVICE_URL",
      "http://localhost:3002"
    );
    const internalSecret = this.configService.get<string>(
      "INTERNAL_API_SECRET",
      ""
    );
    const body = JSON.stringify({ businessId, name, email, phone, userId });

    let response: Response;
    try {
      response = await fetch(
        `${coreServiceUrl}/internal/clients/find-or-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
          },
          body,
          signal: AbortSignal.timeout(5000),
        }
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        `No se pudo crear el cliente guest (core-service no disponible). ` +
          `Reintenta mas tarde. Error: ${
            error instanceof Error ? error.message : String(error)
          }`
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `No se pudo crear el cliente guest (core-service respondio ${response.status}). ` +
          `Reintenta mas tarde.`
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new InternalServerErrorException(
        `Respuesta invalida del core-service al crear cliente guest: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const payload =
      typeof data === "object" && data !== null && "success" in data
        ? (data as Record<string, unknown>).data
        : data;

    const client = payload as { id?: unknown } | null | undefined;

    if (!client || typeof client.id !== "string" || client.id.length === 0) {
      throw new InternalServerErrorException(
        "El core-service no retorno un clientId valido"
      );
    }

    return client.id;
  }

  /** Valida que el profesional pedido tenga libre la franja, o explica por que no. */
  private async confirmarProfesionalLibre(
    businessId: string,
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string,
    dayOfWeek: number
  ): Promise<string> {
    const libre = await this.isSlotAvailable(
      businessId,
      professionalId,
      date,
      startTime,
      endTime,
      dayOfWeek
    );
    if (!libre) {
      throw new BadRequestException(
        "El horario seleccionado no esta disponible"
      );
    }

    const ocupado = await this.hasTimeConflict(
      businessId,
      professionalId,
      date,
      startTime,
      endTime
    );
    if (ocupado) {
      throw new BadRequestException("Ya existe una cita en ese horario");
    }

    return professionalId;
  }

  /**
   * Primer profesional del negocio con la franja libre, en el orden en que los
   * devuelve la tabla de horarios.
   *
   * Solo entran los que tienen horario activo ese dia, asi que la lista ya
   * excluye a quien no trabaja. Se comprueban de uno en uno y se devuelve el
   * primero que pase: al reservar sin preferencia da igual cual sea, y recorrer
   * el resto solo alargaria la espera.
   */
  private async primerProfesionalLibre(
    businessId: string,
    date: string,
    startTime: string,
    endTime: string,
    dayOfWeek: number
  ): Promise<string> {
    const horarios = await this.availRepo.find({
      where: { businessId, dayOfWeek, active: true },
    });

    const candidatos = [...new Set(horarios.map((h) => h.professionalId))];

    for (const professionalId of candidatos) {
      const libre = await this.isSlotAvailable(
        businessId,
        professionalId,
        date,
        startTime,
        endTime,
        dayOfWeek
      );
      if (!libre) continue;

      const ocupado = await this.hasTimeConflict(
        businessId,
        professionalId,
        date,
        startTime,
        endTime
      );
      if (!ocupado) return professionalId;
    }

    throw new BadRequestException(
      "Ningun profesional tiene libre ese horario. Elige otra hora."
    );
  }

  /** Comprueba que el slot cae dentro del horario del profesional y no choca con un bloqueo. */
  private async isSlotAvailable(
    businessId: string,
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string,
    dayOfWeek: number
  ): Promise<boolean> {
    const avail = await this.availRepo.findOne({
      where: { businessId, professionalId, dayOfWeek, active: true },
    });
    if (!avail) return false;
    if (
      timeToMinutes(startTime) < timeToMinutes(avail.startTime) ||
      timeToMinutes(endTime) > timeToMinutes(avail.endTime)
    )
      return false;

    const blocks = await this.blockRepo.find({
      where: { businessId, professionalId, date },
    });
    for (const b of blocks) {
      if (timesOverlap(startTime, endTime, b.startTime, b.endTime))
        return false;
    }
    return true;
  }

  /** Indica si ya existe una cita pendiente que se solape con el horario dado. */
  private async hasTimeConflict(
    businessId: string,
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const appointments = await this.apptRepo.find({
      where: {
        businessId,
        professionalId,
        date,
        status: AppointmentStatus.PENDING,
      },
    });
    return appointments.some((a) =>
      timesOverlap(startTime, endTime, a.startTime, a.endTime)
    );
  }
}
