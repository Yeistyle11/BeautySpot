import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { ProfessionalsService } from "./professionals.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  CreateProfessionalDto,
  UpdateProfessionalDto,
  AssignServiceDto,
} from "./dto/professional.dto";

/** Endpoints del equipo de profesionales: ficha, servicios que prestan y vínculo con usuarios. */
@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("professionals")
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  /** Da de alta un profesional en el negocio. */
  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateProfessionalDto
  ) {
    return this.service.create(businessId, dto);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  /** Lista los profesionales del negocio. */
  @Get()
  async findAll(@BusinessId() businessId: string) {
    return this.service.findByBusiness(businessId);
  }

  /** Obtiene un profesional por id. */
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Actualiza la ficha de un profesional. */
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateProfessionalDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  /** Asigna un servicio al profesional (con precio/duración propios opcionales). */
  @Post(":id/services")
  async assignService(
    @BusinessId() businessId: string,
    @Param("id") id: string,
    @Body() dto: AssignServiceDto
  ) {
    return this.service.assignService(
      id,
      dto.serviceId,
      businessId,
      dto.customPrice,
      dto.customDuration
    );
  }

  /** Lista los servicios que presta el profesional. */
  @Get(":id/services")
  async getServices(@BusinessId() businessId: string, @Param("id") id: string) {
    return this.service.getServices(id, businessId);
  }

  /** Desasigna un servicio del profesional. */
  @Delete(":id/services/:serviceId")
  async removeService(
    @BusinessId() businessId: string,
    @Param("id") id: string,
    @Param("serviceId") serviceId: string
  ) {
    await this.service.removeServiceAssignment(id, serviceId, businessId);
    return { message: "Servicio desasignado" };
  }

  /** Inactiva un profesional (baja lógica), si no tiene citas activas. */
  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.remove(id, businessId);
    return { message: "Profesional eliminado" };
  }

  // --- Vinculacion con cuenta de usuario ---

  /**
   * Vincula un profesional con una cuenta de usuario (auth-service).
   * Body: { userId: "uuid-del-usuario" }
   */
  @Patch(":id/link-user")
  async linkUser(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() body: { userId: string }
  ) {
    return this.service.linkUser(id, businessId, body.userId);
  }

  /**
   * Desvincula la cuenta de usuario de un profesional.
   */
  @Patch(":id/unlink-user")
  async unlinkUser(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.unlinkUser(id, businessId);
  }
}
