import { Controller, Get, Post, Put, Param, Body } from "@nestjs/common";
import { ProfessionalProfilesService } from "./professional-profiles.service";
import {
  SyncProfessionalDto,
  UpdateProfessionalProfileDto,
  ToggleProfessionalVisibilityDto,
} from "./dto/professional-profile.dto";
import { Roles, Public, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints con los que el negocio edita el perfil público de sus profesionales. */
@Controller("professional-profiles")
export class ProfessionalProfilesController {
  constructor(private readonly service: ProfessionalProfilesService) {}

  /** Actualiza el perfil público de un profesional. */
  @Put(":professionalId")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateProfile(
    @Param("professionalId") professionalId: string,
    @Body() dto: UpdateProfessionalProfileDto,
    @BusinessId() businessId: string
  ) {
    return this.service.updateProfile(professionalId, businessId, dto);
  }

  /** Muestra u oculta al profesional en el perfil público del negocio. */
  @Put(":professionalId/visibility")
  @Roles(Role.OWNER, Role.ADMIN)
  async toggleVisibility(
    @Param("professionalId") professionalId: string,
    @Body() dto: ToggleProfessionalVisibilityDto,
    @BusinessId() businessId: string
  ) {
    return this.service.toggleVisibility(
      professionalId,
      businessId,
      dto.visibleOnProfile
    );
  }
}

/** Endpoints internos con los que el core sincroniza los perfiles de profesionales. */
@Controller("internal/professional-profiles")
@Public()
export class InternalProfessionalProfilesController {
  constructor(private readonly service: ProfessionalProfilesService) {}

  /** Crea o actualiza el perfil de un profesional con los datos del core. */
  @Post("sync")
  async syncFromCore(@Body() dto: SyncProfessionalDto) {
    return this.service.syncFromCore(dto);
  }

  /** Desactiva el perfil de un profesional dado de baja en el core. */
  @Post("deactivate")
  async deactivateFromCore(@Body() dto: { professionalId: string }) {
    return this.service.deactivateFromCore(dto.professionalId);
  }

  /** Lista los profesionales de un negocio (uso interno). */
  @Get("business/:businessId")
  async findByBusiness(@Param("businessId") businessId: string) {
    return this.service.findByBusiness(businessId);
  }

  /** Obtiene un perfil de profesional por id (uso interno). */
  @Get(":id")
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }
}
