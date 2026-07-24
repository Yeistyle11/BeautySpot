import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  AppointmentCreatedEvent,
  AppointmentConfirmedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  EventNames,
} from "@beautyspot/event-types";

/** Escucha los eventos de citas para seguir su estado de cobro dentro del payment-service. */
@Injectable()
export class PaymentEventListeners {
  private readonly logger = new Logger(PaymentEventListeners.name);

  /** Reacciona a una cita creada (queda pendiente de pago). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CREATED)
  async handleAppointmentCreated(@Payload() event: AppointmentCreatedEvent) {
    this.logger.log(`Cita creada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId, totalAmount } = event.payload;
      this.logger.log(
        `Pendiente de pago para cita ${appointmentId}: ${totalAmount} COP`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando cita creada: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Reacciona a una cita confirmada (a la espera de pago). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CONFIRMED)
  async handleAppointmentConfirmed(
    @Payload() event: AppointmentConfirmedEvent
  ) {
    this.logger.log(`Cita confirmada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId } = event.payload;
      this.logger.log(`Cita ${appointmentId} confirmada, esperando pago`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando cita confirmada: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Reacciona a una cita completada (queda con pago pendiente de registrar). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(
    @Payload() event: AppointmentCompletedEvent
  ) {
    this.logger.log(`Cita completada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId } = event.payload;
      this.logger.log(`Cita ${appointmentId} completada con pago pendiente`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando cita completada: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Reacciona a una cita cancelada. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(
    @Payload() event: AppointmentCancelledEvent
  ) {
    this.logger.log(`Cita cancelada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId, cancelReason } = event.payload;
      this.logger.log(
        `Cita ${appointmentId} cancelada. Razon: ${cancelReason}`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando cita cancelada: ${errorMessage}`,
        errorStack
      );
    }
  }
}
