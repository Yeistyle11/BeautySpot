import { Controller, Get, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "../../entities/branch.entity";

/** Sede tal como la ven los demás servicios. */
export interface SedeResumida {
  id: string;
  name: string;
}

/**
 * Endpoint interno (servicio-a-servicio) para que booking y payment comprueben
 * que la sede que reciben es del negocio de la petición.
 */
@Controller("internal/branches")
export class InternalBranchesController {
  constructor(
    @InjectRepository(Branch) private readonly repo: Repository<Branch>
  ) {}

  /** Sedes activas del negocio. */
  @Get()
  async list(@Query("businessId") businessId: string): Promise<SedeResumida[]> {
    const sedes = await this.repo.find({
      where: { businessId, active: true },
      order: { name: "ASC" },
    });

    return sedes.map((s) => ({ id: s.id, name: s.name }));
  }
}
