import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateServiceDto } from "./dto/service.dto";

@Roles(Role.OWNER, Role.ADMIN)
@Controller("services")
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateServiceDto) {
    return this.service.create(req.businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get()
  async findAll(@Req() req: any, @Query("active") active?: string) {
    return this.service.findByBusiness(req.businessId, active === "true");
  }

  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Req() req: any, @Body() dto: Partial<CreateServiceDto>) {
    return this.service.update(id, req.businessId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    await this.service.softDelete(id, req.businessId);
    return { message: "Servicio desactivado" };
  }
}
