import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  UserRegisteredEvent,
  BusinessCreatedEvent,
  ProfessionalCreatedEvent,
  PaymentRegisteredEvent,
  AppointmentReminderDueEvent,
  EventNames,
} from "@beautyspot/event-types";
import { AvailabilityService } from "../availability/availability.service";

/** Escucha eventos de RabbitMQ que afectan a las reservas (altas, pagos y recordatorios). */
@Injectable()
export class BookingEventListeners {
  private readonly logger = new Logger(BookingEventListeners.name);

  constructor(private readonly availabilityService: AvailabilityService) {}

  /** Reacciona al alta de un usuario. */
  @EventPattern(EventNames.AUTH_USER_REGISTERED)
  async handleUserRegistered(@Payload() event: UserRegisteredEvent) {
    // El contrato de AUTH_USER_REGISTERED no incluye `role`, así que aquí no se
    // puede distinguir el tipo de usuario (ver payload en event-types).
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
  }

  /** Reacciona a la creación de un negocio. */
  @EventPattern(EventNames.CORE_BUSINESS_CREATED)
  async handleBusinessCreated(@Payload() event: BusinessCreatedEvent) {
    this.logger.log(`Negocio creado: ${event.payload.businessId}`);
    try {
      const { businessId } = event.payload;
      this.logger.log(`Negocio ${businessId} creado en Booking Service`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando negocio creado: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Al crearse un profesional, le inicializa una disponibilidad semanal por defecto (L-D, 09:00–18:00). */
  @EventPattern(EventNames.CORE_PROFESSIONAL_CREATED)
  async handleProfessionalCreated(@Payload() event: ProfessionalCreatedEvent) {
    this.logger.log(`Profesional creado: ${event.payload.professionalId}`);
    try {
      const { professionalId, businessId } = event.payload;

      const weeklySlots = Array.from({ length: 7 }, (_, day) => ({
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
      }));

      await this.availabilityService.replaceWeekly(
        businessId,
        professionalId,
        weeklySlots
      );

      this.logger.log(
        `Disponibilidad semanal creada para profesional ${professionalId}`
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
  @EventPattern(EventNames.PAYMENT_PAYMENT_REGISTERED)
  async handlePaymentRegistered(@Payload() event: PaymentRegisteredEvent) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);
    try {
      const { appointmentId, amount, method } = event.payload;

      if (appointmentId) {
        this.logger.log(
          `Pago vinculado a cita ${appointmentId}: ${amount} COP (${method})`
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando pago registrado: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Reacciona a un recordatorio de cita que toca enviar. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_REMINDER_DUE)
  async handleAppointmentReminderDue(
    @Payload() event: AppointmentReminderDueEvent
  ) {
    this.logger.log(
      `Recordatorio de cita pendiente: ${event.payload.appointmentId}`
    );
    try {
      const { appointmentId, date, startTime } = event.payload;
      this.logger.log(
        `Recordatorio programado para cita ${appointmentId} el ${date} a las ${startTime}`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error programando recordatorio: ${errorMessage}`,
        errorStack
      );
    }
  }
}
