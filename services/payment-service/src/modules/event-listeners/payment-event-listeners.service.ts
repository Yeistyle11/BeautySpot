import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  AppointmentCreatedEvent,
  AppointmentConfirmedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";

/** Escucha los eventos de citas para seguir su estado de cobro dentro del payment-service. */
@Injectable()
export class PaymentEventListeners {
  private readonly logger = new Logger(PaymentEventListeners.name);

  /** Reacciona a una cita creada (queda pendiente de pago). */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CREATED,
    queue: nombreDeCola("payment", EventNames.BOOKING_APPOINTMENT_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCreated(event: AppointmentCreatedEvent) {
    const { appointmentId, totalAmount } = event.payload;
    this.logger.log(`Cita creada: ${appointmentId}`);
    this.logger.log(
      `Pendiente de pago para cita ${appointmentId}: ${totalAmount} COP`
    );
  }

  /** Reacciona a una cita confirmada (a la espera de pago). */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
    queue: nombreDeCola("payment", EventNames.BOOKING_APPOINTMENT_CONFIRMED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentConfirmed(event: AppointmentConfirmedEvent) {
    const { appointmentId } = event.payload;
    this.logger.log(`Cita confirmada: ${appointmentId}`);
    this.logger.log(`Cita ${appointmentId} confirmada, esperando pago`);
  }

  /** Reacciona a una cita completada (queda con pago pendiente de registrar). */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_COMPLETED,
    queue: nombreDeCola("payment", EventNames.BOOKING_APPOINTMENT_COMPLETED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCompleted(event: AppointmentCompletedEvent) {
    const { appointmentId } = event.payload;
    this.logger.log(`Cita completada: ${appointmentId}`);
    this.logger.log(`Cita ${appointmentId} completada con pago pendiente`);
  }

  /** Reacciona a una cita cancelada. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CANCELLED,
    queue: nombreDeCola("payment", EventNames.BOOKING_APPOINTMENT_CANCELLED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCancelled(event: AppointmentCancelledEvent) {
    const { appointmentId, cancelReason } = event.payload;
    this.logger.log(`Cita cancelada: ${appointmentId}`);
    this.logger.log(`Cita ${appointmentId} cancelada. Razon: ${cancelReason}`);
  }
}
