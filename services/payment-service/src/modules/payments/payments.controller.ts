import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { IsString, IsNumber, IsEnum, IsOptional } from "class-validator";
import { PaymentMethod, PaymentStatus, Role } from "@beautyspot/shared-types";
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";

/** Datos para registrar un pago: cliente, monto, método y referencia/cita opcionales. */
class CreatePaymentDto {
  @IsOptional() @IsString() appointmentId?: string;
  @IsString() clientId!: string;
  @IsNumber() amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
}

/** Nuevo estado a asignar a un pago. */
class UpdateStatusDto {
  @IsEnum(PaymentStatus) status!: PaymentStatus;
}

/** Endpoints de registro, consulta y reembolso de pagos del negocio. */
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Registra un pago a nombre del usuario autenticado. */
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

  /** Lista los pagos del negocio con filtros y paginación. */
  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(
    @BusinessId() businessId: string,
    @Query() query: Record<string, unknown>
  ) {
    const pagination = parsePaginationQuery(query, ["createdAt", "amount"]);
    return this.service.findByBusiness(
      businessId,
      {
        method: query.method as PaymentMethod,
        status: query.status as PaymentStatus,
        from: query.from as string,
        to: query.to as string,
      },
      pagination
    );
  }

  /** Devuelve el resumen de pagos completados de un día, agregado por método. */
  @Get("daily-summary")
  @Roles(Role.OWNER, Role.ADMIN)
  async dailySummary(
    @BusinessId() businessId: string,
    @Query("date") date: string
  ) {
    return this.service.getDailySummary(businessId, date);
  }

  /** Obtiene un pago por id. */
  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Cambia el estado de un pago. */
  @Patch(":id/status")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateStatus(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateStatusDto
  ) {
    return this.service.updateStatus(id, businessId, dto.status);
  }

  /** Reembolsa un pago (total o parcial) a nombre del usuario autenticado. */
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
