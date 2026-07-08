import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
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
  async findAll(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.service.findAll(query, req.businessId, req.user?.role);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get("slug/:slug")
  async findBySlug(@Req() req: any, @Param("slug") slug: string) {
    return this.service.findBySlug(slug, req.businessId, req.user?.role);
  }

  @Get(":id")
  async findById(@Req() req: any, @Param("id") id: string) {
    return this.service.findById(id, req.businessId, req.user?.role);
  }

  @Patch(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessDto
  ) {
    return this.service.update(id, dto, req.businessId, req.user?.role);
  }

  @Delete(":id")
  async deactivate(@Req() req: any, @Param("id") id: string) {
    await this.service.deactivate(id, req.businessId, req.user?.role);
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
