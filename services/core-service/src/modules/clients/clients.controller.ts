import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { ClientsService } from "./clients.service";
import {
  Roles,
  BusinessId,
  CurrentUser,
  SkipBusinessScope,
} from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import {
  ClientNamesDto,
  CreateClientDto,
  UpdateClientDto,
} from "./dto/client.dto";

/** Endpoints de gestión de clientes del negocio, con permisos por rol en cada operación. */
@Controller("clients")
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  /** Registra un cliente nuevo en el negocio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  async create(@BusinessId() businessId: string, @Body() dto: CreateClientDto) {
    return this.service.create(businessId, dto);
  }

  /**
   * Lista los clientes del negocio con busqueda y paginacion; quien solo
   * atiende ve su parte de la cartera y sin datos personales.
   */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @CurrentUser("role") role: Role,
    @CurrentUser("userId") userId: string,
    @Query() query: Record<string, unknown>,
    @Query("search") search?: string
  ) {
    const pagination = parsePaginationQuery(query, ["name", "createdAt"]);
    return role === Role.PROFESSIONAL
      ? this.service.findByBusinessParaProfesional(
          businessId,
          userId,
          search,
          pagination
        )
      : this.service.findByBusiness(businessId, search, pagination);
  }

  /**
   * Nombre de los clientes pedidos por id, para poner cara a una lista de
   * citas.
   */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get("names")
  async names(
    @BusinessId() businessId: string,
    @Query() query: ClientNamesDto
  ): Promise<{ id: string; name: string }[]> {
    return this.service.findNamesByIds(businessId, query.ids);
  }

  /** Ficha del cliente autenticado; `null` si aún no tiene ninguna. */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Get("me")
  async findMine(@CurrentUser("userId") userId: string) {
    return this.service.findMineConNivel(userId);
  }

  /**
   * Actualiza los datos personales del cliente autenticado; 404 si reservo
   * como invitado y no tiene ficha.
   */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Patch("me")
  async updateMine(
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdateClientDto
  ) {
    const actualizado = await this.service.updateMineByUser(userId, dto);
    if (!actualizado) {
      throw new NotFoundException("El usuario no tiene ficha de cliente");
    }
    return actualizado;
  }

  /**
   * Obtiene un cliente por id, con la ficha completa; solo para quien gestiona
   * el negocio.
   */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Actualiza los datos de un cliente. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateClientDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  /**
   * Ejerce el derecho de supresión sobre un cliente: vacía sus datos personales
   * y deja la ficha de baja, conservando el historial de citas y facturas.
   */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post(":id/anonymize")
  async anonymize(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.anonymize(id, businessId);
  }
}
