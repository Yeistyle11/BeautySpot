import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TenantCrudService } from "@beautyspot/nest-common";
import { Repository } from "typeorm";
import { Service } from "../../entities/service.entity";
import { ServiceCategoriesService } from "../service-categories/service-categories.service";

/** CRUD del catálogo de servicios ofertados por un negocio. */
@Injectable()
export class ServicesService extends TenantCrudService<Service> {
  constructor(
    @InjectRepository(Service) repo: Repository<Service>,
    private readonly categories: ServiceCategoriesService
  ) {
    super(repo, "Servicio no encontrado");
  }

  /** Comprueba que la categoría pertenece al negocio antes de asociarla. */
  private async validarCategoria(
    categoryId: string | undefined,
    businessId: string
  ): Promise<void> {
    if (!categoryId) return;
    await this.categories.findById(categoryId, businessId);
  }

  /**
   * Crea un servicio en el catálogo del negocio.
   *
   * La descripción y la categoría son opcionales para quien da de alta, pero
   * sus columnas no admiten nulo: lo que no se rellena se guarda vacío.
   */
  async create(businessId: string, data: Partial<Service>): Promise<Service> {
    await this.validarCategoria(data.categoryId, businessId);
    const service = this.repo.create({
      ...data,
      description: data.description ?? "",
      category: data.category ?? "",
      businessId,
    });
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

  /** Actualiza los datos de un servicio, validando antes su categoría. */
  async update(
    id: string,
    businessId: string,
    data: Partial<Service>
  ): Promise<Service> {
    await this.validarCategoria(data.categoryId, businessId);
    return super.update(id, businessId, data);
  }

  /** Da de baja (baja lógica) un servicio del catálogo. */
  async softDelete(id: string, businessId: string): Promise<void> {
    await this.repo.update({ id, businessId }, { active: false });
  }
}
