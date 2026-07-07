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
import { BusinessesService } from "./businesses.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateBusinessDto, UpdateBusinessDto } from "./dto/business.dto";

@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Post()
  async create(@Body() dto: CreateBusinessDto) {
    return this.service.create(dto);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get()
  async findAll(@Query() query: Record<string, unknown>) {
    return this.service.findAll(query);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get("slug/:slug")
  async findBySlug(@Param("slug") slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(":id")
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateBusinessDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  async deactivate(@Param("id") id: string) {
    await this.service.deactivate(id);
    return { message: "Negocio desactivado" };
  }
}

/** Internal endpoint — protegido por InternalSecretGuard (requiere header x-internal-secret) */
@Controller("internal/businesses")
export class InternalBusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Get("resolve")
  async resolveBySlug(@Query("slug") slug: string) {
    return this.service.findBySlug(slug);
  }

  @Post()
  async create(@Body() dto: CreateBusinessDto) {
    return this.service.create(dto);
  }
}
