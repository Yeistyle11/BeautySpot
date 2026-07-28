import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { EntityManager } from "typeorm";
import {
  AppointmentCreatedEvent,
  AppointmentConfirmedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  AppointmentNoShowedEvent,
  PaymentRegisteredEvent,
  ReviewCreatedEvent,
  EventNames,
  IBaseEvent,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { MetricsService } from "../metrics/metrics.service";

/** Fecha de hoy en UTC en formato YYYY-MM-DD, usada como clave de las métricas diarias. */
function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Acumula las métricas diarias y por profesional a partir de los eventos de dominio.
 *
 * Cada handler se ejecuta a través de {@link ProcessedEventsStore}, que descarta
 * los eventos ya aplicados. Es imprescindible aquí y no un adorno: las métricas
 * son contadores acumulativos, así que un evento entregado dos veces —la
 * entrega es at-least-once— las deja infladas para siempre, sin forma de
 * distinguir después el valor bueno del corrompido.
 */
@Injectable()
export class AnalyticsEventListeners {
  private readonly logger = new Logger(AnalyticsEventListeners.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly processedEvents: ProcessedEventsStore
  ) {}

  /** Cuenta la cita creada y suma su importe a los ingresos del día. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CREATED,
    queue: nombreDeCola("analytics", EventNames.BOOKING_APPOINTMENT_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCreated(
    event: AppointmentCreatedEvent
  ): Promise<void> {
    this.logger.log(`Cita creada: ${event.payload.appointmentId}`);
    const { businessId, totalAmount } = event.payload;
    await this.aplicar(event, "cita creada", (manager) =>
      this.metricsService.incrementDailyMetric(
        businessId,
        todayUtc(),
        { totalAppointments: 1, totalRevenue: totalAmount },
        manager
      )
    );
  }

  /** Suma la cita confirmada a las métricas del profesional. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
    queue: nombreDeCola("analytics", EventNames.BOOKING_APPOINTMENT_CONFIRMED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentConfirmed(
    event: AppointmentConfirmedEvent
  ): Promise<void> {
    this.logger.log(`Cita confirmada: ${event.payload.appointmentId}`);
    const { businessId, professionalId, totalAmount } = event.payload;
    await this.aplicar(event, "cita confirmada", (manager) =>
      this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        todayUtc(),
        { appointments: 1, revenue: totalAmount },
        manager
      )
    );
  }

  /** Cuenta la cita completada en el día y en las métricas del profesional. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_COMPLETED,
    queue: nombreDeCola("analytics", EventNames.BOOKING_APPOINTMENT_COMPLETED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCompleted(
    event: AppointmentCompletedEvent
  ): Promise<void> {
    this.logger.log(`Cita completada: ${event.payload.appointmentId}`);
    const { businessId, professionalId, totalAmount } = event.payload;
    const date = todayUtc();

    await this.aplicar(event, "cita completada", async (manager) => {
      await this.metricsService.incrementDailyMetric(
        businessId,
        date,
        { completedAppointments: 1 },
        manager
      );
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1, revenue: totalAmount },
        manager
      );
    });
  }

  /** Cuenta la cita cancelada en el día y en las métricas del profesional. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CANCELLED,
    queue: nombreDeCola("analytics", EventNames.BOOKING_APPOINTMENT_CANCELLED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCancelled(
    event: AppointmentCancelledEvent
  ): Promise<void> {
    this.logger.log(`Cita cancelada: ${event.payload.appointmentId}`);
    const { businessId, professionalId } = event.payload;
    const date = todayUtc();

    await this.aplicar(event, "cita cancelada", async (manager) => {
      await this.metricsService.incrementDailyMetric(
        businessId,
        date,
        { cancelledAppointments: 1 },
        manager
      );
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1 },
        manager
      );
    });
  }

  /** Cuenta el no-show en el día y en las métricas del profesional. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_NO_SHOWED,
    queue: nombreDeCola("analytics", EventNames.BOOKING_APPOINTMENT_NO_SHOWED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentNoShowed(
    event: AppointmentNoShowedEvent
  ): Promise<void> {
    this.logger.log(`No-show: ${event.payload.appointmentId}`);
    const { businessId, professionalId } = event.payload;
    const date = todayUtc();

    await this.aplicar(event, "no-show", async (manager) => {
      await this.metricsService.incrementDailyMetric(
        businessId,
        date,
        { noShowAppointments: 1 },
        manager
      );
      await this.metricsService.incrementProfessionalMetric(
        businessId,
        professionalId,
        date,
        { appointments: 1 },
        manager
      );
    });
  }

  /** Suma el importe del pago a los ingresos del día. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_PAYMENT_REGISTERED,
    queue: nombreDeCola("analytics", EventNames.PAYMENT_PAYMENT_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePaymentRegistered(event: PaymentRegisteredEvent): Promise<void> {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);
    const { businessId, amount } = event.payload;
    await this.aplicar(event, "pago", (manager) =>
      this.metricsService.incrementDailyMetric(
        businessId,
        todayUtc(),
        { totalRevenue: amount },
        manager
      )
    );
  }

  /**
   * Fija la valoración del profesional en la métrica del día.
   *
   * Este es el único caso naturalmente idempotente —escribe un valor absoluto,
   * no un incremento—, pero pasa igual por el store: mantener una sola forma de
   * escribir handlers evita que el siguiente se escriba sin protección.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.MARKETPLACE_REVIEW_CREATED,
    queue: nombreDeCola("analytics", EventNames.MARKETPLACE_REVIEW_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleReviewCreated(event: ReviewCreatedEvent): Promise<void> {
    this.logger.log(`Reseña creada: ${event.payload.reviewId}`);
    const { businessId, professionalId, rating } = event.payload;
    await this.aplicar(event, "reseña", (manager) =>
      this.metricsService.setProfessionalRating(
        businessId,
        professionalId,
        todayUtc(),
        rating,
        manager
      )
    );
  }

  /**
   * Aplica el evento una sola vez y captura los errores, para que un fallo de
   * métricas no tumbe el consumidor.
   *
   * Si el trabajo falla, la transacción del store revierte también la marca de
   * procesado, así que el evento no queda dado por aplicado sin estarlo.
   */
  private async aplicar(
    event: IBaseEvent<unknown>,
    contexto: string,
    trabajo: (manager: EntityManager) => Promise<void>
  ): Promise<void> {
    try {
      const aplicado = await this.processedEvents.once(
        event,
        `analytics:${contexto}`,
        trabajo
      );
      if (!aplicado) {
        this.logger.debug(`Evento de ${contexto} ya aplicado, se ignora`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error registrando métricas de ${contexto}: ${message}`,
        stack
      );
    }
  }
}
