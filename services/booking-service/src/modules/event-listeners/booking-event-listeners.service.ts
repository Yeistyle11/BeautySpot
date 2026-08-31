import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  ClientMergedEvent,
  ProfessionalCreatedEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { AvailabilityService } from "../availability/availability.service";
import { Appointment } from "../../entities/appointment.entity";

/** Escucha eventos de RabbitMQ que afectan a las reservas (altas, pagos y recordatorios). */
@Injectable()
export class BookingEventListeners {
  private readonly logger = new Logger(BookingEventListeners.name);

  constructor(
    private readonly availabilityService: AvailabilityService,
    private readonly processedEvents: ProcessedEventsStore,
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>
  ) {}

  /**
   * Al crearse un profesional, le inicializa una disponibilidad semanal por
   * defecto (L-D, 09:00–18:00), una sola vez: {@link ProcessedEventsStore}
   * evita que una reentrega pise los horarios que el negocio haya ajustado.
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
      // Se relanza para que el mensaje acabe en la cola de fallidos. Darlo por
      // consumido dejaría al profesional sin disponibilidad semanal en
      // silencio, y el negocio solo lo notaría al no poder agendar con él.
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  /**
   * Dos fichas del mismo cliente pasaron a ser una: las citas de la absorbida
   * quedan colgando de la ficha buena, que es donde el negocio va a mirar el
   * historial.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_CLIENT_MERGED,
    queue: nombreDeCola("booking", EventNames.CORE_CLIENT_MERGED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleClientMerged(event: ClientMergedEvent): Promise<void> {
    const { businessId, supervivienteId, absorbidoId } = event.payload;

    // Reasignar es idempotente: una reentrega no encuentra ya nada que mover.
    const { affected } = await this.apptRepo.update(
      { businessId, clientId: absorbidoId },
      { clientId: supervivienteId }
    );

    this.logger.log(
      `Fusión de clientes ${absorbidoId} → ${supervivienteId}: ${affected ?? 0} las citas reasignadas`
    );
  }
}
