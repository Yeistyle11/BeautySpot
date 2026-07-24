import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import {
  UserRegisteredEvent,
  MembershipCreatedEvent,
  MembershipRoleChangedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  EventNames,
} from "@beautyspot/event-types";

/** Escucha los eventos de RabbitMQ relevantes para el core (usuarios, membresías y citas). */
@Injectable()
export class CoreEventListeners {
  private readonly logger = new Logger(CoreEventListeners.name);

  /** Reacciona al alta de un usuario. */
  @EventPattern(EventNames.AUTH_USER_REGISTERED)
  async handleUserRegistered(@Payload() event: UserRegisteredEvent) {
    // El contrato de AUTH_USER_REGISTERED no incluye `role`, por lo que aquí
    // no se puede distinguir el tipo de usuario (ver payload en event-types).
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
  }

  /** Reacciona a la creación de una membresía en un negocio. */
  @EventPattern(EventNames.AUTH_MEMBERSHIP_CREATED)
  async handleMembershipCreated(@Payload() event: MembershipCreatedEvent) {
    const { membershipId, businessId, role } = event.payload;
    this.logger.log(`Membresia creada: ${membershipId}`);
    this.logger.log(
      `Membresia creada en negocio ${businessId} con rol ${role}`
    );
  }

  /** Reacciona al cambio de rol de una membresía. */
  @EventPattern(EventNames.AUTH_MEMBERSHIP_ROLE_CHANGED)
  async handleMembershipRoleChanged(
    @Payload() event: MembershipRoleChangedEvent
  ) {
    const { membershipId, businessId, previousRole, newRole } = event.payload;
    this.logger.log(`Rol de membresia cambiado: ${membershipId}`);
    this.logger.log(
      `Usuario cambió de rol ${previousRole} a ${newRole} en negocio ${businessId}`
    );
  }

  /** Reacciona a una cita completada (p. ej. puntos de fidelidad ganados). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(
    @Payload() event: AppointmentCompletedEvent
  ) {
    const { appointmentId, clientId, pointsEarned } = event.payload;
    this.logger.log(`Cita completada: ${appointmentId}`);
    this.logger.log(
      `Cita ${appointmentId} completada. Cliente ${clientId} ganó ${pointsEarned} puntos`
    );
  }

  /** Reacciona a una cita cancelada. */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(
    @Payload() event: AppointmentCancelledEvent
  ) {
    const { appointmentId, clientId, cancelReason } = event.payload;
    this.logger.log(`Cita cancelada: ${appointmentId}`);
    this.logger.log(
      `Cita ${appointmentId} cancelada por cliente ${clientId}. Razon: ${cancelReason}`
    );
  }
}
