import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { NotificationType } from "@beautyspot/shared-types";
import {
  ReviewCreatedEvent,
  ClientBirthdayEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { AvisosService } from "./avisos.service";

/**
 * La relación con el cliente fuera de la cita y del cobro: la reseña que deja y
 * la felicitación de su cumpleaños.
 */
@Injectable()
export class ClienteListeners {
  private readonly logger = new Logger(ClienteListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly processedEvents: ProcessedEventsStore,
    private readonly dataEnricher: DataEnricherService,
    private readonly avisos: AvisosService
  ) {}

  /**
   * Avisa al negocio de que le han dejado una resena, solo dentro de la
   * aplicacion.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.MARKETPLACE_REVIEW_CREATED,
    queue: nombreDeCola("notification", EventNames.MARKETPLACE_REVIEW_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleReviewCreated(event: ReviewCreatedEvent) {
    const { reviewId, businessId, rating, comment } = event.payload;

    this.logger.log(`Reseña recibida: ${reviewId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:reseña",
        async () => {
          await this.avisos.avisarAlNegocio(
            businessId,
            NotificationType.REVIEW_RECEIVED,
            "Nueva reseña",
            `Tu negocio recibió una reseña de ${rating} ${
              rating === 1 ? "estrella" : "estrellas"
            }.`,
            { reviewId, rating, comment }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("reseña", error);
    }
  }

  /**
   * Felicita al cliente el dia de su cumpleanos, por correo y dentro de la
   * aplicacion. El correo sale aunque no tenga cuenta.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_CLIENT_BIRTHDAY,
    queue: nombreDeCola("notification", EventNames.CORE_CLIENT_BIRTHDAY),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleClientBirthday(event: ClientBirthdayEvent) {
    const { clientId, businessId, name, email, year } = event.payload;

    this.logger.log(`Cumpleaños del cliente: ${clientId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:cumpleaños",
        async () => {
          const [businessData, clientUserId] = await Promise.all([
            this.dataEnricher.enrichBusinessData(businessId),
            this.dataEnricher.enrichClientUserId(clientId),
          ]);

          if (email) {
            const { jobId } = await this.emailService.queueBirthdayGreeting(
              email,
              {
                clientName: name,
                businessName: businessData.businessName,
                year,
              }
            );

            await this.avisos.emitEmailQueuedEvent(
              jobId,
              email,
              "birthday-greeting",
              `¡Feliz cumpleaños de parte de ${businessData.businessName}!`
            );
          }

          await this.avisos.avisarEnLaApp(
            clientUserId,
            businessId,
            NotificationType.BIRTHDAY,
            "¡Feliz cumpleaños!",
            `En ${businessData.businessName} te deseamos un feliz día.`,
            { clientId, year }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("cumpleaños", error);
    }
  }
}
