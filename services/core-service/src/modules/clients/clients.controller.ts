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
import { CreateClientDto, UpdateClientDto } from "./dto/client.dto";

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

  /** Lista los clientes del negocio con búsqueda y paginación. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @Query() query: Record<string, unknown>,
    @Query("search") search?: string
  ) {
    const pagination = parsePaginationQuery(query, ["name", "createdAt"]);
    return this.service.findByBusiness(businessId, search, pagination);
  }

  /** Ficha del cliente autenticado; `null` si aún no tiene ninguna. */
  @Roles(Role.CLIENT)
  @SkipBusinessScope()
  @Get("me")
  async findMine(@CurrentUser("userId") userId: string) {
    return this.service.findMineConNivel(userId);
  }

  /**
   * Actualiza los datos personales del cliente autenticado. Devuelve 404 si
   * reservó como invitado y no tiene ficha, para que el llamador recurra a su
   * usuario de auth-service.
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

  /** Obtiene un cliente por id. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
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
