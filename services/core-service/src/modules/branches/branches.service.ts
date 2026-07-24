import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "../../entities/branch.entity";

/** CRUD de sedes (sucursales) de un negocio, siempre acotado a su businessId. */
@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly repo: Repository<Branch>
  ) {}

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

  /** Obtiene una sede del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<Branch> {
    const branch = await this.repo.findOne({ where: { id, businessId } });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    return branch;
  }

  /** Actualiza los datos de una sede del negocio. */
  async update(
    id: string,
    businessId: string,
    data: Partial<Branch>
  ): Promise<Branch> {
    await this.repo.update(
      { id, businessId },
      data as Parameters<typeof this.repo.update>[1]
    );
    return this.findById(id, businessId);
  }

  /** Da de baja (baja lógica) una sede del negocio. */
  async deactivate(id: string, businessId: string): Promise<void> {
    await this.repo.update({ id, businessId }, { active: false });
  }
}
