import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import {
  AppointmentCompletedEvent,
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
   * Acredita al cliente los puntos que la cita atendida generó.
   *
   * Va dentro de `once` porque acreditar dos veces regala dinero, y el
   * incremento comparte la transacción con la marca de procesado para que no
   * pueda quedar uno sin el otro.
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
}
