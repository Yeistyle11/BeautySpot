import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CatalogoTenantService } from "@beautyspot/nest-common";
import { ServiceCategoryEntity } from "../../entities/service-category.entity";

/** CRUD de las categorías de servicios de un negocio, con orden y activación. */
@Injectable()
export class ServiceCategoriesService extends CatalogoTenantService<ServiceCategoryEntity> {
  constructor(
    @InjectRepository(ServiceCategoryEntity)
    repo: Repository<ServiceCategoryEntity>
  ) {
    super(repo, {
      singular: "Categoría de servicio",
      conArticulo: "La categoría de servicio",
    });
  }
}
