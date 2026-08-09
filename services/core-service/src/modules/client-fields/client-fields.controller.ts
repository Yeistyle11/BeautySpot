import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ClientFieldsService } from "./client-fields.service";
import {
  CreateClientFieldDto,
  UpdateClientFieldDto,
} from "./dto/client-field.dto";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/**
 * Campos que el negocio añade a la ficha de sus clientes. Definirlos es cosa de
 * quien manda; leerlos, de todo el que atiende, que es quien los rellena.
 */
@Controller("client-fields")
export class ClientFieldsController {
  constructor(private readonly service: ClientFieldsService) {}

  /** Define un campo nuevo. */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateClientFieldDto
  ) {
    return this.service.create(businessId, dto);
  }

  /** Lista los campos del negocio; con `?activos=false` incluye los dados de baja. */
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST, Role.PROFESSIONAL)
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @Query("activos") activos?: string
  ) {
    return this.service.findByBusiness(businessId, activos !== "false");
  }

  /** Actualiza un campo. */
  @Roles(Role.OWNER, Role.ADMIN)
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateClientFieldDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  /** Da de baja un campo; los valores ya respondidos se conservan. */
  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(":id")
  async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string
  ) {
    await this.service.remove(id, businessId);
    return { message: "Campo de ficha desactivado" };
  }
}
