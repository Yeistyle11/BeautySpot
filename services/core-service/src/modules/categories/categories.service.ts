import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { ProfessionalCategoryEntity } from "../../entities/category.entity";
import { CatalogoTenantService } from "../../common/catalogo-tenant.service";

/** CRUD de las categorías de profesionales de un negocio, con orden y activación. */
@Injectable()
export class CategoriesService extends CatalogoTenantService<ProfessionalCategoryEntity> {
  constructor(
    @InjectRepository(ProfessionalCategoryEntity)
    repo: Repository<ProfessionalCategoryEntity>
  ) {
    super(repo, { singular: "Categoría", conArticulo: "La categoría" });
  }

  /** Cuenta cuántos profesionales están asignados a la categoría. */
  async countProfessionals(id: string, businessId: string): Promise<number> {
    await this.findById(id, businessId);
    return this.repo.manager.count("professionals", {
      where: { categoryId: id, businessId } as FindOptionsWhere<unknown>,
    });
  }
}
