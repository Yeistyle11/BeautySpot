import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { BusinessHoursService } from "./business-hours.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  BatchUpsertDto,
  UpdateBusinessHoursDto,
} from "./dto/business-hours.dto";

/** Endpoints del horario de apertura del negocio para dueños y administradores. */
@Roles(Role.OWNER, Role.ADMIN)
@Controller("business-hours")
export class BusinessHoursController {
  constructor(private readonly service: BusinessHoursService) {}

  /** Devuelve el horario del negocio (o de una sede concreta). */
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @Query("branchId") branchId?: string
  ) {
    return this.service.findByBusiness(businessId, branchId);
  }

  /** Reemplaza el horario completo del negocio. */
  @Put()
  async batchUpsert(
    @BusinessId() businessId: string,
    @Body() dto: BatchUpsertDto
  ) {
    return this.service.batchUpsert(businessId, dto.hours);
  }

  /** Actualiza un tramo horario concreto. */
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateBusinessHoursDto
  ) {
    return this.service.updateOne(id, businessId, dto);
  }
}
