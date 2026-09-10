import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  IsUUID,
  Min,
  MaxLength,
  IsPositive,
  ArrayMaxSize,
  ArrayNotEmpty,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { PaymentMethod, PaymentStatus, Role } from "@beautyspot/shared-types";
import {
  Roles,
  BranchId,
  BusinessId,
  CurrentUser,
  EsFechaSola,
} from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";

/** Lo que se paga por un medio dentro de un cobro repartido. */
class LineaDeCobroDto {
  @IsEnum(PaymentMethod, { message: "El método de pago no es válido" })
  method!: PaymentMethod;
  @IsNumber({}, { message: "El monto debe ser un número" })
  @IsPositive({ message: "Cada parte del cobro tiene que ser mayor que cero" })
  amount!: number;
}

/** Tope de partes de un cobro repartido: son cuatro los medios que existen. */
const MAXIMO_LINEAS = 4;

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
   * Puntos de fidelidad que el cliente gasta en este cobro; `amount` es lo que
   * paga de su bolsillo, ya rebajado.
   */
  @IsOptional()
  @IsInt({ message: "Los puntos deben ser un número entero" })
  @Min(1, { message: "Para canjear hay que usar al menos un punto" })
  puntosUsados?: number;
  /**
   * Identifica el intento de cobro, no el cobro: dos envios con el mismo
   * identificador dejan un solo cargo.
   */
  @IsOptional()
  @IsUUID("4", { message: "El identificador de la solicitud debe ser un UUID" })
  solicitudId?: string;
  /**
   * Rebaja que concede el negocio, con su motivo. Solo la aplican el dueño y el
   * administrador; el servicio rechaza la de recepción.
   */
  @IsOptional()
  @IsNumber({}, { message: "El descuento debe ser un número" })
  @Min(0, { message: "El descuento no puede ser negativo" })
  descuentoComercial?: number;
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: "El motivo del descuento es demasiado largo" })
  motivoDescuento?: string;
  /** Propina, que se suma a lo que entra pero no es ingreso del negocio. */
  @IsOptional()
  @IsNumber({}, { message: "La propina debe ser un número" })
  @Min(0, { message: "La propina no puede ser negativa" })
  propina?: number;
  /**
   * Reparto del cobro entre varios medios. Cuando falta, el cobro entero entra
   * por `method`.
   */
  @IsOptional()
  @IsArray({ message: "El reparto del cobro se envia como una lista" })
  @ArrayNotEmpty({ message: "El reparto del cobro no puede ir vacío" })
  @ArrayMaxSize(MAXIMO_LINEAS, {
    message: `Un cobro no se reparte en más de ${MAXIMO_LINEAS} medios`,
  })
  @ValidateNested({ each: true })
  @Type(() => LineaDeCobroDto)
  metodos?: LineaDeCobroDto[];
}

/** Tope de citas por consulta; el formulario ofrece una página, no el historial. */
const MAXIMO_CITAS = 100;

/**
 * Citas por las que se pregunta si ya estan cobradas, como lista separada por
 * comas y con tope de elementos.
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
  @EsFechaSola() date!: string;
}

/**
 * Corrección de un cobro ya registrado. El motivo es obligatorio: la corrección
 * queda escrita en el pago y sin él la traza no explica nada.
 */
class UpdatePaymentDto {
  @IsOptional()
  @IsNumber({}, { message: "El monto debe ser un número" })
  @IsPositive({ message: "El monto tiene que ser mayor que cero" })
  amount?: number;
  @IsOptional()
  @IsEnum(PaymentMethod, { message: "El método de pago no es válido" })
  method?: PaymentMethod;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
  @IsString({ message: "Anota el motivo de la corrección" })
  @MaxLength(500, { message: "El motivo no puede pasar de 500 caracteres" })
  reason!: string;
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
    @CurrentUser("role") rol: Role,
    @Body() dto: CreatePaymentDto
  ) {
    return this.service.create(businessId, {
      ...dto,
      branchId,
      registeredBy: userId,
      rol,
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
   * De las citas indicadas, cuales tienen ya un cobro vivo. Responde solo con
   * los identificadores.
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

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.RECEPTIONIST)
  async findById(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string
  ) {
    return this.service.findById(id, businessId);
  }

  /** Corrige un cobro mientras su caja siga abierta, dejando traza de quién y por qué. */
  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @BusinessId() businessId: string,
    @CurrentUser("userId") userId: string,
    @Body() dto: UpdatePaymentDto
  ) {
    return this.service.correctPayment(id, businessId, {
      ...dto,
      editedBy: userId,
    });
  }

  /** Reembolsa un pago (total o parcial) a nombre del usuario autenticado. */
  @Post(":id/refund")
  @Roles(Role.OWNER, Role.ADMIN)
  async refund(
    @Param("id", ParseUUIDPipe) id: string,
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
