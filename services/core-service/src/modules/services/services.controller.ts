import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ServicesService } from "./services.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateServiceDto, UpdateServiceDto } from "./dto/service.dto";

@Roles(Role.OWNER, Role.ADMIN)
@Controller("services")
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateServiceDto
  ) {
    return this.service.create(businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @Query("active") active?: string
  ) {
    return this.service.findByBusiness(businessId, active === "true");
  }

  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateServiceDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.softDelete(id, businessId);
    return { message: "Servicio desactivado" };
  }
}
