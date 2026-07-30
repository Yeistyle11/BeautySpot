import { Test, TestingModule } from "@nestjs/testing";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationEventListeners } from "./event-listeners.service";

describe("NotificationEventListeners", () => {
  let service: NotificationEventListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockDataEnricher: jest.Mocked<DataEnricherService>;
  let mockNotifications: { create: jest.Mock };

  const mockUserRegisteredEvent = {
    eventType: "auth.user.registered",
    eventId: "evt-123",
    correlationId: "corr-123",
    timestamp: new Date(),
    payload: {
      userId: "user-123",
      email: "newuser@example.com",
      name: "New User",
    },
  };

  const mockPasswordResetEvent = {
    eventType: "auth.password-reset.requested",
    eventId: "evt-129",
    correlationId: "corr-129",
    timestamp: new Date(),
    payload: {
      userId: "user-123",
      email: "reset@example.com",
      name: "Reset User",
      resetToken: "raw-token-abc",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    },
  };

  const mockAppointmentConfirmedEvent = {
    eventType: "booking.appointment.confirmed",
    eventId: "evt-124",
    correlationId: "corr-124",
    timestamp: new Date(),
    payload: {
      appointmentId: "appointment-123",
      clientId: "client-123",
      businessId: "business-123",
      professionalId: "professional-123",
      date: "2024-12-25",
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 80000,
    },
  };

  const mockAppointmentCancelledEvent = {
    eventType: "booking.appointment.cancelled",
    eventId: "evt-125",
    correlationId: "corr-125",
    timestamp: new Date(),
    payload: {
      appointmentId: "appointment-123",
      clientId: "client-123",
      businessId: "business-123",
      professionalId: "professional-123",
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 80000,
      cancelReason: "Cliente solicitó cancelación",
      date: "2024-12-25",
    },
  };

  const mockAppointmentReminderEvent = {
    eventType: "booking.appointment.reminder_due",
    eventId: "evt-126",
    correlationId: "corr-126",
    timestamp: new Date(),
    payload: {
      appointmentId: "appointment-123",
      clientId: "client-123",
      businessId: "business-123",
      professionalId: "professional-123",
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 80000,
      date: "2024-12-25",
    },
  };

  const mockInvoiceGeneratedEvent = {
    eventType: "payment.invoice.generated",
    eventId: "evt-127",
    correlationId: "corr-127",
    timestamp: new Date(),
    payload: {
      invoiceId: "invoice-123",
      number: 1001,
      clientId: "client-123",
      businessId: "business-123",
      total: 80000,
      currency: "COP",
    },
  };

  const mockPaymentRegisteredEvent = {
    eventType: "payment.payment.registered",
    eventId: "evt-128",
    correlationId: "corr-128",
    timestamp: new Date(),
    payload: {
      paymentId: "payment-123",
      invoiceId: "invoice-123",
      amount: 80000,
      method: "transfer",
      clientId: "client-123",
      businessId: "business-123",
    },
  };

  const enrichedData = {
    clientName: "Juan Cliente",
    clientEmail: "juan@example.com",
    clientUserId: "user-cliente",
    professionalName: "Ana Pro",
    businessName: "EliteBarbers",
    businessAddress: "Calle 123",
    businessPhone: "+57 300 123 4567",
  };

  beforeEach(async () => {
    mockEmailService = {
      queueWelcomeEmail: jest.fn().mockResolvedValue({ jobId: "job-123" }),
      queuePasswordReset: jest.fn().mockResolvedValue({ jobId: "job-129" }),
      queueAppointmentConfirmation: jest
        .fn()
        .mockResolvedValue({ jobId: "job-124" }),
      queueAppointmentCancelled: jest
        .fn()
        .mockResolvedValue({ jobId: "job-125" }),
      queueAppointmentReminder24h: jest
        .fn()
        .mockResolvedValue({ jobId: "job-126" }),
      queueAppointmentReminder1h: jest
        .fn()
        .mockResolvedValue({ jobId: "job-127" }),
      queueInvoice: jest.fn().mockResolvedValue({ jobId: "job-128" }),
    } as any;

    mockAmqpConnection = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "APP_URL") return "http://localhost:3000";
        return undefined;
      }),
    } as any;

    mockDataEnricher = {
      enrichAppointmentParticipants: jest.fn().mockResolvedValue(enrichedData),
      enrichClientEmail: jest.fn().mockResolvedValue("juan@example.com"),
      enrichBusinessData: jest.fn().mockResolvedValue({
        businessName: "EliteBarbers",
        businessAddress: "Calle 123",
        businessPhone: "+57 300 123 4567",
      }),
    } as any;

    mockNotifications = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventListeners,
        { provide: EmailService, useValue: mockEmailService },
        { provide: AmqpConnection, useValue: mockAmqpConnection },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataEnricherService, useValue: mockDataEnricher },
        { provide: NotificationsService, useValue: mockNotifications },
        {
          // El store real se prueba aparte; aquí basta con que deje pasar el
          // trabajo, que es el comportamiento cuando el evento es nuevo.
          provide: ProcessedEventsStore,
          useValue: {
            once: jest.fn(
              async (_e: unknown, _h: string, trabajo: () => Promise<void>) => {
                await trabajo();
                return true;
              }
            ),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationEventListeners>(
      NotificationEventListeners
    );
  });

  describe("handleUserRegistered", () => {
    it("debería manejar evento de usuario registrado exitosamente", async () => {
      await service.handleUserRegistered(mockUserRegisteredEvent);

      expect(mockEmailService.queueWelcomeEmail).toHaveBeenCalledWith(
        "newuser@example.com",
        { clientName: "New User" }
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        "beautyspot.events",
        "notification.email.queued",
        expect.objectContaining({
          eventType: "notification.email.queued",
          payload: expect.objectContaining({
            jobId: "job-123",
            to: "newuser@example.com",
            template: "welcome-email",
          }),
        })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockEmailService.queueWelcomeEmail.mockRejectedValue(
        new Error("Email service error")
      );

      await expect(
        service.handleUserRegistered(mockUserRegisteredEvent)
      ).rejects.toThrow();

      expect(mockAmqpConnection.publish).not.toHaveBeenCalled();
    });
  });

  describe("handlePasswordResetRequested", () => {
    it("debería encolar email de reset con link construido", async () => {
      await service.handlePasswordResetRequested(mockPasswordResetEvent);

      expect(mockEmailService.queuePasswordReset).toHaveBeenCalledWith(
        "reset@example.com",
        expect.objectContaining({
          clientName: "Reset User",
          resetLink: "http://localhost:3000/reset-password?token=raw-token-abc",
          expiryHours: expect.any(Number),
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalled();
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockEmailService.queuePasswordReset.mockRejectedValue(new Error("Error"));

      await expect(
        service.handlePasswordResetRequested(mockPasswordResetEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleAppointmentConfirmed", () => {
    it("deja también la notificación dentro de la aplicación", async () => {
      await service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      // La bandeja de la aplicación existía pero nunca recibía nada: los
      // listeners solo mandaban el correo.
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          businessId: "business-123",
          type: "APPOINTMENT_CONFIRMED",
        })
      );
    });

    it("no deja notificación si el cliente reservó sin cuenta", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockResolvedValue({
        clientName: "Invitado",
        clientEmail: "invitado@example.com",
        clientUserId: null,
        professionalName: "Ana Pro",
        businessName: "EliteBarbers",
        businessAddress: "Calle 1",
        businessPhone: "+57",
      });

      await service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      // Un invitado no tiene dónde leerla; el correo sí se envía.
      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockEmailService.queueAppointmentConfirmation).toHaveBeenCalled();
    });

    it("debería enriquecer datos y enviar a email real del cliente", async () => {
      await service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      expect(
        mockDataEnricher.enrichAppointmentParticipants
      ).toHaveBeenCalledWith("client-123", "professional-123", "business-123");
      expect(
        mockEmailService.queueAppointmentConfirmation
      ).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          clientName: "Juan Cliente",
          professionalName: "Ana Pro",
          businessName: "EliteBarbers",
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        "beautyspot.events",
        "notification.email.queued",
        expect.objectContaining({
          payload: expect.objectContaining({
            to: "juan@example.com",
          }),
        })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockRejectedValue(
        new Error("Error")
      );

      await expect(
        service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleAppointmentCancelled", () => {
    it("debería enriquecer datos y enviar cancelación", async () => {
      await service.handleAppointmentCancelled(mockAppointmentCancelledEvent);

      expect(mockEmailService.queueAppointmentCancelled).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          clientName: "Juan Cliente",
          reason: "Cliente solicitó cancelación",
        })
      );
    });

    it("debería usar motivo por defecto cuando no se proporciona", async () => {
      const eventWithoutReason = {
        ...mockAppointmentCancelledEvent,
        payload: {
          ...mockAppointmentCancelledEvent.payload,
          cancelReason: undefined,
        },
      };

      await service.handleAppointmentCancelled(eventWithoutReason);

      expect(mockEmailService.queueAppointmentCancelled).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ reason: "Sin motivo" })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockRejectedValue(
        new Error("Error")
      );

      await expect(
        service.handleAppointmentCancelled(mockAppointmentCancelledEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleAppointmentReminder", () => {
    const buildReminderEvent = (hoursAhead: number) => {
      const now = new Date();
      const appointmentDate = new Date(
        now.getTime() + hoursAhead * 60 * 60 * 1000
      );
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, "0");
      const day = String(appointmentDate.getDate()).padStart(2, "0");
      const hours = String(appointmentDate.getHours()).padStart(2, "0");
      const minutes = String(appointmentDate.getMinutes()).padStart(2, "0");
      return {
        ...mockAppointmentReminderEvent,
        payload: {
          ...mockAppointmentReminderEvent.payload,
          date: `${year}-${month}-${day}`,
          startTime: `${hours}:${minutes}`,
        },
      };
    };

    it("debería enviar recordatorio de 24h cuando corresponde", async () => {
      await service.handleAppointmentReminder(buildReminderEvent(24));

      expect(mockEmailService.queueAppointmentReminder24h).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ clientName: "Juan Cliente" })
      );
      expect(
        mockEmailService.queueAppointmentReminder1h
      ).not.toHaveBeenCalled();
    });

    it("debería enviar recordatorio de 1h cuando corresponde", async () => {
      await service.handleAppointmentReminder(buildReminderEvent(1.2));

      expect(mockEmailService.queueAppointmentReminder1h).toHaveBeenCalled();
      expect(
        mockEmailService.queueAppointmentReminder24h
      ).not.toHaveBeenCalled();
    });

    it("no debería enviar recordatorio cuando no corresponde", async () => {
      await service.handleAppointmentReminder(buildReminderEvent(5));

      expect(
        mockEmailService.queueAppointmentReminder24h
      ).not.toHaveBeenCalled();
      expect(
        mockEmailService.queueAppointmentReminder1h
      ).not.toHaveBeenCalled();
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockRejectedValue(
        new Error("Error")
      );

      await expect(
        service.handleAppointmentReminder(buildReminderEvent(24))
      ).rejects.toThrow();
    });
  });

  describe("handleInvoiceGenerated", () => {
    it("debería enriquecer datos del cliente y negocio", async () => {
      await service.handleInvoiceGenerated(mockInvoiceGeneratedEvent);

      expect(mockDataEnricher.enrichClientEmail).toHaveBeenCalledWith(
        "client-123"
      );
      expect(mockDataEnricher.enrichBusinessData).toHaveBeenCalledWith(
        "business-123"
      );
      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          invoiceNumber: "1001",
          amount: 80000,
          businessName: "EliteBarbers",
        })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichClientEmail.mockRejectedValue(new Error("Error"));

      await expect(
        service.handleInvoiceGenerated(mockInvoiceGeneratedEvent)
      ).rejects.toThrow();
    });
  });

  describe("handlePaymentRegistered", () => {
    it("debería enviar recibo para pagos por transferencia", async () => {
      await service.handlePaymentRegistered(mockPaymentRegisteredEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          invoiceNumber: "REC-payment-123",
          amount: 80000,
        })
      );
    });

    it("debería enviar recibo para pagos en efectivo", async () => {
      const cashEvent = {
        ...mockPaymentRegisteredEvent,
        payload: { ...mockPaymentRegisteredEvent.payload, method: "efectivo" },
      };

      await service.handlePaymentRegistered(cashEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalled();
    });

    it("no debería enviar recibo para otros métodos de pago", async () => {
      const cardEvent = {
        ...mockPaymentRegisteredEvent,
        payload: { ...mockPaymentRegisteredEvent.payload, method: "card" },
      };

      await service.handlePaymentRegistered(cardEvent);

      expect(mockEmailService.queueInvoice).not.toHaveBeenCalled();
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichClientEmail.mockRejectedValue(new Error("Error"));

      await expect(
        service.handlePaymentRegistered(mockPaymentRegisteredEvent)
      ).rejects.toThrow();
    });
  });

  describe("determineReminderType (privado)", () => {
    it("debería retornar 24h para citas en 24 horas", () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, "0");
      const day = String(appointmentDate.getDate()).padStart(2, "0");
      const hours = String(appointmentDate.getHours()).padStart(2, "0");
      const minutes = String(appointmentDate.getMinutes()).padStart(2, "0");

      const result = (service as any).determineReminderType(
        `${year}-${month}-${day}`,
        `${hours}:${minutes}`
      );

      expect(result).toBe("24h");
    });

    it("debería retornar null para tiempos fuera de rango", () => {
      const now = new Date();
      const appointmentDate = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const year = appointmentDate.getFullYear();
      const month = String(appointmentDate.getMonth() + 1).padStart(2, "0");
      const day = String(appointmentDate.getDate()).padStart(2, "0");
      const hours = String(appointmentDate.getHours()).padStart(2, "0");
      const minutes = String(appointmentDate.getMinutes()).padStart(2, "0");

      const result = (service as any).determineReminderType(
        `${year}-${month}-${day}`,
        `${hours}:${minutes}`
      );

      expect(result).toBeNull();
    });
  });
});
