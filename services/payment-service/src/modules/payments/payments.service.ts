import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { PaymentEntity } from "./payment.entity";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { EventNames } from "@beautyspot/event-types";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity) private readonly repo: Repository<PaymentEntity>,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async create(businessId: string, data: {
    appointmentId?: string; clientId: string; amount: number; method: PaymentMethod;
    reference?: string; notes?: string; registeredBy: string;
  }): Promise<PaymentEntity> {
    const payment = this.repo.create({ ...data, businessId });
    const savedPayment = await this.repo.save(payment);

    try {
      await this.amqpConnection.publish('beautyspot.events', EventNames.PAYMENT_PAYMENT_REGISTERED, {
        eventType: EventNames.PAYMENT_PAYMENT_REGISTERED,
        timestamp: new Date(),
        correlationId: savedPayment.id,
        payload: {
          paymentId: savedPayment.id,
          businessId,
          appointmentId: savedPayment.appointmentId,
          clientId: savedPayment.clientId,
          amount: Number(savedPayment.amount),
          method: savedPayment.method,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`Error publicando evento payment.payment.registered: ${errorMessage}`);
    }

    return savedPayment;
  }

  async findByBusiness(businessId: string, filters?: { method?: PaymentMethod; status?: PaymentStatus; from?: string; to?: string }) {
    const where: Record<string, unknown> = { businessId };
    if (filters?.method) where.method = filters.method;
    if (filters?.status) where.status = filters.status;
    if (filters?.from && filters?.to) {
      return this.repo.find({
        where: { ...where, createdAt: Between(new Date(filters.from), new Date(filters.to)) },
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

  async updateStatus(id: string, businessId: string, status: PaymentStatus): Promise<PaymentEntity> {
    await this.repo.update({ id, businessId }, { status });
    return this.findById(id, businessId);
  }

  async getDailySummary(businessId: string, date: string) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    const payments = await this.repo.find({
      where: { businessId, createdAt: Between(start, end), status: PaymentStatus.COMPLETED },
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
    refundAmount?: number,
  ): Promise<PaymentEntity> {
    const payment = await this.findById(id, businessId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Solo se pueden reembolsar pagos completados. Estado actual: ${payment.status}`,
      );
    }

    const refundWindowDays = 30;
    const refundWindowMs = refundWindowDays * 24 * 60 * 60 * 1000;
    const paymentDate = payment.createdAt.getTime();
    const now = Date.now();

    if (now - paymentDate > refundWindowMs) {
      throw new BadRequestException(
        `El periodo de reembolso de ${refundWindowDays} días ha expirado`,
      );
    }

    const finalRefundAmount = refundAmount ?? Number(payment.amount);

    if (finalRefundAmount <= 0 || finalRefundAmount > Number(payment.amount)) {
      throw new BadRequestException(
        `El monto del reembolso debe ser mayor a 0 y menor o igual al monto original ($${payment.amount})`,
      );
    }

    const updatedPayment = await this.repo.save({
      ...payment,
      status: PaymentStatus.REFUNDED,
      refundedAt: new Date(),
      refundAmount: finalRefundAmount,
      refundReason: reason || 'Reembolso solicitado',
      refundedBy: 'SYSTEM',
    });

    try {
      await this.amqpConnection.publish('beautyspot.events', EventNames.PAYMENT_REFUND_PROCESSED, {
        eventType: EventNames.PAYMENT_REFUND_PROCESSED,
        timestamp: new Date(),
        correlationId: id,
        payload: {
          paymentId: id,
          businessId,
          clientId: payment.clientId,
          appointmentId: payment.appointmentId,
          originalAmount: Number(payment.amount),
          refundAmount: finalRefundAmount,
          reason: reason || 'Reembolso solicitado',
          refundedAt: new Date(),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error(`Error publicando evento payment.refund.processed: ${errorMessage}`);
    }

    return updatedPayment;
  }
}
