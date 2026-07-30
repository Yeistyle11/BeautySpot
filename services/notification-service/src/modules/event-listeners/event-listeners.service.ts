import { randomUUID } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
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
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";

/**
 * Escucha los eventos de dominio de otros servicios y, según cada uno, enriquece
 * los datos y encola el correo correspondiente (bienvenida, recordatorios, etc.).
 */
@Injectable()
export class NotificationEventListeners {
  private readonly logger = new Logger(NotificationEventListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
    private readonly dataEnricher: DataEnricherService,
    private readonly processedEvents: ProcessedEventsStore
  ) {}

  /** Al registrarse un usuario, encola el correo de bienvenida. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_USER_REGISTERED,
    queue: nombreDeCola("notification", EventNames.AUTH_USER_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
    try {
      await this.processedEvents.once(
        event,
        "notification:bienvenida",
        async () => {
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
        }
      );
    } catch (error) {
      this.logError("bienvenida", error);
    }
  }

  /** Ante una solicitud de reset, arma el enlace con vencimiento y encola el correo. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_PASSWORD_RESET_REQUESTED,
    queue: nombreDeCola(
      "notification",
      EventNames.AUTH_PASSWORD_RESET_REQUESTED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    const { email, name, resetToken, expiresAt } = event.payload;

    this.logger.log(`Solicitud de reset de contraseña para: ${email}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:reset de contraseña",
        async () => {
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
        }
      );
    } catch (error) {
      this.logError("reset de contraseña", error);
    }
  }

  /** Al confirmarse una cita, encola el correo de confirmación con los datos enriquecidos. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_CONFIRMED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentConfirmed(event: AppointmentConfirmedEvent) {
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
      await this.processedEvents.once(
        event,
        "notification:confirmación",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          const { jobId } =
            await this.emailService.queueAppointmentConfirmation(
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
        }
      );
    } catch (error) {
      this.logError("confirmación", error);
    }
  }

  /** Al cancelarse una cita, encola el correo de cancelación al cliente. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CANCELLED,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_CANCELLED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCancelled(event: AppointmentCancelledEvent) {
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
      await this.processedEvents.once(
        event,
        "notification:cancelación",
        async () => {
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
        }
      );
    } catch (error) {
      this.logError("cancelación", error);
    }
  }

  /** Ante un recordatorio pendiente, decide si es de 24h o 1h y encola el correo adecuado. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_REMINDER_DUE,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_REMINDER_DUE
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentReminder(event: AppointmentReminderDueEvent) {
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
      await this.processedEvents.once(
        event,
        "notification:recordatorio de cita",
        async () => {
          const reminderType = this.determineReminderType(date, startTime);
          if (!reminderType) return;

          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          if (reminderType === "24h") {
            const { jobId } =
              await this.emailService.queueAppointmentReminder24h(
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
            const { jobId } =
              await this.emailService.queueAppointmentReminder1h(
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
        }
      );
    } catch (error) {
      this.logError("recordatorio de cita", error);
    }
  }

  /** Al generarse una factura, encola su envío por correo al cliente. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_INVOICE_GENERATED,
    queue: nombreDeCola("notification", EventNames.PAYMENT_INVOICE_GENERATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleInvoiceGenerated(event: InvoiceGeneratedEvent) {
    const { invoiceId, number, total, clientId, businessId } = event.payload;

    this.logger.log(`Factura generada: ${invoiceId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:factura",
        async () => {
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
        }
      );
    } catch (error) {
      this.logError("factura", error);
    }
  }

  /** Ante un pago en efectivo o transferencia, encola el recibo por correo. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.PAYMENT_PAYMENT_REGISTERED,
    queue: nombreDeCola("notification", EventNames.PAYMENT_PAYMENT_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePaymentRegistered(event: PaymentRegisteredEvent) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);

    try {
      await this.processedEvents.once(event, "notification:pago", async () => {
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
      });
    } catch (error) {
      this.logError("pago", error);
    }
  }

  /** Decide si el recordatorio corresponde a la ventana de 24h, la de 1h, o ninguna. */
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

  /** Publica en RabbitMQ el evento de correo encolado, para trazabilidad. */
  private async emitEmailQueuedEvent(
    jobId: string,
    to: string,
    template: string,
    subject: string
  ) {
    try {
      await this.amqpConnection.publish(
        EVENTS_EXCHANGE,
        "notification.email.queued",
        {
          // Se publica directamente por AmqpConnection, sin pasar por
          // EventBusService, así que el eventId hay que ponerlo aquí para
          // cumplir el contrato de IBaseEvent.
          eventId: randomUUID(),
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

  /** Registra en log un error de envío de correo con su contexto. */
  /**
   * Registra el fallo y lo vuelve a lanzar.
   *
   * Sin relanzar, el mensaje se daba por consumido y nunca llegaba a la cola de
   * fallidos, pese a que todas las colas la declaran: la DLQ estaba configurada
   * pero no recibía nada, y un correo perdido se quedaba en un renglón del log.
   */
  private logError(context: string, error: unknown): never {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Error enviando email de ${context}: ${message}`, stack);
    throw error instanceof Error ? error : new Error(message);
  }
}
