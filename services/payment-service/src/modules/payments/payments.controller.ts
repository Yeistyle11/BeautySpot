import { Controller, Get, Post, Patch, Param, Body, Query } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { IsString, IsNumber, IsEnum, IsOptional } from "class-validator";
import { PaymentMethod, PaymentStatus, Role } from "@beautyspot/shared-types";
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";

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
  async create(
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreatePaymentDto
  ) {
    return this.service.create(businessId, {
      ...dto,
      registeredBy: userId,
    });
  }

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(
    @BusinessId() businessId: string,
    @Query() query: Record<string, unknown>
  ) {
    return this.service.findByBusiness(businessId, query as any);
  }

  @Get("daily-summary")
  @Roles(Role.OWNER, Role.ADMIN)
  async dailySummary(
    @BusinessId() businessId: string,
    @Query("date") date: string
  ) {
    return this.service.getDailySummary(businessId, date);
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  @Patch(":id/status")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateStatus(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateStatusDto
  ) {
    return this.service.updateStatus(id, businessId, dto.status);
  }

  @Post(":id/refund")
  @Roles(Role.OWNER, Role.ADMIN)
  async refund(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() body: { reason?: string; refundAmount?: number }
  ) {
    return this.service.refundPayment(id, businessId, {
      reason: body.reason,
      refundAmount: body.refundAmount,
      refundedBy: userId,
    });
  }
}
