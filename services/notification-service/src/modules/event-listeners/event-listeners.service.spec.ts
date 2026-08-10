import { Test, TestingModule } from "@nestjs/testing";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import {
  ProcessedEventsStore,
  InternalHttpClient,
} from "@beautyspot/nest-common";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationEventListeners } from "./event-listeners.service";
import { PaymentMethod } from "@beautyspot/shared-types";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";

describe("NotificationEventListeners", () => {
  let service: NotificationEventListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockDataEnricher: jest.Mocked<DataEnricherService>;
  let mockNotifications: { create: jest.Mock };
  let mockHttp: jest.Mocked<InternalHttpClient>;
  let mockPreferencias: { isNotificationEnabled: jest.Mock };

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

  const mockEmailVerificationEvent = {
    eventType: "auth.email-verification.requested",
    eventId: "evt-130",
    correlationId: "corr-130",
    timestamp: new Date(),
    payload: {
      userId: "user-123",
      email: "nuevo@example.com",
      name: "Nuevo Usuario",
      verificationToken: "raw-token-xyz",
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
      method: PaymentMethod.TRANSFER,
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
      queueEmailVerification: jest.fn().mockResolvedValue({ jobId: "job-130" }),
      queueReviewRequest: jest.fn().mockResolvedValue({ jobId: "job-131" }),
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
      queueAppointmentCreated: jest
        .fn()
        .mockResolvedValue({ jobId: "job-130" }),
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
      enrichClientName: jest.fn().mockResolvedValue("Juan Cliente"),
      enrichClientUserId: jest.fn().mockResolvedValue("user-cliente"),
      enrichBusinessData: jest.fn().mockResolvedValue({
        businessName: "EliteBarbers",
        businessAddress: "Calle 123",
        businessPhone: "+57 300 123 4567",
      }),
    } as any;

    mockNotifications = { create: jest.fn().mockResolvedValue(undefined) };

    // El equipo del negocio se resuelve contra auth-service; aquí basta con un
    // dueño para comprobar que el aviso también le llega a él.
    mockHttp = {
      pedirONulo: jest
        .fn()
        .mockResolvedValue([{ userId: "user-dueno", role: "OWNER" }]),
    } as any;

    // Sin preferencia guardada se recibe todo; los tests que prueban el
    // opt-out lo dicen.
    mockPreferencias = {
      isNotificationEnabled: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEventListeners,
        { provide: EmailService, useValue: mockEmailService },
        { provide: AmqpConnection, useValue: mockAmqpConnection },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DataEnricherService, useValue: mockDataEnricher },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: InternalHttpClient, useValue: mockHttp },
        {
          provide: NotificationPreferencesService,
          useValue: mockPreferencias,
        },
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

  describe("handleEmailVerificationRequested", () => {
    it("encola el correo con el enlace de confirmación", async () => {
      await service.handleEmailVerificationRequested(
        mockEmailVerificationEvent
      );

      expect(mockEmailService.queueEmailVerification).toHaveBeenCalledWith(
        "nuevo@example.com",
        expect.objectContaining({
          clientName: "Nuevo Usuario",
          verificationLink:
            "http://localhost:3000/verify-email?token=raw-token-xyz",
          expiryHours: expect.any(Number),
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalled();
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockEmailService.queueEmailVerification.mockRejectedValue(
        new Error("Error")
      );

      await expect(
        service.handleEmailVerificationRequested(mockEmailVerificationEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleAppointmentConfirmed", () => {
    it("deja también la notificación dentro de la aplicación", async () => {
      await service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      // El listener manda el correo y además alimenta la bandeja de la app.
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

    // El correo depende de la cola y del proveedor de envío; la notificación
    // dentro de la aplicación, no.
    it("deja la notificación aunque falle el encolado del correo", async () => {
      mockEmailService.queueAppointmentConfirmation.mockRejectedValue(
        new Error("Redis caído")
      );

      await service.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "APPOINTMENT_CONFIRMED" })
      );
    });
  });

  describe("handleAppointmentCreated", () => {
    const mockAppointmentCreatedEvent = {
      eventType: "booking.appointment.created",
      eventId: "evt-130",
      correlationId: "corr-130",
      timestamp: new Date(),
      payload: {
        appointmentId: "appointment-130",
        clientId: "client-123",
        professionalId: "professional-123",
        businessId: "business-123",
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "11:00",
        totalAmount: 50000,
      },
    } as any;

    it("avisa al cliente de su reserva", async () => {
      await service.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "APPOINTMENT_CREATED",
        })
      );
    });

    // Una reserva desde el marketplace la dispara el cliente: si no se avisa
    // aquí, al negocio no le consta hasta que alguien mira la agenda.
    it("avisa también al equipo del negocio", async () => {
      await service.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-dueno",
          type: "APPOINTMENT_CREATED",
        })
      );
    });

    it("no avisa a quien no gestiona la agenda", async () => {
      mockHttp.pedirONulo.mockResolvedValue([
        { userId: "user-pro", role: "PROFESSIONAL" },
      ] as never);

      await service.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockNotifications.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-pro" })
      );
    });

    // Quien reserva desde el marketplace no entra al panel: el aviso in-app no
    // le llega a ninguna parte.
    it("manda el acuse por correo al cliente", async () => {
      await service.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockEmailService.queueAppointmentCreated).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          clientName: "Juan Cliente",
          appointmentDate: "2026-08-10",
          appointmentTime: "10:00",
          businessName: "EliteBarbers",
        })
      );
    });

    it("no usa la plantilla de cita confirmada, que aún no lo está", async () => {
      await service.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(
        mockEmailService.queueAppointmentConfirmation
      ).not.toHaveBeenCalled();
    });

    it("deja el aviso in-app aunque el correo falle", async () => {
      mockEmailService.queueAppointmentCreated.mockRejectedValue(
        new Error("SMTP caído")
      );

      await service.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-cliente" })
      );
    });
  });

  describe("preferencias de notificación", () => {
    const citaCreada = {
      eventType: "booking.appointment.created",
      eventId: "evt-150",
      correlationId: "corr-150",
      timestamp: new Date(),
      payload: {
        appointmentId: "appointment-150",
        clientId: "client-123",
        professionalId: "professional-123",
        businessId: "business-123",
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "11:00",
        totalAmount: 50000,
      },
    } as never;

    it("no deja el aviso in-app si el usuario lo desactivó", async () => {
      mockPreferencias.isNotificationEnabled.mockImplementation(
        async (_u, _b, _t, canal) => canal !== "IN_APP"
      );

      await service.handleAppointmentCreated(citaCreada);

      expect(mockNotifications.create).not.toHaveBeenCalled();
      // El correo sigue saliendo: son canales independientes.
      expect(mockEmailService.queueAppointmentCreated).toHaveBeenCalled();
    });

    it("no manda el correo si el usuario lo desactivó", async () => {
      mockPreferencias.isNotificationEnabled.mockImplementation(
        async (_u, _b, _t, canal) => canal !== "EMAIL"
      );

      await service.handleAppointmentCreated(citaCreada);

      expect(mockEmailService.queueAppointmentCreated).not.toHaveBeenCalled();
      expect(mockNotifications.create).toHaveBeenCalled();
    });

    it("consulta la preferencia por tipo y canal", async () => {
      await service.handleAppointmentCreated(citaCreada);

      expect(mockPreferencias.isNotificationEnabled).toHaveBeenCalledWith(
        "user-cliente",
        "business-123",
        "APPOINTMENT_CREATED",
        "IN_APP"
      );
    });

    // Quien reserva sin cuenta no tiene dónde guardar preferencias, y el correo
    // es su único canal.
    it("manda el correo al invitado sin consultar preferencias", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockResolvedValue({
        ...enrichedData,
        clientUserId: null,
      });

      await service.handleAppointmentCreated(citaCreada);

      expect(mockEmailService.queueAppointmentCreated).toHaveBeenCalled();
    });

    it("si la preferencia no se puede leer, el aviso sale igual", async () => {
      mockPreferencias.isNotificationEnabled.mockRejectedValue(
        new Error("Postgres caído")
      );

      await service.handleAppointmentCreated(citaCreada);

      expect(mockNotifications.create).toHaveBeenCalled();
    });
  });

  describe("handleAppointmentRescheduled", () => {
    const mockAppointmentRescheduledEvent = {
      eventType: "booking.appointment.rescheduled",
      eventId: "evt-140",
      correlationId: "corr-140",
      timestamp: new Date(),
      payload: {
        appointmentId: "appointment-140",
        clientId: "client-123",
        professionalId: "professional-123",
        businessId: "business-123",
        date: "2026-08-12",
        startTime: "16:00",
        endTime: "17:00",
        totalAmount: 50000,
        previousDate: "2026-08-10",
        previousStartTime: "10:00",
      },
    } as any;

    it("avisa al cliente del cambio, indicando de dónde venía", async () => {
      await service.handleAppointmentRescheduled(
        mockAppointmentRescheduledEvent
      );

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "APPOINTMENT_RESCHEDULED",
          message: expect.stringContaining("2026-08-10"),
        })
      );
    });

    it("avisa también al equipo del negocio", async () => {
      await service.handleAppointmentRescheduled(
        mockAppointmentRescheduledEvent
      );

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-dueno",
          type: "APPOINTMENT_RESCHEDULED",
        })
      );
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
    const buildReminderEvent = (reminderType: "24h" | "1h") => ({
      ...mockAppointmentReminderEvent,
      payload: { ...mockAppointmentReminderEvent.payload, reminderType },
    });

    it("debería enviar recordatorio de 24h cuando corresponde", async () => {
      await service.handleAppointmentReminder(buildReminderEvent("24h"));

      expect(mockEmailService.queueAppointmentReminder24h).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ clientName: "Juan Cliente" })
      );
      expect(
        mockEmailService.queueAppointmentReminder1h
      ).not.toHaveBeenCalled();
    });

    it("debería enviar recordatorio de 1h cuando corresponde", async () => {
      await service.handleAppointmentReminder(buildReminderEvent("1h"));

      expect(mockEmailService.queueAppointmentReminder1h).toHaveBeenCalled();
      expect(
        mockEmailService.queueAppointmentReminder24h
      ).not.toHaveBeenCalled();
    });

    it("envía el aviso atrasado, sin recalcular si aún cae en su franja", async () => {
      // La fecha del fixture no cae en ninguna ventana: antes, un aviso que
      // llegaba fuera de su franja se descartaba en silencio.
      await service.handleAppointmentReminder(buildReminderEvent("1h"));

      expect(mockEmailService.queueAppointmentReminder1h).toHaveBeenCalledTimes(
        1
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockRejectedValue(
        new Error("Error")
      );

      await expect(
        service.handleAppointmentReminder(buildReminderEvent("24h"))
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
    /** El mismo pago, cobrado por el método indicado. */
    const pagadoCon = (method: PaymentMethod) => ({
      ...mockPaymentRegisteredEvent,
      payload: { ...mockPaymentRegisteredEvent.payload, method },
    });

    it("debería enviar recibo para pagos por transferencia", async () => {
      await service.handlePaymentRegistered(mockPaymentRegisteredEvent);

      expect(mockEmailService.queueInvoice).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({
          invoiceNumber: "REC-payment-123",
          amount: 80000,
          // El nombre sale del cliente resuelto, no de un literal.
          clientName: "Juan Cliente",
        })
      );
    });

    // Un caso por cada valor del enum, para que la condición no pueda quedar
    // colgada de un literal que el enum no produce.
    it.each([
      [PaymentMethod.CASH, true],
      [PaymentMethod.TRANSFER, true],
      [PaymentMethod.CARD, false],
      [PaymentMethod.OTHER, false],
    ])("con %s el recibo por correo sale: %s", async (method, esperado) => {
      await service.handlePaymentRegistered(pagadoCon(method));

      expect(mockEmailService.queueInvoice).toHaveBeenCalledTimes(
        esperado ? 1 : 0
      );
    });

    it("avisa del cobro dentro de la aplicación sea cual sea el método", async () => {
      await service.handlePaymentRegistered(pagadoCon(PaymentMethod.CARD));

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "PAYMENT_REGISTERED",
        })
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichClientEmail.mockRejectedValue(new Error("Error"));

      await expect(
        service.handlePaymentRegistered(mockPaymentRegisteredEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleAppointmentCompleted", () => {
    const mockAppointmentCompletedEvent = {
      eventType: "booking.appointment.completed",
      eventId: "evt-131",
      correlationId: "corr-131",
      timestamp: new Date(),
      payload: {
        appointmentId: "appointment-131",
        clientId: "client-123",
        professionalId: "professional-123",
        businessId: "business-123",
        date: "2026-08-01",
        startTime: "10:00",
        endTime: "11:00",
        totalAmount: 50000,
        pointsEarned: 5000,
      },
    } as any;

    it("invita al cliente a dejar su reseña", async () => {
      await service.handleAppointmentCompleted(mockAppointmentCompletedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "APPOINTMENT_COMPLETED",
        })
      );
    });

    it("no avisa a quien reservó sin cuenta", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockResolvedValue({
        ...enrichedData,
        clientUserId: null,
      });

      await service.handleAppointmentCompleted(mockAppointmentCompletedEvent);

      expect(mockNotifications.create).not.toHaveBeenCalled();
    });
  });
});
