import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
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
}
