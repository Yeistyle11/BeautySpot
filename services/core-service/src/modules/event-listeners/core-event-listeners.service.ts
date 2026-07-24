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
    this.logger.log(`Membresia creada: ${event.payload.membershipId}`);
    try {
      const { businessId, role } = event.payload;
      this.logger.log(
        `Membresia creada en negocio ${businessId} con rol ${role}`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando membresia creada: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Reacciona al cambio de rol de una membresía. */
  @EventPattern(EventNames.AUTH_MEMBERSHIP_ROLE_CHANGED)
  async handleMembershipRoleChanged(
    @Payload() event: MembershipRoleChangedEvent
  ) {
    this.logger.log(`Rol de membresia cambiado: ${event.payload.membershipId}`);
    try {
      const { businessId, previousRole, newRole } = event.payload;
      this.logger.log(
        `Usuario cambió de rol ${previousRole} a ${newRole} en negocio ${businessId}`
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error procesando cambio de rol: ${errorMessage}`,
        errorStack
      );
    }
  }

  /** Reacciona a una cita completada (p. ej. puntos de fidelidad ganados). */
  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(
    @Payload() event: AppointmentCompletedEvent
  ) {
    this.logger.log(`Cita completada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId, clientId, pointsEarned } = event.payload;
      this.logger.log(
        `Cita ${appointmentId} completada. Cliente ${clientId} ganó ${pointsEarned} puntos`
      );
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
      const { appointmentId, clientId, cancelReason } = event.payload;
      this.logger.log(
        `Cita ${appointmentId} cancelada por cliente ${clientId}. Razon: ${cancelReason}`
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
