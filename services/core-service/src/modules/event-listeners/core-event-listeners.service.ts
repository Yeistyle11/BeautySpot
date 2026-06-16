import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { EventNames } from "@beautyspot/event-types";

@Injectable()
export class CoreEventListeners {
  private readonly logger = new Logger(CoreEventListeners.name);

  @EventPattern(EventNames.AUTH_USER_REGISTERED)
  async handleUserRegistered(@Payload() event: any) {
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
    try {
      const { email, role } = event.payload;
      if (role === "CLIENT") {
        this.logger.log(`Cliente potencial detectado: ${email}`);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando usuario registrado: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.AUTH_MEMBERSHIP_CREATED)
  async handleMembershipCreated(@Payload() event: any) {
    this.logger.log(`Membresia creada: ${event.payload.membershipId}`);
    try {
      const { businessId, role } = event.payload;
      this.logger.log(`Membresia creada en negocio ${businessId} con rol ${role}`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando membresia creada: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.AUTH_MEMBERSHIP_ROLE_CHANGED)
  async handleMembershipRoleChanged(@Payload() event: any) {
    this.logger.log(`Rol de membresia cambiado: ${event.payload.membershipId}`);
    try {
      const { businessId, previousRole, newRole } = event.payload;
      this.logger.log(`Usuario cambió de rol ${previousRole} a ${newRole} en negocio ${businessId}`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando cambio de rol: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_COMPLETED)
  async handleAppointmentCompleted(@Payload() event: any) {
    this.logger.log(`Cita completada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId, clientId, pointsEarned } = event.payload;
      this.logger.log(`Cita ${appointmentId} completada. Cliente ${clientId} ganó ${pointsEarned} puntos`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando cita completada: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(@Payload() event: any) {
    this.logger.log(`Cita cancelada: ${event.payload.appointmentId}`);
    try {
      const { appointmentId, clientId, cancelReason } = event.payload;
      this.logger.log(`Cita ${appointmentId} cancelada por cliente ${clientId}. Razon: ${cancelReason}`);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error procesando cita cancelada: ${errorMessage}`, errorStack);
    }
  }
}