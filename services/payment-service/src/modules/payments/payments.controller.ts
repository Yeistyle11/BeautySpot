import { Controller, Get, Post, Patch, Param, Body, Query, Req } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { IsString, IsNumber, IsEnum, IsOptional } from "class-validator";
import { PaymentMethod, PaymentStatus, Role } from "@beautyspot/shared-types";
import { Roles } from "@beautyspot/nest-common";

class CreatePaymentDto {
  @IsOptional() @IsString() appointmentId?: string;
  @IsString() clientId!: string;
  @IsNumber() amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}

class UpdateStatusDto {
  @IsEnum(PaymentStatus) status!: PaymentStatus;
}

@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  async create(@Req() req: any, @Body() dto: CreatePaymentDto) {
    return this.service.create(req.businessId, { ...dto, registeredBy: req.user?.userId || null });
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.service.findByBusiness(req.businessId, query as any);
  }

  @Get("daily-summary")
  @Roles(Role.OWNER, Role.ADMIN)
  async dailySummary(@Req() req: any, @Query("date") date: string) {
    return this.service.getDailySummary(req.businessId, date);
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Patch(":id/status")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateStatus(@Param("id") id: string, @Req() req: any, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, req.businessId, dto.status);
  }

  @Post(":id/refund")
  @Roles(Role.OWNER, Role.ADMIN)
  async refund(@Param("id") id: string, @Req() req: any, @Body() body: { reason?: string; refundAmount?: number }) {
    return this.service.refundPayment(id, req.businessId, body.reason, body.refundAmount);
  }
}
