import { Internal } from "@beautyspot/nest-common";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "../../entities/branch.entity";
import { Professional } from "../../entities/professional.entity";

/** Sede tal como la ven los demás servicios. */
export interface SedeResumida {
  id: string;
  name: string;
}

/**
 * Endpoint interno (servicio-a-servicio) para que booking y payment comprueben
 * que la sede que reciben es del negocio de la petición.
 */
@Internal()
@Controller("internal/branches")
export class InternalBranchesController {
  constructor(
    @InjectRepository(Branch) private readonly repo: Repository<Branch>,
    @InjectRepository(Professional)
    private readonly proRepo: Repository<Professional>
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

  /**
   * Quién atiende en una sede. Booking lo necesita para elegir profesional
   * cuando el cliente reserva «con cualquiera»: sin acotar, le asignaría a
   * alguien del otro local y la cita nacería en la sede equivocada.
   */
  @Get(":id/professionals")
  async professionals(
    @Param("id") branchId: string
  ): Promise<{ id: string }[]> {
    const equipo = await this.proRepo.find({
      where: { branchId, active: true },
      select: ["id"],
    });

    return equipo.map((p) => ({ id: p.id }));
  }
}
