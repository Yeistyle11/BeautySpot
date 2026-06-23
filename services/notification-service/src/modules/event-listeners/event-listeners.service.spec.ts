import { Test, TestingModule } from '@nestjs/testing';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { EmailService } from '../emails/email.service';
import { NotificationEventListeners } from './event-listeners.service';

describe('NotificationEventListeners', () => {
  let service: NotificationEventListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;

  const mockUserRegisteredEvent = {
    eventType: 'auth.user.registered',
    correlationId: 'corr-123',
    timestamp: new Date(),
    payload: {
      userId: 'user-123',
      email: 'newuser@example.com',
      name: 'New User',
    },
  };

  const mockAppointmentConfirmedEvent = {
    eventType: 'booking.appointment.confirmed',
    correlationId: 'corr-124',
    timestamp: new Date(),
    payload: {
      appointmentId: 'appointment-123',
      clientId: 'client-123',
      businessId: 'business-123',
      professionalId: 'professional-123',
      date: '2024-12-25',
      startTime: '10:00',
      endTime: '11:00',
      totalAmount: 80000,
    },
  };

  const mockAppointmentCancelledEvent = {
    eventType: 'booking.appointment.cancelled',
    correlationId: 'corr-125',
    timestamp: new Date(),
    payload: {
      appointmentId: 'appointment-123',
      clientId: 'client-123',
      businessId: 'business-123',
      professionalId: 'professional-123',
      startTime: '10:00',
      endTime: '11:00',
      totalAmount: 80000,
      cancelReason: 'Cliente solicitó cancelación',
      date: '2024-12-25',
    },
  };

  const mockAppointmentReminderEvent = {
    eventType: 'booking.appointment.reminder_due',
    correlationId: 'corr-126',
    timestamp: new Date(),
    payload: {
      appointmentId: 'appointment-123',
      clientId: 'client-123',
      businessId: 'business-123',
      professionalId: 'professional-123',
      startTime: '10:00',
      endTime: '11:00',
      totalAmount: 80000,
      date: '2024-12-25',
    },
  };

  const mockInvoiceGeneratedEvent = {
    eventType: 'payment.invoice.generated',
    correlationId: 'corr-127',
    timestamp: new Date(),
    payload: {
      invoiceId: 'invoice-123',
      number: 1001,
      clientId: 'client-123',
      businessId: 'business-123',
      total: 80000,
      currency: 'COP',
    },
  };

  const mockPaymentRegisteredEvent = {
    eventType: 'payment.payment.registered',
    correlationId: 'corr-128',
    timestamp: new Date(),
    payload: {
      paymentId: 'payment-123',
      invoiceId: 'invoice-123',
      amount: 80000,
      method: 'transfer',
      clientId: 'client-123',
      businessId: 'business-123',
    },
  };

  beforeEach(async () => {
    mockEmailService = {
      queueWelcomeEmail: jest.fn().mockResolvedValue({ jobId: 'job-123' }),
      queueAppointmentConfirmation: jest.fn().mockResolvedValue({ jobId: 'job-124' }),
      queueAppointmentCancelled: jest.fn().mockResolvedValue({ jobId: 'job-125' }),
      queueAppointmentReminder24h: jest.fn().mockResolvedValue({ jobId: 'job-126' }),
      queueAppointmentReminder1h: jest.fn().mockResolvedValue({ jobId: 'job-127' }),
      queueInvoice: jest.fn().mockResolvedValue({ jobId: 'job-128' }),
    } as any;

    mockAmqpConnection = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventListeners,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
    }).compile();

    service = module.get<NotificationEventListeners>(NotificationEventListeners);
  });

  describe('handleUserRegistered', () => {
    it('debería manejar evento de usuario registrado exitosamente', async () => {
      await service.handleUserRegistered(mockUserRegisteredEvent);

      expect(mockEmailService.queueWelcomeEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        { clientName: 'New User' }
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        'notification.email.queued',
        expect.objectContaining({
          eventType: 'notification.email.queued',
          payload: expect.objectContaining({
            jobId: 'job-123',
            to: 'newuser@example.com',
            template: 'welcome-email',
            subject: 'Bienvenido a BeautySpot',
          }),
        })
      );
    });

    it('debería manejar errores sin lanzar excepción', async () => {
      mockEmailService.queueWelcomeEmail.mockRejectedValue(new Error('Email service error'));

      await expect(
        service.handleUserRegistered(mockUserRegisteredEvent)
      ).resolves.not.toThrow();

      expect(mockAmqpConnection.publish).not.toHaveBeenCalled();
    });
  });

  describe('handleAppointmentConfirmed', () => {
    it('debería manejar evento de cita confirmada exitosamente', async () => {
      await service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      expect(mockEmailService.queueAppointmentConfirmation).toHaveBeenCalledWith(
        'client@example.com',
        expect.objectContaining({
          clientName: 'Cliente',
          professionalName: 'Profesional',
          serviceName: 'Servicio',
          appointmentDate: '2024-12-25',
          appointmentTime: '10:00',
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        'notification.email.queued',
        expect.objectContaining({
          payload: expect.objectContaining({
            to: 'client@example.com',
            template: 'appointment-confirmed',
            subject: 'Confirmación de cita',
          }),
        })
      );
    });

    it('debería manejar errores sin lanzar excepción', async () => {
      mockEmailService.queueAppointmentConfirmation.mockRejectedValue(new Error('Error'));

      await expect(
        service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('handleAppointmentCancelled', () => {
    it('debería manejar evento de cita cancelada exitosamente', async () => {
      await service.handleAppointmentCancelled(mockAppointmentCancelledEvent);

      expect(mockEmailService.queueAppointmentCancelled).toHaveBeenCalledWith(
        'client@example.com',
        expect.objectContaining({
          clientName: 'Cliente',
          serviceName: 'Servicio',
          cancelledDate: '2024-12-25',
          reason: 'Cliente solicitó cancelación',
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        'notification.email.queued',
        expect.objectContaining({
          payload: expect.objectContaining({
            template: 'appointment-cancelled',
            subject: 'Cita cancelada',
          }),
        })
      );
    });

    it('debería usar motivo por defecto cuando no se proporciona', async () => {
      const eventWithoutReason = {
        ...mockAppointmentCancelledEvent,
        payload: { ...mockAppointmentCancelledEvent.payload, cancelReason: undefined },
      };

      await service.handleAppointmentCancelled(eventWithoutReason);

      expect(mockEmailService.queueAppointmentCancelled).toHaveBeenCalledWith(
        'client@example.com',
        expect.objectContaining({
          reason: 'Sin motivo',
        })
      );
    });

    it('debería manejar errores sin lanzar excepción', async () => {
      mockEmailService.queueAppointmentCancelled.mockRejectedValue(new Error('Error'));

      await expect(
        service.handleAppointmentCancelled(mockAppointmentCancelledEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('handleAppointmentReminder', () => {
    it('debería enviar recordatorio de 24h cuando corresponde', async () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const reminderEvent = {
        ...mockAppointmentReminderEvent,
        payload: {
          ...mockAppointmentReminderEvent.payload,
          date: `${year}-${month}-${day}`,
          startTime: `${hours}:${minutes}`,
        },
      };

      await service.handleAppointmentReminder(reminderEvent);

      expect(mockEmailService.queueAppointmentReminder24h).toHaveBeenCalled();
      expect(mockEmailService.queueAppointmentReminder1h).not.toHaveBeenCalled();
    });

    it('debería enviar recordatorio de 1h cuando corresponde', async () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 1.2 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const reminderEvent = {
        ...mockAppointmentReminderEvent,
        payload: {
          ...mockAppointmentReminderEvent.payload,
          date: `${year}-${month}-${day}`,
          startTime: `${hours}:${minutes}`,
        },
      };

      await service.handleAppointmentReminder(reminderEvent);

      expect(mockEmailService.queueAppointmentReminder1h).toHaveBeenCalled();
      expect(mockEmailService.queueAppointmentReminder24h).not.toHaveBeenCalled();
    });

    it('no debería enviar recordatorio cuando no corresponde', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 5);

      const reminderEvent = {
        ...mockAppointmentReminderEvent,
        payload: {
          ...mockAppointmentReminderEvent.payload,
          date: futureDate.toISOString().split('T')[0],
          startTime: futureDate.toTimeString().split(' ')[0].substring(0, 5),
        },
      };

      await service.handleAppointmentReminder(reminderEvent);

      expect(mockEmailService.queueAppointmentReminder24h).not.toHaveBeenCalled();
      expect(mockEmailService.queueAppointmentReminder1h).not.toHaveBeenCalled();
    });

    it('debería manejar errores sin lanzar excepción', async () => {
      mockEmailService.queueAppointmentReminder24h.mockRejectedValue(new Error('Error'));

      await expect(
        service.handleAppointmentReminder(mockAppointmentReminderEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('handleInvoiceGenerated', () => {
    it('debería manejar evento de factura generada exitosamente', async () => {
      await service.handleInvoiceGenerated(mockInvoiceGeneratedEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        'client@example.com',
        expect.objectContaining({
          clientName: 'Cliente',
          invoiceNumber: '1001',
          amount: 80000,
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        'notification.email.queued',
        expect.objectContaining({
          payload: expect.objectContaining({
            template: 'invoice-generated',
            subject: 'Factura #1001',
          }),
        })
      );
    });

    it('debería manejar errores sin lanzar excepción', async () => {
      mockEmailService.queueInvoice.mockRejectedValue(new Error('Error'));

      await expect(
        service.handleInvoiceGenerated(mockInvoiceGeneratedEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('handlePaymentRegistered', () => {
    it('debería enviar recibo para pagos por transferencia', async () => {
      await service.handlePaymentRegistered(mockPaymentRegisteredEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        'client@example.com',
        expect.objectContaining({
          invoiceNumber: 'REC-payment-123',
          amount: 80000,
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'beautyspot.events',
        'notification.email.queued',
        expect.objectContaining({
          payload: expect.objectContaining({
            subject: 'Recibo de pago',
          }),
        })
      );
    });

    it('debería enviar recibo para pagos en efectivo', async () => {
      const cashEvent = {
        ...mockPaymentRegisteredEvent,
        payload: { ...mockPaymentRegisteredEvent.payload, method: 'efectivo' },
      };

      await service.handlePaymentRegistered(cashEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalled();
    });

    it('no debería enviar recibo para otros métodos de pago', async () => {
      const cardEvent = {
        ...mockPaymentRegisteredEvent,
        payload: { ...mockPaymentRegisteredEvent.payload, method: 'card' },
      };

      await service.handlePaymentRegistered(cardEvent);

      expect(mockEmailService.queueInvoice).not.toHaveBeenCalled();
    });

    it('debería manejar errores sin lanzar excepción', async () => {
      mockEmailService.queueInvoice.mockRejectedValue(new Error('Error'));

      await expect(
        service.handlePaymentRegistered(mockPaymentRegisteredEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('determineReminderType (privado)', () => {
    it('debería retornar 24h para citas en 24 horas', () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = `${hours}:${minutes}`;

      const result = (service as any).determineReminderType(dateStr, timeStr);

      expect(result).toBe('24h');
    });

    it('debería retornar 1h para citas en 1 hora', () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 1.2 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = `${hours}:${minutes}`;

      const result = (service as any).determineReminderType(dateStr, timeStr);

      expect(result).toBe('1h');
    });

    it('debería retornar null para tiempos fuera de rango', () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, '0');
      const day = String(appointmentDate.getDate()).padStart(2, '0');
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const timeStr = `${hours}:${minutes}`;

      const result = (service as any).determineReminderType(dateStr, timeStr);

      expect(result).toBeNull();
    });
  });
});