import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  ProfessionalCreatedEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { AvailabilityService } from "../availability/availability.service";

/** Escucha eventos de RabbitMQ que afectan a las reservas (altas, pagos y recordatorios). */
@Injectable()
export class BookingEventListeners {
  private readonly logger = new Logger(BookingEventListeners.name);

  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly processedEvents: ProcessedEventsStore
  ) {}

  /**
   * Al crearse un profesional, le inicializa una disponibilidad semanal por
   * defecto (L-D, 09:00–18:00).
   *
   * Pasa por {@link ProcessedEventsStore} porque `replaceWeekly` borra y vuelve
   * a insertar: si el evento se reentrega cuando el negocio ya ha ajustado sus
   * horarios, le devolvería la disponibilidad al valor por defecto y perdería
   * el cambio. Que la operación deje el mismo estado no basta cuando ese estado
   * ya no es el que el usuario quiere.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_PROFESSIONAL_CREATED,
    queue: nombreDeCola("booking", EventNames.CORE_PROFESSIONAL_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleProfessionalCreated(event: ProfessionalCreatedEvent) {
    this.logger.log(`Profesional creado: ${event.payload.professionalId}`);
    try {
      const { professionalId, businessId } = event.payload;

      const weeklySlots = Array.from({ length: 7 }, (_, day) => ({
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
      }));

      const aplicado = await this.processedEvents.once(
        event,
        "booking:disponibilidad-inicial",
        async () => {
          await this.availabilityService.replaceWeekly(
            businessId,
            professionalId,
            weeklySlots
          );
        }
      );

      this.logger.log(
        aplicado
          ? `Disponibilidad semanal creada para profesional ${professionalId}`
          : `Disponibilidad de ${professionalId} ya inicializada, se ignora`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error creando disponibilidad: ${errorMessage}`,
        errorStack
      );
    }
  }
}
