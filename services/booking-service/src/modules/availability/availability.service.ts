import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Availability } from "../../entities/availability.entity";

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Availability)
    private readonly repo: Repository<Availability>
  ) {}

  async findByProfessional(
    businessId: string,
    professionalId: string
  ): Promise<Availability[]> {
    return this.repo.find({
      where: { businessId, professionalId, active: true },
      order: { dayOfWeek: "ASC" },
    });
  }

  /** Reemplaza toda la disponibilidad semanal del profesional */
  async replaceWeekly(
    businessId: string,
    professionalId: string,
    slots: { dayOfWeek: number; startTime: string; endTime: string }[]
  ): Promise<Availability[]> {
    await this.repo.delete({ businessId, professionalId });
    const entities = slots.map((s) =>
      this.repo.create({ ...s, businessId, professionalId })
    );
    return this.repo.save(entities);
  }
}
