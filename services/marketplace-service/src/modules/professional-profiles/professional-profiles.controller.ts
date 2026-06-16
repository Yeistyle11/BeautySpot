import { Controller, Get, Post, Put, Param, Body, Req } from "@nestjs/common";
import { ProfessionalProfilesService } from "./professional-profiles.service";
import { SyncProfessionalDto, UpdateProfessionalProfileDto, ToggleProfessionalVisibilityDto } from "./dto/professional-profile.dto";
import { Roles, Public } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("professional-profiles")
export class ProfessionalProfilesController {
  constructor(private readonly service: ProfessionalProfilesService) {}

  @Post("sync")
  @Public()
  async syncFromCore(@Body() dto: SyncProfessionalDto) {
    return this.service.syncFromCore(dto);
  }

  @Post("deactivate")
  @Public()
  async deactivateFromCore(@Body() dto: { professionalId: string }) {
    return this.service.deactivateFromCore(dto.professionalId);
  }

  @Put(":professionalId")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateProfile(
    @Param("professionalId") professionalId: string,
    @Body() dto: UpdateProfessionalProfileDto,
    @Req() req: any,
  ) {
    return this.service.updateProfile(professionalId, req.businessId, dto);
  }

  @Put(":professionalId/visibility")
  @Roles(Role.OWNER, Role.ADMIN)
  async toggleVisibility(
    @Param("professionalId") professionalId: string,
    @Body() dto: ToggleProfessionalVisibilityDto,
    @Req() req: any,
  ) {
    return this.service.toggleVisibility(professionalId, req.businessId, dto.visibleOnProfile);
  }

  @Get("business/:businessId")
  @Public()
  async findByBusiness(@Param("businessId") businessId: string) {
    return this.service.findByBusiness(businessId);
  }

  @Get(":id")
  @Public()
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }
}
