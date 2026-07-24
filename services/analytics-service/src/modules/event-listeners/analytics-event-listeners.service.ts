import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  AppointmentCreatedEvent,
  AppointmentConfirmedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  AppointmentNoShowedEvent,
  PaymentRegisteredEvent,
  ReviewCreatedEvent,
  EventNames,
} from "@beautyspot/event-types";
import { MetricsService } from "../metrics/metrics.service";

/** Fecha de hoy en UTC en formato YYYY-MM-DD, usada como clave de las métricas diarias. */
function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

/** Escucha los eventos de dominio y acumula las métricas diarias y por profesional del negocio. */
@Injectable()
export class AnalyticsEventListeners {
  private readonly logger = new Logger(AnalyticsEventListeners.name);

  constructor(private readonly metricsService: MetricsService) {}

  /** Cuenta la cita creada y suma su importe a los ingresos del día. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CREATED)
  async handleAppointmentCreated(
    @Payload() event: AppointmentCreatedEvent
  ): Promise<void> {
    this.logger.log(`Cita creada: ${event.payload.appointmentId}`);
    const { businessId, totalAmount } = event.payload;
    await this.safeIncrement(
      "cita creada",
      this.metricsService.incrementDailyMetric(businessId, todayUtc(), {
        totalAppointments: 1,
        totalRevenue: totalAmount,
      })
    );
  }

  /** Suma la cita confirmada a las métricas del profesional. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CONFIRMED)
  async handleAppointmentConfirmed(
    @Payload() event: AppointmentConfirmedEvent
  ): Promise<void> {
    this.logger.log(`Cita confirmada: ${event.payload.appointmentId}`);
    const { businessId, professionalId, totalAmount } = event.payload;
    const date = todayUtc();

    await this.safeIncrement("cita confirmada", async () => {
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1, revenue: totalAmount }
      );
    });
  }

  /** Cuenta la cita completada en el día y en las métricas del profesional. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(
    @Payload() event: AppointmentCompletedEvent
  ): Promise<void> {
    this.logger.log(`Cita completada: ${event.payload.appointmentId}`);
    const { businessId, professionalId, totalAmount } = event.payload;
    const date = todayUtc();

    await this.safeIncrement("cita completada", async () => {
      await this.metricsService.incrementDailyMetric(businessId, date, {
        completedAppointments: 1,
      });
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1, revenue: totalAmount }
      );
    });
  }

  /** Cuenta la cita cancelada en el día y en las métricas del profesional. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(
    @Payload() event: AppointmentCancelledEvent
  ): Promise<void> {
    this.logger.log(`Cita cancelada: ${event.payload.appointmentId}`);
    const { businessId, professionalId } = event.payload;
    const date = todayUtc();

    await this.safeIncrement("cita cancelada", async () => {
      await this.metricsService.incrementDailyMetric(businessId, date, {
        cancelledAppointments: 1,
      });
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1 }
      );
    });
  }

  /** Cuenta el no-show en el día y en las métricas del profesional. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_NO_SHOWED)
  async handleAppointmentNoShowed(
    @Payload() event: AppointmentNoShowedEvent
  ): Promise<void> {
    this.logger.log(`No-show: ${event.payload.appointmentId}`);
    const { businessId, professionalId } = event.payload;
    const date = todayUtc();

    await this.safeIncrement("no-show", async () => {
      await this.metricsService.incrementDailyMetric(businessId, date, {
        noShowAppointments: 1,
      });
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1 }
      );
    });
  }

  /** Suma el importe del pago a los ingresos del día. */
  @EventPattern(EventNames.PAYMENT_PAYMENT_REGISTERED)
  async handlePaymentRegistered(
    @Payload() event: PaymentRegisteredEvent
  ): Promise<void> {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);
    const { businessId, amount } = event.payload;
    await this.safeIncrement(
      "pago",
      this.metricsService.incrementDailyMetric(businessId, todayUtc(), {
        totalRevenue: amount,
      })
    );
  }

  /** Fija la valoración del profesional en la métrica del día a partir de la reseña. */
  @EventPattern(EventNames.MARKETPLACE_REVIEW_CREATED)
  async handleReviewCreated(
    @Payload() event: ReviewCreatedEvent
  ): Promise<void> {
    this.logger.log(`Reseña creada: ${event.payload.reviewId}`);
    const { businessId, professionalId, rating } = event.payload;
    await this.safeIncrement(
      "reseña",
      this.metricsService.setProfessionalRating(
        businessId,
        professionalId,
        todayUtc(),
        rating
      )
    );
  }

  /** Ejecuta la actualización de métricas capturando errores, para que un fallo no tumbe el consumidor. */
  private async safeIncrement(
    context: string,
    op: Promise<unknown> | (() => Promise<unknown>)
  ): Promise<void> {
    try {
      await (typeof op === "function" ? op() : op);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error registrando métricas de ${context}: ${message}`,
        stack
      );
    }
  }
}
