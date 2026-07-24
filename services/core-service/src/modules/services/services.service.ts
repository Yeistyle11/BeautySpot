import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Service } from "../../entities/service.entity";

/** CRUD del catálogo de servicios ofertados por un negocio. */
@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service) private readonly repo: Repository<Service>
  ) {}

  /** Crea un servicio en el catálogo del negocio. */
  async create(businessId: string, data: Partial<Service>): Promise<Service> {
    const service = this.repo.create({ ...data, businessId });
    return this.repo.save(service);
  }

  /** Lista los servicios del negocio (opcionalmente solo los activos), agrupados por categoría. */
  async findByBusiness(
    businessId: string,
    activeOnly = false
  ): Promise<Service[]> {
    const where: Record<string, unknown> = { businessId };
    if (activeOnly) where.active = true;
    return this.repo.find({ where, order: { category: "ASC", name: "ASC" } });
  }

  /** Obtiene un servicio del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<Service> {
    const service = await this.repo.findOne({ where: { id, businessId } });
    if (!service) throw new NotFoundException("Servicio no encontrado");
    return service;
  }

  /** Actualiza los datos de un servicio del negocio. */
  async update(
    id: string,
    businessId: string,
    data: Partial<Service>
  ): Promise<Service> {
    await this.repo.update({ id, businessId }, data as any);
    return this.findById(id, businessId);
  }

  /** Da de baja (baja lógica) un servicio del catálogo. */
  async softDelete(id: string, businessId: string): Promise<void> {
    await this.repo.update({ id, businessId }, { active: false });
  }
}
