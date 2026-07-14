import { Injectable, Logger } from "@nestjs/common";
import { EventPattern, Payload } from "@nestjs/microservices";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import {
  UserRegisteredEvent,
  PasswordResetRequestedEvent,
  AppointmentConfirmedEvent,
  AppointmentCancelledEvent,
  AppointmentReminderDueEvent,
  InvoiceGeneratedEvent,
  PaymentRegisteredEvent,
  EventNames,
} from "@beautyspot/event-types";

@Injectable()
export class NotificationEventListeners {
  private readonly logger = new Logger(NotificationEventListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
    private readonly dataEnricher: DataEnricherService
  ) {}

  @EventPattern(EventNames.AUTH_USER_REGISTERED)
  async handleUserRegistered(@Payload() event: UserRegisteredEvent) {
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
    try {
      const { jobId } = await this.emailService.queueWelcomeEmail(
        event.payload.email,
        { clientName: event.payload.name }
      );

      await this.emitEmailQueuedEvent(
        jobId,
        event.payload.email,
        "welcome-email",
        "Bienvenido a BeautySpot"
      );
    } catch (error) {
      this.logError("bienvenida", error);
    }
  }

  @EventPattern(EventNames.AUTH_PASSWORD_RESET_REQUESTED)
  async handlePasswordResetRequested(
    @Payload() event: PasswordResetRequestedEvent
  ) {
    const { email, name, resetToken, expiresAt } = event.payload;

    this.logger.log(`Solicitud de reset de contraseña para: ${email}`);

    try {
      const appUrl = this.configService.get<string>(
        "APP_URL",
        "http://localhost:3000"
      );
      const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
      const expiryHours = Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
      );

      const { jobId } = await this.emailService.queuePasswordReset(email, {
        clientName: name,
        resetLink,
        expiryHours,
      });

      await this.emitEmailQueuedEvent(
        jobId,
        email,
        "password-reset",
        "Restablecer contraseña - BeautySpot"
      );
    } catch (error) {
      this.logError("reset de contraseña", error);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CONFIRMED)
  async handleAppointmentConfirmed(
    @Payload() event: AppointmentConfirmedEvent
  ) {
    const {
      appointmentId,
      clientId,
      professionalId,
      businessId,
      date,
      startTime,
    } = event.payload;

    this.logger.log(`Cita confirmada: ${appointmentId}`);

    try {
      const data = await this.dataEnricher.enrichAppointmentParticipants(
        clientId,
        professionalId,
        businessId
      );

      const { jobId } = await this.emailService.queueAppointmentConfirmation(
        data.clientEmail,
        {
          clientName: data.clientName,
          professionalName: data.professionalName,
          serviceName: "Servicio",
          appointmentDate: date,
          appointmentTime: startTime,
          businessName: data.businessName,
          businessAddress: data.businessAddress,
          businessPhone: data.businessPhone,
        }
      );

      await this.emitEmailQueuedEvent(
        jobId,
        data.clientEmail,
        "appointment-confirmed",
        `Confirmación de cita en ${data.businessName}`
      );
    } catch (error) {
      this.logError("confirmación", error);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(
    @Payload() event: AppointmentCancelledEvent
  ) {
    const {
      appointmentId,
      cancelReason,
      date,
      clientId,
      professionalId,
      businessId,
    } = event.payload;

    this.logger.log(
      `Cita cancelada: ${appointmentId}, motivo: ${cancelReason}`
    );

    try {
      const data = await this.dataEnricher.enrichAppointmentParticipants(
        clientId,
        professionalId,
        businessId
      );

      const { jobId } = await this.emailService.queueAppointmentCancelled(
        data.clientEmail,
        {
          clientName: data.clientName,
          professionalName: data.professionalName,
          serviceName: "Servicio",
          cancelledDate: date,
          reason: cancelReason || "Sin motivo",
          businessName: data.businessName,
        }
      );

      await this.emitEmailQueuedEvent(
        jobId,
        data.clientEmail,
        "appointment-cancelled",
        `Cita cancelada - ${data.businessName}`
      );
    } catch (error) {
      this.logError("cancelación", error);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_REMINDER_DUE)
  async handleAppointmentReminder(
    @Payload() event: AppointmentReminderDueEvent
  ) {
    const {
      appointmentId,
      date,
      startTime,
      clientId,
      professionalId,
      businessId,
    } = event.payload;

    this.logger.log(`Recordatorio de cita pendiente: ${appointmentId}`);

    try {
      const reminderType = this.determineReminderType(date, startTime);
      if (!reminderType) return;

      const data = await this.dataEnricher.enrichAppointmentParticipants(
        clientId,
        professionalId,
        businessId
      );

      if (reminderType === "24h") {
        const { jobId } = await this.emailService.queueAppointmentReminder24h(
          data.clientEmail,
          {
            clientName: data.clientName,
            professionalName: data.professionalName,
            serviceName: "Servicio",
            appointmentDate: date,
            appointmentTime: startTime,
            businessName: data.businessName,
            businessAddress: data.businessAddress,
          }
        );

        await this.emitEmailQueuedEvent(
          jobId,
          data.clientEmail,
          "appointment-reminder-24h",
          `Recordatorio - Cita mañana en ${data.businessName}`
        );
      } else {
        const { jobId } = await this.emailService.queueAppointmentReminder1h(
          data.clientEmail,
          {
            clientName: data.clientName,
            professionalName: data.professionalName,
            serviceName: "Servicio",
            appointmentTime: startTime,
            businessName: data.businessName,
          }
        );

        await this.emitEmailQueuedEvent(
          jobId,
          data.clientEmail,
          "appointment-reminder-1h",
          `Recordatorio - Cita en 1 hora en ${data.businessName}`
        );
      }
    } catch (error) {
      this.logError("recordatorio de cita", error);
    }
  }

  @EventPattern(EventNames.PAYMENT_INVOICE_GENERATED)
  async handleInvoiceGenerated(@Payload() event: InvoiceGeneratedEvent) {
    const { invoiceId, number, total, clientId, businessId } = event.payload;

    this.logger.log(`Factura generada: ${invoiceId}`);

    try {
      const [clientEmail, businessData] = await Promise.all([
        this.dataEnricher.enrichClientEmail(clientId),
        this.dataEnricher.enrichBusinessData(businessId),
      ]);

      const { jobId } = await this.emailService.queueInvoice(clientEmail, {
        clientName: "Cliente",
        invoiceNumber: number.toString(),
        amount: total,
        dueDate: new Date().toISOString().split("T")[0],
        businessName: businessData.businessName,
        services: [],
      });

      await this.emitEmailQueuedEvent(
        jobId,
        clientEmail,
        "invoice-generated",
        `Factura #${number} - ${businessData.businessName}`
      );
    } catch (error) {
      this.logError("factura", error);
    }
  }

  @EventPattern(EventNames.PAYMENT_PAYMENT_REGISTERED)
  async handlePaymentRegistered(@Payload() event: PaymentRegisteredEvent) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);

    try {
      if (
        event.payload.method === "transfer" ||
        event.payload.method === "efectivo"
      ) {
        const { clientId, businessId, paymentId, amount } = event.payload;
        const [clientEmail, businessData] = await Promise.all([
          this.dataEnricher.enrichClientEmail(clientId),
          this.dataEnricher.enrichBusinessData(businessId),
        ]);

        const { jobId } = await this.emailService.queueInvoice(clientEmail, {
          clientName: "Cliente",
          invoiceNumber: `REC-${paymentId}`,
          amount,
          dueDate: new Date().toISOString().split("T")[0],
          businessName: businessData.businessName,
          services: [{ name: "Servicio", price: amount }],
        });

        await this.emitEmailQueuedEvent(
          jobId,
          clientEmail,
          "invoice-generated",
          `Recibo de pago - ${businessData.businessName}`
        );
      }
    } catch (error) {
      this.logError("pago", error);
    }
  }

  private determineReminderType(
    appointmentDate: string,
    appointmentTime: string
  ): "24h" | "1h" | null {
    const appointmentDateTime = new Date(
      `${appointmentDate}T${appointmentTime}`
    );
    const now = new Date();
    const diffMs = appointmentDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 1.5 && diffHours >= 0.5) {
      return "1h";
    } else if (diffHours <= 25 && diffHours >= 23) {
      return "24h";
    }

    return null;
  }

  private async emitEmailQueuedEvent(
    jobId: string,
    to: string,
    template: string,
    subject: string
  ) {
    try {
      await this.amqpConnection.publish(
        "beautyspot.events",
        "notification.email.queued",
        {
          eventType: "notification.email.queued",
          timestamp: new Date(),
          correlationId: jobId,
          payload: { jobId, to, template, subject },
        }
      );
    } catch (error) {
      this.logError("publicación email.queued", error);
    }
  }

  private logError(context: string, error: unknown): void {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Error enviando email de ${context}: ${message}`, stack);
  }
}
