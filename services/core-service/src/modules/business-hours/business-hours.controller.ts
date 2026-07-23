import { Controller, Get, Put, Patch, Param, Body, Query } from "@nestjs/common";
import { BusinessHoursService } from "./business-hours.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  BatchUpsertDto,
  UpdateBusinessHoursDto,
} from "./dto/business-hours.dto";

@Roles(Role.OWNER, Role.ADMIN)
@Controller("business-hours")
export class BusinessHoursController {
  constructor(private readonly service: BusinessHoursService) {}

  @Get()
  async findAll(@BusinessId() businessId: string, @Query("branchId") branchId?: string) {
    return this.service.findByBusiness(businessId, branchId);
  }

  @Put()
  async batchUpsert(@BusinessId() businessId: string, @Body() dto: BatchUpsertDto) {
    return this.service.batchUpsert(businessId, dto.hours);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateBusinessHoursDto
  ) {
    return this.service.updateOne(id, businessId, dto);
  }
}
