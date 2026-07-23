import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessHours } from "../../entities/business-hours.entity";

@Injectable()
export class BusinessHoursService {
  constructor(
    @InjectRepository(BusinessHours)
    private readonly repo: Repository<BusinessHours>
  ) {}

  async findByBusiness(
    businessId: string,
    branchId?: string
  ): Promise<BusinessHours[]> {
    const where: Record<string, unknown> = { businessId };
    if (branchId) where.branchId = branchId;
    return this.repo.find({
      where,
      order: { dayOfWeek: "ASC", openTime: "ASC" },
    });
  }

  async batchUpsert(
    businessId: string,
    items: Partial<BusinessHours>[]
  ): Promise<BusinessHours[]> {
    const existing = await this.repo.find({ where: { businessId } });
    if (existing.length > 0) {
      await this.repo.remove(existing);
    }

    const hours = items.map((item) =>
      this.repo.create({
        businessId,
        branchId: item.branchId || undefined,
        dayOfWeek: item.dayOfWeek!,
        openTime: item.openTime!,
        closeTime: item.closeTime!,
        active: item.active !== undefined ? item.active : true,
      })
    );

    return this.repo.save(hours);
  }

  async updateOne(
    id: string,
    businessId: string,
    data: Partial<BusinessHours>
  ): Promise<BusinessHours> {
    await this.repo.update({ id, businessId }, data as any);
    const hour = await this.repo.findOne({ where: { id, businessId } });
    if (!hour) throw new Error("Horario no encontrado");
    return hour;
  }
}
