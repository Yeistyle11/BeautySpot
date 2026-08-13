import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { BlockedSlotsService } from "./blocked-slots.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import {
  CreateBlockedSlotDto,
  BlockedSlotsDelDiaDto,
} from "./dto/blocked-slot.dto";

/**
 * Bloqueos de todo el equipo un día concreto.
 *
 * Va en su propio controlador porque no cuelga de un profesional: la vista día
 * de la agenda los pinta todos a la vez y pedirlos uno a uno serían tantas
 * peticiones como gente tenga el negocio.
 */
@Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
@Controller("blocked-slots")
export class BlockedSlotsDelDiaController {
  constructor(private readonly service: BlockedSlotsService) {}

  @Get()
  async findByDate(
    @BusinessId() businessId: string,
    @Query() query: BlockedSlotsDelDiaDto
  ) {
    return this.service.findByDate(businessId, query.date);
  }
}

/** Endpoints de los bloqueos de agenda de un profesional, para dueños y administradores. */
@Roles(Role.OWNER, Role.ADMIN)
@Controller("professionals/:professionalId/blocked-slots")
export class BlockedSlotsController {
  constructor(private readonly service: BlockedSlotsService) {}

  /** Lista los bloqueos de agenda del profesional. */
  @Get()
  async findAll(
    @Param("professionalId") professionalId: string,
    @BusinessId() businessId: string
  ) {
    return this.service.findByProfessional(businessId, professionalId);
  }

  /** Crea un bloqueo de agenda para el profesional. */
  @Post()
  async create(
    @Param("professionalId") professionalId: string,
    @BusinessId() businessId: string,
    @Body() dto: CreateBlockedSlotDto
  ) {
    return this.service.create(businessId, professionalId, dto);
  }

  /** Elimina un bloqueo de agenda; si se repetía, solo ese día. */
  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.remove(id, businessId);
    return { message: "Bloqueo eliminado" };
  }

  /** Elimina la serie entera a la que pertenece el bloqueo. */
  @Delete(":id/serie")
  async removeSerie(@Param("id") id: string, @BusinessId() businessId: string) {
    const eliminados = await this.service.removeSerie(id, businessId);
    return { message: `Se eliminaron ${eliminados} bloqueos` };
  }
}
