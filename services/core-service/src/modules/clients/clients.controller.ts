import { Controller, Get, Post, Patch, Param, Body, Query, Req } from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateClientDto } from "./dto/client.dto";

@Controller("clients")
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateClientDto) {
    return this.service.create(req.businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(@Req() req: any, @Query("search") search?: string) {
    return this.service.findByBusiness(req.businessId, search);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Patch(":id")
  async update(@Param("id") id: string, @Req() req: any, @Body() dto: Partial<CreateClientDto>) {
    return this.service.update(id, req.businessId, dto);
  }
}
