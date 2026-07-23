import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { CashRegisterService } from "./cash-register.service";
import {
  OpenSessionDto,
  CloseSessionDto,
  RegisterMovementDto,
} from "./dto/cash-register.dto";
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("cash-register")
@Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Post("open")
  async openSession(
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: OpenSessionDto
  ) {
    return this.service.openSession(businessId, userId || "system", dto);
  }

  @Post(":id/close")
  async closeSession(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CloseSessionDto
  ) {
    return this.service.closeSession(id, businessId, userId || "system", dto);
  }

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

  @Get("active")
  async getActiveSession(@BusinessId() businessId: string) {
    return this.service.getActiveSession(businessId);
  }

  @Get("history")
  async getSessionHistory(@BusinessId() businessId: string) {
    return this.service.getSessionHistory(businessId);
  }

  @Get(":id/summary")
  async getSessionSummary(
    @Param("id") id: string,
    @BusinessId() businessId: string
  ) {
    return this.service.getSessionSummary(id, businessId);
  }
}
