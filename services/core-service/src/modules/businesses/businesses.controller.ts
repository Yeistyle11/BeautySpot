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
import {
  Roles,
  BusinessId,
  CurrentUser,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  CreateBusinessDto,
  ResolveBusinessNamesDto,
  UpdateBusinessDto,
} from "./dto/business.dto";

/** Endpoints CRUD de negocios para dueños y administradores. */
@Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  /**
   * Alta del negocio propio. Es la puerta de entrada al producto: quien acaba
   * de registrarse todavía es CLIENT y no pertenece a ningún negocio, así que
   * ni se le puede exigir el tenant ni un rol de gestión.
   */
  @Post()
  @Roles(Role.CLIENT, Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @SkipBusinessScope()
  async create(
    @Body() dto: CreateBusinessDto,
    @CurrentUser("userId") userId: string
  ) {
    return this.service.createWithOwner(dto, userId);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  /** Lista negocios visibles para el llamante, con filtros y paginación. */
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
  /** Obtiene un negocio por su slug. */
  @Get("slug/:slug")
  async findBySlug(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("slug") slug: string
  ) {
    return this.service.findBySlug(slug, businessId, role);
  }

  /** Obtiene un negocio por su id. */
  @Get(":id")
  async findById(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("id") id: string
  ) {
    return this.service.findById(id, businessId, role);
  }

  /** Actualiza los datos de un negocio. */
  @Patch(":id")
  async update(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessDto
  ) {
    return this.service.update(id, dto, businessId, role);
  }

  /** Da de baja un negocio. */
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

  /** Resuelve el negocio a partir de su slug (lo usa el gateway para el tenant). */
  @Get("resolve")
  async resolveBySlug(@Query("slug") slug: string) {
    return this.service.findBySlug(slug);
  }

  /** Nombre de cada negocio pedido, para etiquetar listas de otros servicios. */
  @Post("names")
  async names(@Body() dto: ResolveBusinessNamesDto) {
    return this.service.namesByIds(dto.ids);
  }

  /** Crea un negocio a petición de otro microservicio (p. ej. al registrarse). */
  @Post()
  async create(@Body() dto: CreateBusinessDto) {
    return this.service.create(dto);
  }
}
