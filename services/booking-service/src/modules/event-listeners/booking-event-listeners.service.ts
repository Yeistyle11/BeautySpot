import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { EventNames } from "@beautyspot/event-types";
import { AvailabilityService } from "../availability/availability.service";

@Injectable()
export class BookingEventListeners {
  private readonly logger = new Logger(BookingEventListeners.name);

  constructor(
    private readonly availabilityService: AvailabilityService,
  ) {}

  @EventPattern(EventNames.AUTH_USER_REGISTERED)
  async handleUserRegistered(@Payload() event: any) {
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
    try {
      if (event.payload.role === "CLIENT") {
        this.logger.log(`Cliente registrado en Booking Service: ${event.payload.email}`);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando usuario registrado: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.CORE_BUSINESS_CREATED)
  async handleBusinessCreated(@Payload() event: any) {
    this.logger.log(`Negocio creado: ${event.payload.businessId}`);
    try {
      const { businessId } = event.payload;
      this.logger.log(`Negocio ${businessId} creado en Booking Service`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando negocio creado: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.CORE_PROFESSIONAL_CREATED)
  async handleProfessionalCreated(@Payload() event: any) {
    this.logger.log(`Profesional creado: ${event.payload.professionalId}`);
    try {
      const { professionalId, businessId } = event.payload;

      const weeklySlots = Array.from({ length: 7 }, (_, day) => ({
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
      }));

      await this.availabilityService.replaceWeekly(businessId, professionalId, weeklySlots);

      this.logger.log(`Disponibilidad semanal creada para profesional ${professionalId}`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error creando disponibilidad: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.PAYMENT_PAYMENT_REGISTERED)
  async handlePaymentRegistered(@Payload() event: any) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);
    try {
      const { appointmentId, amount, method } = event.payload;

      if (appointmentId) {
        this.logger.log(`Pago vinculado a cita ${appointmentId}: ${amount} COP (${method})`);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando pago registrado: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_REMINDER_DUE)
  async handleAppointmentReminderDue(@Payload() event: any) {
    this.logger.log(`Recordatorio de cita pendiente: ${event.payload.appointmentId}`);
    try {
      const { appointmentId, date, startTime } = event.payload;
      this.logger.log(`Recordatorio programado para cita ${appointmentId} el ${date} a las ${startTime}`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error programando recordatorio: ${errorMessage}`, errorStack);
    }
  }
}