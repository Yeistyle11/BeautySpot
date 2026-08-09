import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository, MoreThanOrEqual } from "typeorm";
import {
  esFechaPasadaEn,
  esHoraValida,
  fechaDeHoyEn,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { Appointment } from "../../entities/appointment.entity";

/** Estados de cita que impiden bloquear la franja por encima. */
const ESTADOS_VIVOS = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

/** Gestiona los bloqueos puntuales de agenda de un profesional (vacaciones, descansos). */
@Injectable()
export class BlockedSlotsService {
  constructor(
    @InjectRepository(BlockedSlot)
    private readonly repo: Repository<BlockedSlot>,
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    private readonly zonas: ZonaDelNegocioService
  ) {}

  /** Lista los bloqueos de un profesional (por defecto solo los futuros). */
  async findByProfessional(
    businessId: string,
    professionalId: string,
    futureOnly = true
  ): Promise<BlockedSlot[]> {
    const where: Record<string, unknown> = { businessId, professionalId };
    if (futureOnly) {
      const zona = await this.zonas.de(businessId);
      where.date = MoreThanOrEqual(fechaDeHoyEn(zona));
    }
    return this.repo.find({ where, order: { date: "ASC", startTime: "ASC" } });
  }

  /** Crea un bloqueo de agenda para el profesional. */
  async create(
    businessId: string,
    professionalId: string,
    data: { date: string; startTime: string; endTime: string; reason?: string }
  ): Promise<BlockedSlot> {
    await this.validar(businessId, professionalId, data);

    const slot = this.repo.create({ ...data, businessId, professionalId });
    return this.repo.save(slot);
  }

  /** Elimina un bloqueo del negocio; lanza 404 si no existe. */
  async remove(id: string, businessId: string): Promise<void> {
    const result = await this.repo.delete({ id, businessId });
    if (!result.affected) throw new NotFoundException("Bloqueo no encontrado");
  }

  /**
   * Comprueba el formato y el orden de las horas, que la fecha no haya pasado y
   * que la franja no tenga citas vivas encima.
   */
  private async validar(
    businessId: string,
    professionalId: string,
    data: { date: string; startTime: string; endTime: string }
  ): Promise<void> {
    if (!esHoraValida(data.startTime) || !esHoraValida(data.endTime)) {
      throw new BadRequestException(
        `Horario invalido: ${data.startTime}-${data.endTime}. Se espera HH:MM`
      );
    }
    if (timeToMinutes(data.startTime) >= timeToMinutes(data.endTime)) {
      throw new BadRequestException("El bloqueo termina antes de empezar");
    }

    const zona = await this.zonas.de(businessId);
    if (esFechaPasadaEn(zona, data.date)) {
      throw new BadRequestException("No se puede bloquear un dia que ya paso");
    }

    const citas = await this.apptRepo.find({
      where: {
        businessId,
        professionalId,
        date: data.date,
        status: In(ESTADOS_VIVOS),
      },
    });
    // Contra la envolvente de la cita, limpieza incluida.
    const choca = citas.filter((c) =>
      timesOverlap(
        data.startTime,
        data.endTime,
        c.startTime,
        c.ocupadoHasta ?? c.endTime
      )
    );
    if (choca.length > 0) {
      throw new BadRequestException(
        `Hay ${choca.length} cita(s) en esa franja. Cancelalas o reasignalas antes de bloquearla.`
      );
    }
  }
}
