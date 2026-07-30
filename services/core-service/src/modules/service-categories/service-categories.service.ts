import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ServiceCategoryEntity } from "../../entities/service-category.entity";
import { CatalogoTenantService } from "../../common/catalogo-tenant.service";

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
