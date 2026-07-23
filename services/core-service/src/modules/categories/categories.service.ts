import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsWhere, Like } from "typeorm";
import { ProfessionalCategoryEntity } from "../../entities/category.entity";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import { paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(ProfessionalCategoryEntity)
    private readonly repo: Repository<ProfessionalCategoryEntity>
  ) {}

  async create(
    businessId: string,
    dto: CreateCategoryDto
  ): Promise<ProfessionalCategoryEntity> {
    // Verificar nombre unico dentro del negocio
    const existing = await this.repo.findOne({
      where: { name: dto.name, businessId, active: true },
    });
    if (existing) {
      throw new ConflictException(`La categoría "${dto.name}" ya existe`);
    }
    const category = this.repo.create({ ...dto, businessId });
    return this.repo.save(category);
  }

  async findByBusiness(
    businessId: string,
    activeOnly = true
  ): Promise<ProfessionalCategoryEntity[]> {
    const where: FindOptionsWhere<ProfessionalCategoryEntity> = { businessId };
    if (activeOnly) where.active = true;
    return this.repo.find({
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  async findPaginated(
    businessId: string,
    params: PaginateParams,
    activeOnly?: boolean,
    search?: string
  ): Promise<IPaginatedResponse<ProfessionalCategoryEntity>> {
    const where: FindOptionsWhere<ProfessionalCategoryEntity> = { businessId };
    if (activeOnly) where.active = true;
    if (search) where.name = Like(`%${search}%`);

    return paginate(this.repo, params, {
      where,
      order: { sortOrder: "ASC", name: "ASC" },
    });
  }

  async findById(
    id: string,
    businessId: string
  ): Promise<ProfessionalCategoryEntity> {
    const category = await this.repo.findOne({ where: { id, businessId } });
    if (!category) throw new NotFoundException("Categoría no encontrada");
    return category;
  }

  async update(
    id: string,
    businessId: string,
    dto: UpdateCategoryDto
  ): Promise<ProfessionalCategoryEntity> {
    const category = await this.findById(id, businessId);

    if (dto.name && dto.name !== category.name) {
      const existing = await this.repo.findOne({
        where: { name: dto.name, businessId, active: true },
      });
      if (existing) {
        throw new ConflictException(`La categoría "${dto.name}" ya existe`);
      }
    }

    await this.repo.update({ id, businessId }, dto as Record<string, unknown>);
    return this.findById(id, businessId);
  }

  async remove(id: string, businessId: string): Promise<void> {
    const category = await this.findById(id, businessId);

    // Soft delete: desactivar en lugar de eliminar
    await this.repo.update({ id: category.id, businessId }, { active: false });
  }

  async countProfessionals(id: string, businessId: string): Promise<number> {
    await this.findById(id, businessId);
    return this.repo.manager.count("professionals", {
      where: { categoryId: id, businessId } as FindOptionsWhere<unknown>,
    });
  }

  async toggleActive(
    id: string,
    businessId: string
  ): Promise<ProfessionalCategoryEntity> {
    const category = await this.findById(id, businessId);
    await this.repo.update(
      { id: category.id, businessId },
      { active: !category.active }
    );
    return this.findById(id, businessId);
  }

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
