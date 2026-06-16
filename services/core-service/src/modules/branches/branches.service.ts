import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "../../entities/branch.entity";

@Injectable()
export class BranchesService {
  constructor(@InjectRepository(Branch) private readonly repo: Repository<Branch>) {}

  async create(businessId: string, data: Partial<Branch>): Promise<Branch> {
    const branch = this.repo.create({ ...data, businessId });
    return this.repo.save(branch);
  }

  async findByBusiness(businessId: string): Promise<Branch[]> {
    return this.repo.find({ where: { businessId, active: true }, order: { name: "ASC" } });
  }

  async findById(id: string, businessId: string): Promise<Branch> {
    const branch = await this.repo.findOne({ where: { id, businessId } });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");
    return branch;
  }

  async update(id: string, businessId: string, data: Partial<Branch>): Promise<Branch> {
    await this.repo.update({ id, businessId }, data as any);
    return this.findById(id, businessId);
  }

  async deactivate(id: string, businessId: string): Promise<void> {
    await this.repo.update({ id, businessId }, { active: false });
  }
}
