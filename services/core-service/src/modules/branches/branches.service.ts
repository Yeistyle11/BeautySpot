import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TenantCrudService } from "@beautyspot/nest-common";
import { Repository } from "typeorm";
import { Branch } from "../../entities/branch.entity";

/** CRUD de sedes (sucursales) de un negocio, siempre acotado a su businessId. */
@Injectable()
export class BranchesService extends TenantCrudService<Branch> {
  constructor(@InjectRepository(Branch) repo: Repository<Branch>) {
    super(repo, "Sucursal no encontrada");
  }

  /** Crea una sede dentro del negocio indicado. */
  async create(businessId: string, data: Partial<Branch>): Promise<Branch> {
    const branch = this.repo.create({ ...data, businessId });
    return this.repo.save(branch);
  }

  /** Lista las sedes activas de un negocio, ordenadas por nombre. */
  async findByBusiness(businessId: string): Promise<Branch[]> {
    return this.repo.find({
      where: { businessId, active: true },
      order: { name: "ASC" },
    });
  }
}
