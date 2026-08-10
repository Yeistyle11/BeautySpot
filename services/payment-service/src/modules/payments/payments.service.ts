import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  DataSource,
  EntityManager,
  Between,
  In,
  IsNull,
} from "typeorm";
import {
  InternalHttpClient,
  ZonaDelNegocioService,
} from "@beautyspot/nest-common";
import { diaSiguiente, instanteDe } from "@beautyspot/shared-utils";
import { PaymentEntity } from "./payment.entity";
import { CashSessionEntity } from "../cash-register/cash-session.entity";
import { CashMovementEntity } from "../cash-register/cash-movement.entity";
import {
  PaymentMethod,
  PaymentStatus,
  CashMovementType,
  IPaginatedResponse,
} from "@beautyspot/shared-types";
import { OutboxService } from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import { EventNames } from "@beautyspot/event-types";

/** Días desde el pago dentro de los que se admite un reembolso. */
const REFUND_WINDOW_DAYS = 30;

/** Datos de cobro de una cita, tal y como los devuelve booking. */
interface CobroDeCita {
  clientId: string;
  totalAmount: number;
}

/** Estados a los que puede pasar un pago desde cada estado. */
const TRANSICIONES_DE_PAGO: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [PaymentStatus.COMPLETED, PaymentStatus.CANCELLED],
  [PaymentStatus.COMPLETED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.CANCELLED]: [],
};

/**
 * Registra pagos manuales y sus reembolsos, publicando cada operación vía Outbox
 * y protegiendo los reembolsos contra dobles aplicaciones concurrentes.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly zonas: ZonaDelNegocioService,
    private readonly http: InternalHttpClient
  ) {}

  /** Registra un pago y emite el evento PAYMENT_REGISTERED en la misma transacción. */
  async create(
    businessId: string,
    data: {
      appointmentId?: string;
      clientId: string;
      amount: number;
      method: PaymentMethod;
      reference?: string;
      notes?: string;
      registeredBy: string;
      branchId?: string;
    }
  ): Promise<PaymentEntity> {
    if (data.appointmentId) {
      await this.validarContraLaCita(
        businessId,
        data.appointmentId,
        data.amount
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const payment = this.repo.create({ ...data, businessId });
      const savedPayment = await manager
        .getRepository(PaymentEntity)
        .save(payment);

      await this.registrarEntradaEnCaja(manager, businessId, savedPayment);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.PAYMENT_PAYMENT_REGISTERED,
        aggregateType: "payment",
        aggregateId: savedPayment.id,
        payload: {
          paymentId: savedPayment.id,
          businessId,
          appointmentId: savedPayment.appointmentId,
          clientId: savedPayment.clientId,
          amount: Number(savedPayment.amount),
          method: savedPayment.method,
        },
      });

      return savedPayment;
    });
  }

  /**
   * Comprueba que la cita existe, es del negocio, no está ya cobrada y que el
   * importe coincide con el suyo.
   */
  private async validarContraLaCita(
    businessId: string,
    appointmentId: string,
    amount: number
  ): Promise<void> {
    const cita = await this.http.pedir<CobroDeCita | null>(
      "booking",
      `/internal/appointments/${appointmentId}/cobro?businessId=${businessId}`
    );
    if (!cita) {
      throw new BadRequestException(
        "La cita no existe o no pertenece a este negocio"
      );
    }

    const yaCobrada = await this.repo.findOne({
      where: {
        businessId,
        appointmentId,
        status: In([PaymentStatus.PENDING, PaymentStatus.COMPLETED]),
      },
    });
    if (yaCobrada) {
      throw new BadRequestException("Esta cita ya tiene un pago registrado");
    }

    if (Number(amount) !== cita.totalAmount) {
      throw new BadRequestException(
        `El importe no coincide con el de la cita ($${cita.totalAmount})`
      );
    }
  }

  /**
   * Anota el efectivo en la sesión de caja abierta, en la misma transacción que
   * el pago: si el arqueo no lo recoge, el cierre nunca cuadra.
   */
  private async registrarEntradaEnCaja(
    manager: EntityManager,
    businessId: string,
    payment: PaymentEntity
  ): Promise<void> {
    const session = await this.cajaAbierta(
      manager,
      businessId,
      payment.branchId,
      payment.method,
      "registrar un pago en efectivo"
    );
    if (!session) return;

    await manager.getRepository(CashMovementEntity).save(
      manager.getRepository(CashMovementEntity).create({
        cashSessionId: session.id,
        type: CashMovementType.IN,
        amount: Number(payment.amount),
        concept: `Pago ${payment.id}`,
        method: payment.method,
        paymentId: payment.id,
        registeredBy: payment.registeredBy,
      })
    );
  }

  /**
   * Caja abierta del negocio. El efectivo la exige; los demás métodos devuelven
   * nulo cuando no la hay.
   */
  private async cajaAbierta(
    manager: EntityManager,
    businessId: string,
    branchId: string | null,
    method: PaymentMethod,
    accion: string
  ): Promise<CashSessionEntity | null> {
    const session = await manager.getRepository(CashSessionEntity).findOne({
      where: { businessId, branchId: branchId ?? IsNull(), closedAt: IsNull() },
    });
    if (session) return session;

    if (method === PaymentMethod.CASH) {
      throw new BadRequestException(
        `No hay una caja abierta: abre la caja antes de ${accion}`
      );
    }
    return null;
  }

  /** Devuelve el efectivo reembolsado a la caja abierta, si la hay. */
  private async registrarSalidaEnCaja(
    manager: EntityManager,
    businessId: string,
    payment: PaymentEntity,
    amount: number,
    refundedBy: string
  ): Promise<void> {
    const session = await this.cajaAbierta(
      manager,
      businessId,
      payment.branchId,
      payment.method,
      "reembolsar en efectivo"
    );
    if (!session) return;

    await manager.getRepository(CashMovementEntity).save(
      manager.getRepository(CashMovementEntity).create({
        cashSessionId: session.id,
        type: CashMovementType.OUT,
        amount,
        concept: `Reembolso ${payment.id}`,
        method: payment.method,
        paymentId: payment.id,
        registeredBy: refundedBy,
      })
    );
  }

  /** Lista los pagos del negocio con filtros (método, estado, rango de fechas) y paginación. */
  async findByBusiness(
    businessId: string,
    filters: {
      method?: PaymentMethod;
      status?: PaymentStatus;
      from?: string;
      to?: string;
      branchId?: string;
    },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<PaymentEntity>> {
    const where: Record<string, unknown> = { businessId };
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.method) where.method = filters.method;
    if (filters.status) where.status = filters.status;
    if (filters.from && filters.to) {
      where.createdAt = Between(new Date(filters.from), new Date(filters.to));
    }
    return paginate(this.repo, pagination, { where });
  }

  /** Obtiene un pago del negocio por id; lanza 404 si no existe. */
  async findById(id: string, businessId: string): Promise<PaymentEntity> {
    const payment = await this.repo.findOne({ where: { id, businessId } });
    if (!payment) throw new NotFoundException("Pago no encontrado");
    return payment;
  }

  /**
   * Cambia el estado de un pago siguiendo las transiciones permitidas.
   *
   * `REFUNDED` no está entre ellas: la devolución exige importe, motivo, autor y
   * ventana de 30 días, y todo eso vive en {@link refundPayment}.
   */
  async updateStatus(
    id: string,
    businessId: string,
    status: PaymentStatus
  ): Promise<PaymentEntity> {
    const payment = await this.findById(id, businessId);

    if (!TRANSICIONES_DE_PAGO[payment.status].includes(status)) {
      throw new BadRequestException(
        `Un pago ${payment.status} no puede pasar a ${status}`
      );
    }

    await this.repo.update({ id, businessId }, { status });
    return this.findById(id, businessId);
  }

  /**
   * Resumen de pagos completados de un día, agregado por método.
   *
   * La suma y el conteo se hacen en SQL (SUM/COUNT + GROUP BY) en vez de cargar
   * todas las filas del día en memoria: el volumen de pagos crece con el negocio
   * y traer cada registro solo para sumarlo no escala.
   */
  async getDailySummary(businessId: string, date: string, branchId?: string) {
    // El día va de medianoche a medianoche en el huso del negocio, con el fin
    // exclusivo.
    const zona = await this.zonas.de(businessId);
    const start = instanteDe(zona, date, "00:00");
    const end = instanteDe(zona, diaSiguiente(date), "00:00");

    const rows = await this.repo
      .createQueryBuilder("p")
      .select("p.method", "method")
      .addSelect("SUM(p.amount)", "total")
      .addSelect("COUNT(*)", "count")
      .where("p.business_id = :businessId", { businessId })
      .andWhere("p.status = :status", { status: PaymentStatus.COMPLETED })
      .andWhere("p.created_at >= :start AND p.created_at < :end", {
        start,
        end,
      })
      .andWhere(branchId ? "p.branch_id = :branchId" : "TRUE", { branchId })
      .groupBy("p.method")
      .getRawMany<{ method: string; total: string; count: string }>();

    const byMethod: Record<string, number> = {};
    let total = 0;
    let count = 0;
    for (const row of rows) {
      const amount = Number(row.total);
      byMethod[row.method] = amount;
      total += amount;
      count += Number(row.count);
    }

    return { date, total, count, byMethod };
  }

  /**
   * Reembolsa un pago completado, total o parcialmente.
   *
   * La transición COMPLETED → REFUNDED se aplica con un UPDATE condicionado al
   * estado actual dentro de la transacción: dos peticiones concurrentes sobre el
   * mismo pago no pueden reembolsarlo dos veces, porque solo la primera afecta
   * filas. `refundedBy` registra qué usuario autorizó el reembolso.
   */
  async refundPayment(
    id: string,
    businessId: string,
    options: { reason?: string; refundAmount?: number; refundedBy: string }
  ): Promise<PaymentEntity> {
    const payment = await this.loadRefundablePayment(id, businessId);
    this.validateRefundWindow(payment);
    const finalAmount = this.calculateRefundAmount(
      payment,
      options.refundAmount
    );
    const finalReason = options.reason || "Reembolso solicitado";

    return this.dataSource.transaction(async (manager) => {
      const refunded = await this.applyRefund(manager, payment, {
        amount: finalAmount,
        reason: finalReason,
        refundedBy: options.refundedBy,
      });
      await this.registrarSalidaEnCaja(
        manager,
        businessId,
        payment,
        finalAmount,
        options.refundedBy
      );
      await this.enqueueRefundEvent(
        manager,
        refunded,
        payment,
        finalAmount,
        finalReason,
        businessId
      );
      return refunded;
    });
  }

  /** Carga el pago y verifica que esté COMPLETED (única situación reembolsable). */
  private async loadRefundablePayment(
    id: string,
    businessId: string
  ): Promise<PaymentEntity> {
    const payment = await this.findById(id, businessId);
    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Solo se pueden reembolsar pagos completados. Estado actual: ${payment.status}`
      );
    }
    return payment;
  }

  /** Verifica que el pago siga dentro de la ventana de reembolso. */
  private validateRefundWindow(payment: PaymentEntity): void {
    const refundWindowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - payment.createdAt.getTime() > refundWindowMs) {
      throw new BadRequestException(
        `El periodo de reembolso de ${REFUND_WINDOW_DAYS} días ha expirado`
      );
    }
  }

  /** Resuelve el monto a reembolsar (total por defecto) validando que sea válido. */
  private calculateRefundAmount(
    payment: PaymentEntity,
    requested?: number
  ): number {
    const amount = requested ?? Number(payment.amount);
    if (amount <= 0 || amount > Number(payment.amount)) {
      throw new BadRequestException(
        `El monto del reembolso debe ser mayor a 0 y menor o igual al monto original ($${payment.amount})`
      );
    }
    return amount;
  }

  /** Aplica el reembolso con un UPDATE condicionado al estado, evitando dobles reembolsos. */
  private async applyRefund(
    manager: EntityManager,
    payment: PaymentEntity,
    data: { amount: number; reason: string; refundedBy: string }
  ): Promise<PaymentEntity> {
    const refundedAt = new Date();
    // El WHERE sobre status = COMPLETED es la guarda anti doble-reembolso: si
    // otra transacción ya cambió el estado, este UPDATE no toca ninguna fila.
    const result = await manager.getRepository(PaymentEntity).update(
      { id: payment.id, status: PaymentStatus.COMPLETED },
      {
        status: PaymentStatus.REFUNDED,
        refundedAt,
        refundAmount: data.amount,
        refundReason: data.reason,
        refundedBy: data.refundedBy,
      }
    );

    if (!result.affected) {
      throw new BadRequestException("El pago ya fue reembolsado");
    }

    return Object.assign(payment, {
      status: PaymentStatus.REFUNDED,
      refundedAt,
      refundAmount: data.amount,
      refundReason: data.reason,
      refundedBy: data.refundedBy,
    });
  }

  /** Encola el evento PAYMENT_REFUND_PROCESSED dentro de la transacción del reembolso. */
  private async enqueueRefundEvent(
    manager: EntityManager,
    refundedPayment: PaymentEntity,
    originalPayment: PaymentEntity,
    refundAmount: number,
    reason: string,
    businessId: string
  ): Promise<void> {
    await this.outbox.enqueue(manager, {
      eventType: EventNames.PAYMENT_REFUND_PROCESSED,
      aggregateType: "payment",
      aggregateId: refundedPayment.id,
      payload: {
        paymentId: refundedPayment.id,
        businessId,
        clientId: originalPayment.clientId,
        appointmentId: originalPayment.appointmentId,
        originalAmount: Number(originalPayment.amount),
        refundAmount,
        reason,
        refundedAt: refundedPayment.refundedAt,
      },
    });
  }
}
