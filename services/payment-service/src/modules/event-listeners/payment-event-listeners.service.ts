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
    const { appointmentId, totalAmount } = event.payload;
    this.logger.log(`Cita creada: ${appointmentId}`);
    this.logger.log(
      `Pendiente de pago para cita ${appointmentId}: ${totalAmount} COP`
    );
  }

  /** Reacciona a una cita confirmada (a la espera de pago). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CONFIRMED)
  async handleAppointmentConfirmed(
    @Payload() event: AppointmentConfirmedEvent
  ) {
    const { appointmentId } = event.payload;
    this.logger.log(`Cita confirmada: ${appointmentId}`);
    this.logger.log(`Cita ${appointmentId} confirmada, esperando pago`);
  }

  /** Reacciona a una cita completada (queda con pago pendiente de registrar). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(
    @Payload() event: AppointmentCompletedEvent
  ) {
    const { appointmentId } = event.payload;
    this.logger.log(`Cita completada: ${appointmentId}`);
    this.logger.log(`Cita ${appointmentId} completada con pago pendiente`);
  }

  /** Reacciona a una cita cancelada. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(
    @Payload() event: AppointmentCancelledEvent
  ) {
    const { appointmentId, cancelReason } = event.payload;
    this.logger.log(`Cita cancelada: ${appointmentId}`);
    this.logger.log(`Cita ${appointmentId} cancelada. Razon: ${cancelReason}`);
  }
}
