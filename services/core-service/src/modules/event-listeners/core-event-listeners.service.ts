import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import {
  AppointmentCompletedEvent,
  AppointmentNoShowedEvent,
  PointsRedeemedEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { ClientsService } from "../clients/clients.service";

/** Aplica al cliente los efectos que otros servicios provocan sobre su ficha. */
@Injectable()
export class CoreEventListeners {
  private readonly logger = new Logger(CoreEventListeners.name);

  constructor(
    private readonly clients: ClientsService,
    private readonly processedEvents: ProcessedEventsStore
  ) {}

  /**
   * Acredita al cliente los puntos que la cita atendida genero, dentro de
   * `once` y compartiendo transaccion con la marca de procesado.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_COMPLETED,
    queue: nombreDeCola("core", EventNames.BOOKING_APPOINTMENT_COMPLETED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCompleted(
    event: AppointmentCompletedEvent
  ): Promise<void> {
    const { appointmentId, clientId, businessId, pointsEarned } = event.payload;

    if (!pointsEarned || pointsEarned <= 0) {
      this.logger.debug(
        `La cita ${appointmentId} no genero puntos: no hay nada que acreditar`
      );
      return;
    }

    await this.processedEvents.once(
      event,
      "core:puntos de fidelidad",
      async (manager) => {
        await this.clients.addLoyaltyPoints(
          clientId,
          businessId,
          pointsEarned,
          manager
        );
      }
    );

    this.logger.log(
      `Acreditados ${pointsEarned} puntos al cliente ${clientId} por la cita ${appointmentId}`
    );
  }

  /**
   * Deja constancia del canje. El saldo lo descuenta el propio cobro contra
   * `/internal/clients/:id/puntos/reservar` antes de registrarse, porque el
   * descuento decide el importe y no puede resolverse después: hacerlo aquí
   * dejaría que dos cobros simultáneos gastaran el mismo saldo.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_POINTS_REDEEMED,
    queue: nombreDeCola("core", EventNames.PAYMENT_POINTS_REDEEMED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePointsRedeemed(event: PointsRedeemedEvent): Promise<void> {
    const { paymentId, clientId, points } = event.payload;

    this.logger.log(
      `Canjeados ${points} puntos del cliente ${clientId} en el cobro ${paymentId}`
    );
  }

  /** Suma una falta al cliente que no se presentó. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_NO_SHOWED,
    queue: nombreDeCola("core", EventNames.BOOKING_APPOINTMENT_NO_SHOWED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentNoShowed(
    event: AppointmentNoShowedEvent
  ): Promise<void> {
    const { clientId, businessId } = event.payload;

    await this.processedEvents.once(
      event,
      "core:falta del cliente",
      async (manager) => {
        await this.clients.addNoShow(clientId, businessId, manager);
      }
    );
  }
}
