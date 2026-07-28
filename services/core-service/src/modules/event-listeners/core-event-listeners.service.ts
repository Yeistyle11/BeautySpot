import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  UserRegisteredEvent,
  MembershipCreatedEvent,
  MembershipRoleChangedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";

/** Escucha los eventos de RabbitMQ relevantes para el core (usuarios, membresías y citas). */
@Injectable()
export class CoreEventListeners {
  private readonly logger = new Logger(CoreEventListeners.name);

  /** Reacciona al alta de un usuario. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_USER_REGISTERED,
    queue: nombreDeCola("core", EventNames.AUTH_USER_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleUserRegistered(event: UserRegisteredEvent) {
    // El contrato de AUTH_USER_REGISTERED no incluye `role`, por lo que aquí
    // no se puede distinguir el tipo de usuario (ver payload en event-types).
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
  }

  /** Reacciona a la creación de una membresía en un negocio. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_MEMBERSHIP_CREATED,
    queue: nombreDeCola("core", EventNames.AUTH_MEMBERSHIP_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleMembershipCreated(event: MembershipCreatedEvent) {
    const { membershipId, businessId, role } = event.payload;
    this.logger.log(`Membresia creada: ${membershipId}`);
    this.logger.log(
      `Membresia creada en negocio ${businessId} con rol ${role}`
    );
  }

  /** Reacciona al cambio de rol de una membresía. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_MEMBERSHIP_ROLE_CHANGED,
    queue: nombreDeCola("core", EventNames.AUTH_MEMBERSHIP_ROLE_CHANGED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleMembershipRoleChanged(event: MembershipRoleChangedEvent) {
    const { membershipId, businessId, previousRole, newRole } = event.payload;
    this.logger.log(`Rol de membresia cambiado: ${membershipId}`);
    this.logger.log(
      `Usuario cambió de rol ${previousRole} a ${newRole} en negocio ${businessId}`
    );
  }

  /** Reacciona a una cita completada (p. ej. puntos de fidelidad ganados). */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_COMPLETED,
    queue: nombreDeCola("core", EventNames.BOOKING_APPOINTMENT_COMPLETED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCompleted(event: AppointmentCompletedEvent) {
    const { appointmentId, clientId, pointsEarned } = event.payload;
    this.logger.log(`Cita completada: ${appointmentId}`);
    this.logger.log(
      `Cita ${appointmentId} completada. Cliente ${clientId} ganó ${pointsEarned} puntos`
    );
  }

  /** Reacciona a una cita cancelada. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CANCELLED,
    queue: nombreDeCola("core", EventNames.BOOKING_APPOINTMENT_CANCELLED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCancelled(event: AppointmentCancelledEvent) {
    const { appointmentId, clientId, cancelReason } = event.payload;
    this.logger.log(`Cita cancelada: ${appointmentId}`);
    this.logger.log(
      `Cita ${appointmentId} cancelada por cliente ${clientId}. Razon: ${cancelReason}`
    );
  }
}
