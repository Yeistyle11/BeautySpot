import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Service } from "../../entities/service.entity";

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly repo: Repository<Service>
  ) {}

  async create(businessId: string, data: Partial<Service>): Promise<Service> {
    const service = this.repo.create({ ...data, businessId });
    return this.repo.save(service);
  }

  async findByBusiness(
    businessId: string,
    activeOnly = false
  ): Promise<Service[]> {
    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.active = true;
    return this.repo.find({ where, order: { category: "ASC", name: "ASC" } });
  }

  async findById(id: string, businessId: string): Promise<Service> {
    const service = await this.repo.findOne({ where: { id, businessId } });
    if (!service) throw new NotFoundException("Servicio no encontrado");
    return service;
  }

  async update(
    id: string,
    businessId: string,
    data: Partial<Service>
  ): Promise<Service> {
    await this.repo.update({ id, businessId }, data as any);
    return this.findById(id, businessId);
  }

  async softDelete(id: string, businessId: string): Promise<void> {
    await this.repo.update({ id, businessId }, { active: false });
  }
}
