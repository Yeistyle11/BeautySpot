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
import {
  IsString,
  IsNumber,
  IsInt,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsUUID,
  Min,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { PaymentMethod, PaymentStatus, Role } from "@beautyspot/shared-types";
import {
  Roles,
  BranchId,
  BusinessId,
  CurrentUser,
} from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";

/** Datos para registrar un pago: cliente, monto, método y referencia/cita opcionales. */
class CreatePaymentDto {
  @IsOptional() @IsString() appointmentId?: string;
  @IsString({ message: "Elige el cliente al que se le cobra" })
  clientId!: string;
  @IsNumber({}, { message: "El monto debe ser un número" })
  @Min(0, { message: "El monto no puede ser negativo" })
  amount!: number;
  @IsEnum(PaymentMethod, { message: "El método de pago no es válido" })
  method!: PaymentMethod;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
  /**
   * Puntos de fidelidad que el cliente gasta en este cobro. `amount` es lo que
   * paga de su bolsillo, ya rebajado: lo que tiene que cuadrar con la cita es
   * la suma de los dos.
   */
  @IsOptional()
  @IsInt({ message: "Los puntos deben ser un número entero" })
  @Min(1, { message: "Para canjear hay que usar al menos un punto" })
  puntosUsados?: number;
  /**
   * Identifica el intento de cobro, no el cobro: quien cobra lo genera una vez
   * y lo repite si reenvía. Dos envíos con el mismo identificador dejan un solo
   * cargo, que es lo que salva al cliente del doble clic.
   */
  @IsOptional()
  @IsUUID("4", { message: "El identificador de la solicitud debe ser un UUID" })
  solicitudId?: string;
}

/** Tope de citas por consulta; el formulario ofrece una página, no el historial. */
const MAXIMO_CITAS = 100;

/**
 * Citas por las que se pregunta si ya están cobradas.
 *
 * Llegan como lista separada por comas y se acotan: sin tope, un `?ids=` largo
 * arma un `IN (...)` de miles de elementos con una sola petición.
 */
export class CitasCobradasDto {
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, MAXIMO_CITAS)
      : []
  )
  @IsArray()
  @IsUUID("4", { each: true, message: "Cada id de cita debe ser un UUID" })
  appointmentIds!: string[];
}

/** Día del que se pide el resumen, en formato ISO. */
class DailySummaryQueryDto {
  @IsDateString() date!: string;
}

/** Nuevo estado a asignar a un pago. */
class UpdateStatusDto {
  @IsEnum(PaymentStatus) status!: PaymentStatus;
}

/** Motivo e importe de una devolución; sin importe se devuelve el total. */
class DevolucionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsNumber() @Min(0) refundAmount?: number;
}

/** Endpoints de registro, consulta y reembolso de pagos del negocio. */
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Registra un pago a nombre del usuario autenticado. */
  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async create(
    @BusinessId() businessId: string,
    @BranchId() branchId: string | undefined,
    @CurrentUser("userId") userId: string,
    @Body() dto: CreatePaymentDto
  ) {
    return this.service.create(businessId, {
      ...dto,
      branchId,
      registeredBy: userId,
    });
  }

  /** Lista los pagos del negocio con filtros y paginación. */
  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findAll(
    @BusinessId() businessId: string,
    @BranchId() branchId: string | undefined,
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
        branchId,
      },
      pagination
    );
  }

  /**
   * De las citas indicadas, cuáles tienen ya un cobro vivo.
   *
   * Booking no sabe nada de pagos, así que al ofrecer las citas por cobrar hay
   * que preguntar aquí cuáles hay que tachar. Se responde solo con los
   * identificadores: quien pregunta ya tiene el resto.
   */
  @Get("cobradas")
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async cobradas(
    @BusinessId() businessId: string,
    @Query() query: CitasCobradasDto
  ): Promise<string[]> {
    return this.service.citasYaCobradas(businessId, query.appointmentIds);
  }

  /** Devuelve el resumen de pagos completados de un día, agregado por método. */
  @Get("daily-summary")
  @Roles(Role.OWNER, Role.ADMIN)
  async dailySummary(
    @BusinessId() businessId: string,
    @BranchId() branchId: string | undefined,
    @Query() query: DailySummaryQueryDto
  ) {
    return this.service.getDailySummary(businessId, query.date, branchId);
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
    @Body() body: DevolucionDto
  ) {
    return this.service.refundPayment(id, businessId, {
      reason: body.reason,
      refundAmount: body.refundAmount,
      refundedBy: userId,
    });
  }
}
