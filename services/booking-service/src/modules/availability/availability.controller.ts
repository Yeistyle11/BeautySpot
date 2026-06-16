import { Controller, Get, Post, Param, Body, Req } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { ReplaceAvailabilityDto } from "./dto/availability.dto";

@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
@Controller("professionals/:professionalId/availability")
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get()
  async get(@Param("professionalId") professionalId: string, @Req() req: any) {
    return this.service.findByProfessional(req.businessId, professionalId);
  }

  @Post()
  async replace(@Param("professionalId") professionalId: string, @Req() req: any, @Body() dto: ReplaceAvailabilityDto) {
    return this.service.replaceWeekly(req.businessId, professionalId, dto.slots);
  }
}
