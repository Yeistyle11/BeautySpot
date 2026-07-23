import { Controller, Get, Post, Patch, Param, Body, Query } from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";

@Controller("clients")
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  async create(@BusinessId() businessId: string, @Body() dto: CreateClientDto) {
    return this.service.create(businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(@BusinessId() businessId: string, @Query("search") search?: string) {
    return this.service.findByBusiness(businessId, search);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateClientDto
  ) {
    return this.service.update(id, businessId, dto);
  }
}
