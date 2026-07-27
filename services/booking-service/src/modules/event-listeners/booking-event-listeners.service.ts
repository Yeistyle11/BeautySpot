import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  UserRegisteredEvent,
  BusinessCreatedEvent,
  ProfessionalCreatedEvent,
  PaymentRegisteredEvent,
  AppointmentReminderDueEvent,
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

  /** Reacciona al alta de un usuario. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_USER_REGISTERED,
    queue: nombreDeCola("booking", EventNames.AUTH_USER_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleUserRegistered(event: UserRegisteredEvent) {
    // El contrato de AUTH_USER_REGISTERED no incluye `role`, así que aquí no se
    // puede distinguir el tipo de usuario (ver payload en event-types).
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
  }

  /** Reacciona a la creación de un negocio. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_BUSINESS_CREATED,
    queue: nombreDeCola("booking", EventNames.CORE_BUSINESS_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleBusinessCreated(event: BusinessCreatedEvent) {
    const { businessId } = event.payload;
    this.logger.log(`Negocio creado: ${businessId}`);
    this.logger.log(`Negocio ${businessId} creado en Booking Service`);
  }

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

  /** Reacciona a un pago registrado, vinculándolo a su cita cuando aplica. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_PAYMENT_REGISTERED,
    queue: nombreDeCola("booking", EventNames.PAYMENT_PAYMENT_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePaymentRegistered(event: PaymentRegisteredEvent) {
    const { paymentId, appointmentId, amount, method } = event.payload;
    this.logger.log(`Pago registrado: ${paymentId}`);

    // Un pago puede no estar ligado a una cita (p. ej. venta de producto).
    if (appointmentId) {
      this.logger.log(
        `Pago vinculado a cita ${appointmentId}: ${amount} COP (${method})`
      );
    }
  }

  /** Reacciona a un recordatorio de cita que toca enviar. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_REMINDER_DUE,
    queue: nombreDeCola("booking", EventNames.BOOKING_APPOINTMENT_REMINDER_DUE),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentReminderDue(event: AppointmentReminderDueEvent) {
    const { appointmentId, date, startTime } = event.payload;
    this.logger.log(`Recordatorio de cita pendiente: ${appointmentId}`);
    this.logger.log(
      `Recordatorio programado para cita ${appointmentId} el ${date} a las ${startTime}`
    );
  }
}
