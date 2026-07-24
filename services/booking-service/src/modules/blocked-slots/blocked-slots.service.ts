import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { BlockedSlot } from "../../entities/blocked-slot.entity";

/** Gestiona los bloqueos puntuales de agenda de un profesional (vacaciones, descansos). */
@Injectable()
export class BlockedSlotsService {
  constructor(
    @InjectRepository(BlockedSlot)
    private readonly repo: Repository<BlockedSlot>
  ) {}

  /** Lista los bloqueos de un profesional (por defecto solo los futuros). */
  async findByProfessional(
    businessId: string,
    professionalId: string,
    futureOnly = true
  ): Promise<BlockedSlot[]> {
    const where: Record<string, unknown> = { businessId, professionalId };
    if (futureOnly)
      where.date = MoreThanOrEqual(new Date().toISOString().split("T")[0]);
    return this.repo.find({ where, order: { date: "ASC", startTime: "ASC" } });
  }

  /** Crea un bloqueo de agenda para el profesional. */
  async create(
    businessId: string,
    professionalId: string,
    data: { date: string; startTime: string; endTime: string; reason?: string }
  ): Promise<BlockedSlot> {
    const slot = this.repo.create({ ...data, businessId, professionalId });
    return this.repo.save(slot);
  }

  /** Elimina un bloqueo del negocio; lanza 404 si no existe. */
  async remove(id: string, businessId: string): Promise<void> {
    const result = await this.repo.delete({ id, businessId });
    if (!result.affected) throw new NotFoundException("Bloqueo no encontrado");
  }
}
