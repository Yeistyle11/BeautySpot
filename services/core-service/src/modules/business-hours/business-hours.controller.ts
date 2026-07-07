import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Body,
  Query,
  Req,
} from "@nestjs/common";
import { BusinessHoursService } from "./business-hours.service";
import { Roles } from "@beautyspot/nest-common";
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
  async findAll(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.service.findByBusiness(req.businessId, branchId);
  }

  @Put()
  async batchUpsert(@Req() req: any, @Body() dto: BatchUpsertDto) {
    return this.service.batchUpsert(req.businessId, dto.hours);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: UpdateBusinessHoursDto
  ) {
    return this.service.updateOne(id, req.businessId, dto);
  }
}
