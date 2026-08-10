import { Controller, Get, Post, Param, Body, Query } from "@nestjs/common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import { CashRegisterService } from "./cash-register.service";
import {
  OpenSessionDto,
  CloseSessionDto,
  RegisterMovementDto,
} from "./dto/cash-register.dto";
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints del arqueo de caja (abrir/cerrar sesión, movimientos y resúmenes). */
@Controller("cash-register")
@Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  /** Abre una sesión de caja con el saldo inicial. */
  @Post("open")
  async openSession(
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: OpenSessionDto
  ) {
    return this.service.openSession(businessId, userId || "system", dto);
  }

  /** Cierra una sesión de caja indicando el saldo final. */
  @Post(":id/close")
  async closeSession(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CloseSessionDto
  ) {
    return this.service.closeSession(id, businessId, userId || "system", dto);
  }

  /** Registra un movimiento (ingreso/egreso) en la sesión. */
  @Post(":id/movements")
  async registerMovement(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: RegisterMovementDto
  ) {
    return this.service.registerMovement(
      id,
      businessId,
      userId || "system",
      dto
    );
  }

  /** Devuelve la sesión de caja abierta del negocio, si la hay. */
  @Get("active")
  async getActiveSession(@BusinessId() businessId: string) {
    return this.service.getActiveSession(businessId);
  }

  /** Lista el historial de sesiones de caja del negocio, paginado. */
  @Get("history")
  async getSessionHistory(
    @BusinessId() businessId: string,
    @Query() query: Record<string, unknown>
  ) {
    const pagination = parsePaginationQuery(query, ["openedAt", "closedAt"]);
    return this.service.getSessionHistory(businessId, pagination);
  }

  /** Corte X: el arqueo de la sesión sin cerrarla, desglosado por método. */
  @Get(":id/corte")
  async corteX(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.getSessionSummary(id, businessId);
  }

  /** Devuelve el resumen de una sesión con sus movimientos y total esperado. */
  @Get(":id/summary")
  async getSessionSummary(
    @Param("id") id: string,
    @BusinessId() businessId: string
  ) {
    return this.service.getSessionSummary(id, businessId);
  }
}
