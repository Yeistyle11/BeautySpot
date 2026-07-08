import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
} from "@nestjs/common";
import { ProfessionalsService } from "./professionals.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  CreateProfessionalDto,
  UpdateProfessionalDto,
  AssignServiceDto,
} from "./dto/professional.dto";

@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("professionals")
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateProfessionalDto) {
    return this.service.create(req.businessId, dto);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get()
  async findAll(@Req() req: any) {
    return this.service.findByBusiness(req.businessId);
  }

  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: UpdateProfessionalDto
  ) {
    return this.service.update(id, req.businessId, dto);
  }

  @Post(":id/services")
  async assignService(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: AssignServiceDto
  ) {
    return this.service.assignService(
      id,
      dto.serviceId,
      req.businessId,
      dto.customPrice,
      dto.customDuration
    );
  }

  @Get(":id/services")
  async getServices(@Req() req: any, @Param("id") id: string) {
    return this.service.getServices(id, req.businessId);
  }

  @Delete(":id/services/:serviceId")
  async removeService(
    @Req() req: any,
    @Param("id") id: string,
    @Param("serviceId") serviceId: string
  ) {
    await this.service.removeServiceAssignment(id, serviceId, req.businessId);
    return { message: "Servicio desasignado" };
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    await this.service.remove(id, req.businessId);
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
    @Req() req: any,
    @Body() body: { userId: string }
  ) {
    return this.service.linkUser(id, req.businessId, body.userId);
  }

  /**
   * Desvincula la cuenta de usuario de un profesional.
   */
  @Patch(":id/unlink-user")
  async unlinkUser(@Param("id") id: string, @Req() req: any) {
    return this.service.unlinkUser(id, req.businessId);
  }
}
