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
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";
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
  async findAll(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Query() query: Record<string, unknown>
  ) {
    return this.service.findAll(query, businessId, role);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get("slug/:slug")
  async findBySlug(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("slug") slug: string
  ) {
    return this.service.findBySlug(slug, businessId, role);
  }

  @Get(":id")
  async findById(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("id") id: string
  ) {
    return this.service.findById(id, businessId, role);
  }

  @Patch(":id")
  async update(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessDto
  ) {
    return this.service.update(id, dto, businessId, role);
  }

  @Delete(":id")
  async deactivate(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("id") id: string
  ) {
    await this.service.deactivate(id, businessId, role);
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
