import { Injectable, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EmailService } from '../emails/email.service';
import {
  UserRegisteredEvent,
  AppointmentConfirmedEvent,
  AppointmentCancelledEvent,
  AppointmentReminderDueEvent,
  InvoiceGeneratedEvent,
  PaymentRegisteredEvent,
  EventNames,
} from '@beautyspot/event-types';

@Injectable()
export class NotificationEventListeners {
  private readonly logger = new Logger(NotificationEventListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @EventPattern(EventNames.AUTH_USER_REGISTERED)
  async handleUserRegistered(@Payload() event: UserRegisteredEvent) {
    this.logger.log(`Usuario registrado: ${event.payload.email}`);
    try {
      const { jobId } = await this.emailService.queueWelcomeEmail(event.payload.email, {
        clientName: event.payload.name,
      });

      await this.emitEmailQueuedEvent(
        jobId,
        event.payload.email,
        'welcome-email',
        'Bienvenido a BeautySpot',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email de bienvenida: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CONFIRMED)
  async handleAppointmentConfirmed(@Payload() event: AppointmentConfirmedEvent) {
    const { appointmentId, date, startTime } = event.payload;

    this.logger.log(`Cita confirmada: ${appointmentId}`);

    try {
      const { jobId } = await this.emailService.queueAppointmentConfirmation(
        'client@example.com',
        {
          clientName: 'Cliente',
          professionalName: 'Profesional',
          serviceName: 'Servicio',
          appointmentDate: date,
          appointmentTime: startTime,
          businessName: 'BeautySpot Business',
          businessAddress: 'Dirección',
          businessPhone: '+57 300 123 4567',
        },
      );

      await this.emitEmailQueuedEvent(
        jobId,
        'client@example.com',
        'appointment-confirmed',
        'Confirmación de cita',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email de confirmación: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_CANCELLED)
  async handleAppointmentCancelled(@Payload() event: AppointmentCancelledEvent) {
    const { appointmentId, cancelReason, date } = event.payload;

    this.logger.log(`Cita cancelada: ${appointmentId}, motivo: ${cancelReason}`);

    try {
      const { jobId } = await this.emailService.queueAppointmentCancelled(
        'client@example.com',
        {
          clientName: 'Cliente',
          professionalName: 'Profesional',
          serviceName: 'Servicio',
          cancelledDate: date,
          reason: cancelReason || 'Sin motivo',
          businessName: 'BeautySpot Business',
        },
      );

      await this.emitEmailQueuedEvent(
        jobId,
        'client@example.com',
        'appointment-cancelled',
        'Cita cancelada',
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email de cancelación: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.BOOKING_APPOINTMENT_REMINDER_DUE)
  async handleAppointmentReminder(@Payload() event: AppointmentReminderDueEvent) {
    const { appointmentId, date, startTime } = event.payload;

    this.logger.log(`Recordatorio de cita pendiente: ${appointmentId}`);

    try {
      const reminderType = this.determineReminderType(date, startTime);

      if (reminderType === '24h') {
        const { jobId } = await this.emailService.queueAppointmentReminder24h(
          'client@example.com',
          {
            clientName: 'Cliente',
            professionalName: 'Profesional',
            serviceName: 'Servicio',
            appointmentDate: date,
            appointmentTime: startTime,
            businessName: 'BeautySpot Business',
            businessAddress: 'Dirección',
          },
        );

        await this.emitEmailQueuedEvent(
          jobId,
          'client@example.com',
          'appointment-reminder-24h',
          'Recordatorio de cita',
        );
      } else if (reminderType === '1h') {
        const { jobId } = await this.emailService.queueAppointmentReminder1h(
          'client@example.com',
          {
            clientName: 'Cliente',
            professionalName: 'Profesional',
            serviceName: 'Servicio',
            appointmentTime: startTime,
            businessName: 'BeautySpot Business',
          },
        );

        await this.emitEmailQueuedEvent(
          jobId,
          'client@example.com',
          'appointment-reminder-1h',
          'Recordatorio de cita',
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando recordatorio de cita: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.PAYMENT_INVOICE_GENERATED)
  async handleInvoiceGenerated(@Payload() event: InvoiceGeneratedEvent) {
    const { invoiceId, number, total } = event.payload;

    this.logger.log(`Factura generada: ${invoiceId}`);

    try {
      const { jobId } = await this.emailService.queueInvoice('client@example.com', {
        clientName: 'Cliente',
        invoiceNumber: number.toString(),
        amount: total,
        dueDate: '2024-12-31',
        businessName: 'BeautySpot Business',
        services: [
          { name: 'Servicio 1', price: 50000 },
          { name: 'Servicio 2', price: 30000 },
        ],
      });

      await this.emitEmailQueuedEvent(
        jobId,
        'client@example.com',
        'invoice-generated',
        `Factura #${number}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email de factura: ${errorMessage}`, errorStack);
    }
  }

  @EventPattern(EventNames.PAYMENT_PAYMENT_REGISTERED)
  async handlePaymentRegistered(@Payload() event: PaymentRegisteredEvent) {
    this.logger.log(`Pago registrado: ${event.payload.paymentId}`);

    try {
      if (event.payload.method === 'transfer' || event.payload.method === 'efectivo') {
        const { jobId } = await this.emailService.queueInvoice('client@example.com', {
          clientName: 'Cliente',
          invoiceNumber: `REC-${event.payload.paymentId}`,
          amount: event.payload.amount,
          dueDate: new Date().toISOString().split('T')[0],
          businessName: 'BeautySpot Business',
          services: [{ name: 'Servicio', price: event.payload.amount }],
        });

        await this.emitEmailQueuedEvent(
          jobId,
          'client@example.com',
          'invoice-generated',
          `Recibo de pago`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error enviando email de pago: ${errorMessage}`, errorStack);
    }
  }

  private determineReminderType(appointmentDate: string, appointmentTime: string): '24h' | '1h' | null {
    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    const now = new Date();
    const diffMs = appointmentDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 1.5 && diffHours >= 0.5) {
      return '1h';
    } else if (diffHours <= 25 && diffHours >= 23) {
      return '24h';
    }

    return null;
  }

  private async emitEmailQueuedEvent(
    jobId: string,
    to: string,
    template: string,
    subject: string,
  ) {
    try {
      await this.amqpConnection.publish('beautyspot.events', 'notification.email.queued', {
        eventType: 'notification.email.queued',
        timestamp: new Date(),
        correlationId: jobId,
        payload: {
          jobId,
          to,
          template,
          subject,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error publicando evento email.queued: ${errorMessage}`, errorStack);
    }
  }
}