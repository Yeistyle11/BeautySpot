import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { EventNames } from "@beautyspot/event-types";
import { MetricsService } from "../metrics/metrics.service";

@Injectable()
export class AnalyticsEventListeners {
  private readonly logger = new Logger(AnalyticsEventListeners.name);

  constructor(
    private readonly metricsService: MetricsService,
  ) {}

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CREATED)
  async handleAppointmentCreated(@Payload() event: any) {
    this.logger.log(`Cita creada: ${event.payload.appointmentId}`);
    try {
      const { businessId, totalAmount } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertDailyMetric({
        businessId,
        date: today,
        totalAppointments: 1,
        totalRevenue: totalAmount,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de cita creada: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CONFIRMED)
  async handleAppointmentConfirmed(@Payload() event: any) {
    this.logger.log(`Cita confirmada: ${event.payload.appointmentId}`);
    try {
      const { businessId, professionalId, totalAmount } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertDailyMetric({
        businessId,
        date: today,
        totalAppointments: 1,
        completedAppointments: 1,
        totalRevenue: totalAmount,
      });

      await this.metricsService.upsertProfessionalMetric({
        businessId,
        professionalId,
        date: today,
        appointments: 1,
        revenue: totalAmount,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de cita confirmada: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(@Payload() event: any) {
    this.logger.log(`Cita completada: ${event.payload.appointmentId}`);
    try {
      const { businessId, professionalId, totalAmount } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertDailyMetric({
        businessId,
        date: today,
        completedAppointments: 1,
        totalRevenue: totalAmount,
      });

      await this.metricsService.upsertProfessionalMetric({
        businessId,
        professionalId,
        date: today,
        appointments: 1,
        revenue: totalAmount,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de cita completada: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(@Payload() event: any) {
    this.logger.log(`Cita cancelada: ${event.payload.appointmentId}`);
    try {
      const { businessId, professionalId } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertDailyMetric({
        businessId,
        date: today,
        cancelledAppointments: 1,
      });

      await this.metricsService.upsertProfessionalMetric({
        businessId,
        professionalId,
        date: today,
        appointments: 1,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de cita cancelada: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_NO_SHOWED)
  async handleAppointmentNoShowed(@Payload() event: any) {
    this.logger.log(`No-show: ${event.payload.appointmentId}`);
    try {
      const { businessId, professionalId } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertDailyMetric({
        businessId,
        date: today,
        noShowAppointments: 1,
      });

      await this.metricsService.upsertProfessionalMetric({
        businessId,
        professionalId,
        date: today,
        appointments: 1,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de no-show: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.PAYMENT_PAYMENT_REGISTERED)
  async handlePaymentRegistered(@Payload() event: any) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);
    try {
      const { businessId, amount } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertDailyMetric({
        businessId,
        date: today,
        totalRevenue: amount,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de pago: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.MARKETPLACE_REVIEW_CREATED)
  async handleReviewCreated(@Payload() event: any) {
    this.logger.log(`Reseña creada: ${event.payload.reviewId}`);
    try {
      const { businessId, professionalId, rating } = event.payload;
      const today = new Date().toISOString().split("T")[0];

      await this.metricsService.upsertProfessionalMetric({
        businessId,
        professionalId,
        date: today,
        rating,
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error registrando métricas de reseña: ${errorMessage}`, errorStack);
    }
  }
}