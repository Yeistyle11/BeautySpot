import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsWhere, Like } from "typeorm";
import { ServiceCategoryEntity } from "../../entities/service-category.entity";
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from "./dto/service-category.dto";
import { paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";

/** CRUD de las categorías de servicios de un negocio, con orden y activación. */
@Injectable()
export class ServiceCategoriesService {
  constructor(
    @InjectRepository(ServiceCategoryEntity)
    private readonly repo: Repository<ServiceCategoryEntity>
  ) {}

  /** Crea una categoría de servicio rechazando nombres duplicados en el negocio. */
  async create(
    businessId: string,
    dto: CreateServiceCategoryDto
  ): Promise<ServiceCategoryEntity> {
    const existing = await this.repo.findOne({
      where: { name: dto.name, businessId, active: true },
    });
    if (existing) {
      throw new ConflictException(
        `La categoría de servicio "${dto.name}" ya existe`
      );
    }
    const category = this.repo.create({ ...dto, businessId });
    return this.repo.save(category);
  }

  /** Lista las categorías de servicio del negocio (por defecto solo activas), ordenadas. */
  async findByBusiness(
    businessId: string,
    activeOnly = true
  ): Promise<ServiceCategoryEntity[]> {
    const where: FindOptionsWhere<ServiceCategoryEntity> = { businessId };
    if (activeOnly) where.active = true;
    return this.repo.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  /** Lista las categorías de servicio con paginación y búsqueda por nombre. */
  async findPaginated(
    businessId: string,
    params: PaginateParams,
    activeOnly?: boolean,
    search?: string
  ): Promise<IPaginatedResponse<ServiceCategoryEntity>> {
    const where: FindOptionsWhere<ServiceCategoryEntity> = { businessId };
    if (activeOnly) where.active = true;
    if (search) where.name = Like(`%${search}%`);

    return paginate(this.repo, params, {
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  /** Obtiene una categoría de servicio por id; lanza 404 si no existe. */
  async findById(
    id: string,
    businessId: string
  ): Promise<ServiceCategoryEntity> {
    const category = await this.repo.findOne({ where: { id, businessId } });
    if (!category)
      throw new NotFoundException("Categoría de servicio no encontrada");
    return category;
  }

  /** Actualiza una categoría de servicio rechazando un nombre que ya use otra. */
  async update(
    id: string,
    businessId: string,
    dto: UpdateServiceCategoryDto
  ): Promise<ServiceCategoryEntity> {
    const category = await this.findById(id, businessId);

    if (dto.name && dto.name !== category.name) {
      const existing = await this.repo.findOne({
        where: { name: dto.name, businessId, active: true },
      });
      if (existing) {
        throw new ConflictException(
          `La categoría de servicio "${dto.name}" ya existe`
        );
      }
    }

    await this.repo.update({ id, businessId }, dto as Record<string, unknown>);
    return this.findById(id, businessId);
  }

  /** Da de baja (baja lógica) una categoría de servicio. */
  async remove(id: string, businessId: string): Promise<void> {
    await this.findById(id, businessId);
    await this.repo.update({ id, businessId }, { active: false });
  }

  /** Alterna el estado activo/inactivo de una categoría de servicio. */
  async toggleActive(
    id: string,
    businessId: string
  ): Promise<ServiceCategoryEntity> {
    const category = await this.findById(id, businessId);
    await this.repo.update(
      { id: category.id, businessId },
      { active: !category.active }
    );
    return this.findById(id, businessId);
  }

  /** Reordena las categorías de servicio aplicando el nuevo sortOrder de cada una. */
  async reorder(
    businessId: string,
    items: { id: string; sortOrder: number }[]
  ): Promise<void> {
    for (const item of items) {
      await this.findById(item.id, businessId);
      await this.repo.update(
        { id: item.id, businessId },
        { sortOrder: item.sortOrder }
      );
    }
  }
}
