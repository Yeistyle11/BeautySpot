import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { ReplaceAvailabilityDto } from "./dto/availability.dto";

@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
@Controller("professionals/:professionalId/availability")
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get()
  async get(@Param("professionalId") professionalId: string, @BusinessId() businessId: string) {
    return this.service.findByProfessional(businessId, professionalId);
  }

  @Post()
  async replace(@Param("professionalId") professionalId: string, @BusinessId() businessId: string, @Body() dto: ReplaceAvailabilityDto) {
    return this.service.replaceWeekly(businessId, professionalId, dto.slots);
  }
}
