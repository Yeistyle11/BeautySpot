import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { ReplaceAvailabilityDto } from "./dto/availability.dto";

/** Endpoints de la disponibilidad semanal de un profesional. */
@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
@Controller("professionals/:professionalId/availability")
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Get()
  async get(
    @Param("professionalId", ParseUUIDPipe) professionalId: string,
    @BusinessId() businessId: string
  ) {
    return this.service.findByProfessional(businessId, professionalId);
  }

  /**
   * Reemplaza por completo la disponibilidad semanal del profesional. Fuera del
   * alcance de PROFESSIONAL: la ruta lo lleva en la URL y el token no permite
   * comprobar que sea el suyo.
   */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  async replace(
    @Param("professionalId", ParseUUIDPipe) professionalId: string,
    @BusinessId() businessId: string,
    @Body() dto: ReplaceAvailabilityDto
  ) {
    return this.service.replaceWeekly(businessId, professionalId, dto.slots);
  }
}
