import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { PaymentEntity } from "./payment.entity";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";
import { EventBusService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

const REFUND_WINDOW_DAYS = 30;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
    private readonly eventBus: EventBusService
  ) {}

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
    const payment = this.repo.create({ ...data, businessId });
    const savedPayment = await this.repo.save(payment);

    await this.eventBus.emit(
      EventNames.PAYMENT_PAYMENT_REGISTERED,
      {
        paymentId: savedPayment.id,
        businessId,
        appointmentId: savedPayment.appointmentId,
        clientId: savedPayment.clientId,
        amount: Number(savedPayment.amount),
        method: savedPayment.method,
      },
      savedPayment.id
    );

    return savedPayment;
  }

  async findByBusiness(
    businessId: string,
    filters?: {
      method?: PaymentMethod;
      status?: PaymentStatus;
      from?: string;
      to?: string;
    }
  ) {
    const where: Record<string, unknown> = { businessId };
    if (filters?.method) where.method = filters.method;
    if (filters?.status) where.status = filters.status;
    if (filters?.from && filters?.to) {
      return this.repo.find({
        where: {
          ...where,
          createdAt: Between(new Date(filters.from), new Date(filters.to)),
        },
        order: { createdAt: "DESC" },
      });
    }
    return this.repo.find({ where, order: { createdAt: "DESC" } });
  }

  async findById(id: string, businessId: string): Promise<PaymentEntity> {
    const payment = await this.repo.findOne({ where: { id, businessId } });
    if (!payment) throw new NotFoundException("Pago no encontrado");
    return payment;
  }

  async updateStatus(
    id: string,
    businessId: string,
    status: PaymentStatus
  ): Promise<PaymentEntity> {
    await this.repo.update({ id, businessId }, { status });
    return this.findById(id, businessId);
  }

  async getDailySummary(businessId: string, date: string) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    const payments = await this.repo.find({
      where: {
        businessId,
        createdAt: Between(start, end),
        status: PaymentStatus.COMPLETED,
      },
    });

    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
      total += Number(p.amount);
    }

    return { date, total, count: payments.length, byMethod };
  }

  async refundPayment(
    id: string,
    businessId: string,
    reason?: string,
    refundAmount?: number
  ): Promise<PaymentEntity> {
    const payment = await this.loadRefundablePayment(id, businessId);
    this.validateRefundWindow(payment);
    const finalAmount = this.calculateRefundAmount(payment, refundAmount);
    const finalReason = reason || "Reembolso solicitado";

    const updatedPayment = await this.applyRefund(
      payment,
      finalAmount,
      finalReason
    );
    await this.publishRefundEvent(
      updatedPayment,
      payment,
      finalAmount,
      finalReason,
      businessId
    );

    return updatedPayment;
  }

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

  private validateRefundWindow(payment: PaymentEntity): void {
    const refundWindowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - payment.createdAt.getTime() > refundWindowMs) {
      throw new BadRequestException(
        `El periodo de reembolso de ${REFUND_WINDOW_DAYS} días ha expirado`
      );
    }
  }

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

  private async applyRefund(
    payment: PaymentEntity,
    amount: number,
    reason: string
  ): Promise<PaymentEntity> {
    return this.repo.save({
      ...payment,
      status: PaymentStatus.REFUNDED,
      refundedAt: new Date(),
      refundAmount: amount,
      refundReason: reason,
      refundedBy: "SYSTEM",
    });
  }

  private async publishRefundEvent(
    refundedPayment: PaymentEntity,
    originalPayment: PaymentEntity,
    refundAmount: number,
    reason: string,
    businessId: string
  ): Promise<void> {
    await this.eventBus.emit(
      EventNames.PAYMENT_REFUND_PROCESSED,
      {
        paymentId: refundedPayment.id,
        businessId,
        clientId: originalPayment.clientId,
        appointmentId: originalPayment.appointmentId,
        originalAmount: Number(originalPayment.amount),
        refundAmount,
        reason,
        refundedAt: refundedPayment.refundedAt,
      },
      refundedPayment.id
    );
  }
}
