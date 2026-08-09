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
  ClientCreatedEvent,
  ReviewCreatedEvent,
  EventNames,
  IBaseEvent,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { MetricsService } from "../metrics/metrics.service";
import { ZonaDelNegocioService } from "@beautyspot/nest-common";
import { fechaDeHoy } from "../../common/fecha";

/**
 * Acumula las métricas diarias y por profesional a partir de los eventos de dominio.
 *
 * Las métricas de una cita se anotan en **la fecha de la cita**, no en la del
 * evento: son las cifras que el dueño compara con su agenda, así que una cita
 * creada hoy para la semana que viene no puede contar como cita de hoy.
 * Los ingresos son la excepción — el dinero entra el día en que se cobra.
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
    private readonly processedEvents: ProcessedEventsStore,
    private readonly zonas: ZonaDelNegocioService
  ) {}

  /** Día en curso en el huso de ese negocio. */
  private async hoyPara(businessId: string): Promise<string> {
    return fechaDeHoy(await this.zonas.de(businessId));
  }

  /**
   * Cuenta la cita en su fecha, para el negocio y para el profesional.
   *
   * No toca los ingresos: el importe de una cita es una previsión, y el dinero
   * lo anota el pago.
   */
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
    const { businessId, professionalId, date } = event.payload;

    await this.aplicar(event, "cita creada", async (manager) => {
      await this.metricsService.incrementDailyMetric(
        businessId,
        date,
        { totalAppointments: 1 },
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

  /**
   * La confirmación no mueve ninguna métrica: la cita ya se contó al crearse y
   * el ingreso se anota cuando se cobra. Se sigue escuchando para dejar
   * constancia del cambio de estado en el log.
   */
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
  }

  /**
   * Cuenta la cita completada en su fecha y anota el ingreso al profesional,
   * que es lo que ordena el ranking.
   */
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
    const { businessId, professionalId, totalAmount, date } = event.payload;

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
        { revenue: totalAmount },
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
    const { businessId, date } = event.payload;

    await this.aplicar(event, "cita cancelada", (manager) =>
      this.metricsService.incrementDailyMetric(
        businessId,
        date,
        { cancelledAppointments: 1 },
        manager
      )
    );
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
    const { businessId, date } = event.payload;

    await this.aplicar(event, "no-show", (manager) =>
      this.metricsService.incrementDailyMetric(
        businessId,
        date,
        { noShowAppointments: 1 },
        manager
      )
    );
  }

  /** Cuenta el alta de cliente como cliente nuevo del día. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_CLIENT_CREATED,
    queue: nombreDeCola("analytics", EventNames.CORE_CLIENT_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleClientCreated(event: ClientCreatedEvent): Promise<void> {
    this.logger.log(`Cliente creado: ${event.payload.clientId}`);
    const { businessId } = event.payload;
    const hoy = await this.hoyPara(businessId);
    await this.aplicar(event, "cliente nuevo", (manager) =>
      this.metricsService.incrementDailyMetric(
        businessId,
        hoy,
        { newClients: 1 },
        manager
      )
    );
  }

  /** Suma el importe del pago a los ingresos del día en que se cobra. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_PAYMENT_REGISTERED,
    queue: nombreDeCola("analytics", EventNames.PAYMENT_PAYMENT_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePaymentRegistered(event: PaymentRegisteredEvent): Promise<void> {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);
    const { businessId, amount } = event.payload;
    const hoy = await this.hoyPara(businessId);
    await this.aplicar(event, "pago", (manager) =>
      this.metricsService.incrementDailyMetric(
        businessId,
        hoy,
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
    const hoy = await this.hoyPara(businessId);
    await this.aplicar(event, "reseña", (manager) =>
      this.metricsService.setProfessionalRating(
        businessId,
        professionalId,
        hoy,
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
