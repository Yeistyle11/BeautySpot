import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto";

/** Endpoints CRUD de sedes del negocio para dueños y administradores. */
@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("branches")
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  /** Crea una sede en el negocio actual. */
  @Post()
  async create(@BusinessId() businessId: string, @Body() dto: CreateBranchDto) {
    return this.service.create(businessId, dto);
  }

  /** Lista las sedes del negocio actual. */
  @Get()
  async findAll(@BusinessId() businessId: string) {
    return this.service.findByBusiness(businessId);
  }

  /** Obtiene una sede por id. */
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Actualiza una sede. */
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateBranchDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  /** Da de baja una sede. */
  @Delete(":id")
  async deactivate(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.deactivate(id, businessId);
    return { message: "Sucursal desactivada" };
  }
}
