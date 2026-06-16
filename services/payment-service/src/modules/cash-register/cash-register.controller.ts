import { Controller, Get, Post, Param, Body, Req } from "@nestjs/common";
import { CashRegisterService } from "./cash-register.service";
import { OpenSessionDto, CloseSessionDto, RegisterMovementDto } from "./dto/cash-register.dto";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("cash-register")
@Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Post("open")
  async openSession(@Req() req: any, @Body() dto: OpenSessionDto) {
    const userId = req.user?.userId || "system";
    return this.service.openSession(req.businessId, userId, dto);
  }

  @Post(":id/close")
  async closeSession(@Param("id") id: string, @Req() req: any, @Body() dto: CloseSessionDto) {
    const userId = req.user?.userId || "system";
    return this.service.closeSession(id, req.businessId, userId, dto);
  }

  @Post(":id/movements")
  async registerMovement(@Param("id") id: string, @Req() req: any, @Body() dto: RegisterMovementDto) {
    const userId = req.user?.userId || "system";
    return this.service.registerMovement(id, req.businessId, userId, dto);
  }

  @Get("active")
  async getActiveSession(@Req() req: any) {
    return this.service.getActiveSession(req.businessId);
  }

  @Get("history")
  async getSessionHistory(@Req() req: any) {
    return this.service.getSessionHistory(req.businessId);
  }

  @Get(":id/summary")
  async getSessionSummary(@Param("id") id: string, @Req() req: any) {
    return this.service.getSessionSummary(id, req.businessId);
  }
}
