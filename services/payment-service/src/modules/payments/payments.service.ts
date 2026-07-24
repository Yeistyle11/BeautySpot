import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager, Between } from "typeorm";
import { PaymentEntity } from "./payment.entity";
import {
  PaymentMethod,
  PaymentStatus,
  IPaginatedResponse,
} from "@beautyspot/shared-types";
import { OutboxService } from "@beautyspot/nest-common";
import { paginate, PaginateParams } from "@beautyspot/database";
import { EventNames } from "@beautyspot/event-types";

/** Días desde el pago dentro de los que se admite un reembolso. */
const REFUND_WINDOW_DAYS = 30;

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
    private readonly outbox: OutboxService
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
    }
  ): Promise<PaymentEntity> {
    return this.dataSource.transaction(async (manager) => {
      const payment = this.repo.create({ ...data, businessId });
      const savedPayment = await manager
        .getRepository(PaymentEntity)
        .save(payment);

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

  /** Lista los pagos del negocio con filtros (método, estado, rango de fechas) y paginación. */
  async findByBusiness(
    businessId: string,
    filters: {
      method?: PaymentMethod;
      status?: PaymentStatus;
      from?: string;
      to?: string;
    },
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<PaymentEntity>> {
    const where: Record<string, unknown> = { businessId };
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

  /** Cambia el estado de un pago. */
  async updateStatus(
    id: string,
    businessId: string,
    status: PaymentStatus
  ): Promise<PaymentEntity> {
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
  async getDailySummary(businessId: string, date: string) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);

    const rows = await this.repo
      .createQueryBuilder("p")
      .select("p.method", "method")
      .addSelect("SUM(p.amount)", "total")
      .addSelect("COUNT(*)", "count")
      .where("p.business_id = :businessId", { businessId })
      .andWhere("p.status = :status", { status: PaymentStatus.COMPLETED })
      .andWhere("p.created_at BETWEEN :start AND :end", { start, end })
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
