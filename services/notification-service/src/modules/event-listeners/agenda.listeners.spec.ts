import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { AgendaListeners } from "./agenda.listeners";
import {
  crearEntornoDeListeners,
  DATOS_ENRIQUECIDOS,
} from "./listeners.fixtures";

describe("AgendaListeners", () => {
  let listeners: AgendaListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockAmqpConnection: { publish: jest.Mock };
  let mockDataEnricher: jest.Mocked<DataEnricherService>;
  let mockNotifications: { create: jest.Mock };
  let mockHttp: jest.Mocked<InternalHttpClient>;
  let mockPreferencias: { isNotificationEnabled: jest.Mock };

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

  beforeEach(async () => {
    const entorno = await crearEntornoDeListeners();
    listeners = entorno.modulo.get(AgendaListeners);
    mockEmailService = entorno.emails;
    mockAmqpConnection = entorno.amqp as unknown as { publish: jest.Mock };
    mockDataEnricher = entorno.enricher;
    mockNotifications = entorno.notificaciones;
    mockHttp = entorno.http;
    mockPreferencias = entorno.preferencias;
  });

  describe("handleAppointmentConfirmed", () => {
    it("deja también la notificación dentro de la aplicación", async () => {
      await listeners.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      // El listener manda el correo y además alimenta la bandeja de la app.
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          businessId: "business-123",
          type: "APPOINTMENT_CONFIRMED",
        })
      );
    });

    it("nombra en el correo el servicio que se reservó", async () => {
      await listeners.handleAppointmentConfirmed({
        ...mockAppointmentConfirmedEvent,
        payload: {
          ...mockAppointmentConfirmedEvent.payload,
          services: [
            { serviceId: "s-1", name: "Corte", price: 30000, duration: 30 },
          ],
        },
      });

      expect(
        mockEmailService.queueAppointmentConfirmation
      ).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ serviceName: "Corte" })
      );
    });

    it("enumera los servicios cuando la cita lleva varios", async () => {
      await listeners.handleAppointmentConfirmed({
        ...mockAppointmentConfirmedEvent,
        payload: {
          ...mockAppointmentConfirmedEvent.payload,
          services: [
            { serviceId: "s-1", name: "Lavado", price: 10000, duration: 15 },
            { serviceId: "s-2", name: "Corte", price: 30000, duration: 30 },
            { serviceId: "s-3", name: "Color", price: 60000, duration: 60 },
          ],
        },
      });

      expect(
        mockEmailService.queueAppointmentConfirmation
      ).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ serviceName: "Lavado, Corte y Color" })
      );
    });

    it("mantiene el genérico si el evento viene sin servicios", async () => {
      // El campo es opcional: un evento sin él se consume igual, aunque el
      // correo nombre menos.
      await listeners.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      expect(
        mockEmailService.queueAppointmentConfirmation
      ).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ serviceName: "Servicio" })
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

      await listeners.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

      // Un invitado no tiene dónde leerla; el correo sí se envía.
      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockEmailService.queueAppointmentConfirmation).toHaveBeenCalled();
    });

    it("debería enriquecer datos y enviar a email real del cliente", async () => {
      await listeners.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

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
        listeners.handleAppointmentConfirmed(mockAppointmentConfirmedEvent)
      ).rejects.toThrow();
    });

    // El correo depende de la cola y del proveedor de envío; la notificación
    // dentro de la aplicación, no.
    it("deja la notificación aunque falle el encolado del correo", async () => {
      mockEmailService.queueAppointmentConfirmation.mockRejectedValue(
        new Error("Redis caído")
      );

      await listeners.handleAppointmentConfirmed(mockAppointmentConfirmedEvent);

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
      await listeners.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "APPOINTMENT_CREATED",
        })
      );
    });

    // Una reserva desde el marketplace la dispara el cliente: al negocio no le
    // consta si no se le avisa.
    it("avisa también al equipo del negocio", async () => {
      await listeners.handleAppointmentCreated(mockAppointmentCreatedEvent);

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

      await listeners.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(mockNotifications.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-pro" })
      );
    });

    // Quien reserva desde el marketplace no entra al panel: el aviso in-app no
    // le llega a ninguna parte.
    it("manda el acuse por correo al cliente", async () => {
      await listeners.handleAppointmentCreated(mockAppointmentCreatedEvent);

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
      await listeners.handleAppointmentCreated(mockAppointmentCreatedEvent);

      expect(
        mockEmailService.queueAppointmentConfirmation
      ).not.toHaveBeenCalled();
    });

    it("deja el aviso in-app aunque el correo falle", async () => {
      mockEmailService.queueAppointmentCreated.mockRejectedValue(
        new Error("SMTP caído")
      );

      await listeners.handleAppointmentCreated(mockAppointmentCreatedEvent);

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

      await listeners.handleAppointmentCreated(citaCreada);

      expect(mockNotifications.create).not.toHaveBeenCalled();
      // El correo sigue saliendo: son canales independientes.
      expect(mockEmailService.queueAppointmentCreated).toHaveBeenCalled();
    });

    it("no manda el correo si el usuario lo desactivó", async () => {
      mockPreferencias.isNotificationEnabled.mockImplementation(
        async (_u, _b, _t, canal) => canal !== "EMAIL"
      );

      await listeners.handleAppointmentCreated(citaCreada);

      expect(mockEmailService.queueAppointmentCreated).not.toHaveBeenCalled();
      expect(mockNotifications.create).toHaveBeenCalled();
    });

    it("consulta la preferencia por tipo y canal", async () => {
      await listeners.handleAppointmentCreated(citaCreada);

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
        ...DATOS_ENRIQUECIDOS,
        clientUserId: null,
      });

      await listeners.handleAppointmentCreated(citaCreada);

      expect(mockEmailService.queueAppointmentCreated).toHaveBeenCalled();
    });

    it("si la preferencia no se puede leer, el aviso sale igual", async () => {
      mockPreferencias.isNotificationEnabled.mockRejectedValue(
        new Error("Postgres caído")
      );

      await listeners.handleAppointmentCreated(citaCreada);

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
      await listeners.handleAppointmentRescheduled(
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
      await listeners.handleAppointmentRescheduled(
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
      await listeners.handleAppointmentCancelled(mockAppointmentCancelledEvent);

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

      await listeners.handleAppointmentCancelled(eventWithoutReason);

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
        listeners.handleAppointmentCancelled(mockAppointmentCancelledEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleAppointmentReminder", () => {
    const buildReminderEvent = (reminderType: "24h" | "1h") => ({
      ...mockAppointmentReminderEvent,
      payload: { ...mockAppointmentReminderEvent.payload, reminderType },
    });

    it("debería enviar recordatorio de 24h cuando corresponde", async () => {
      await listeners.handleAppointmentReminder(buildReminderEvent("24h"));

      expect(mockEmailService.queueAppointmentReminder24h).toHaveBeenCalledWith(
        "juan@example.com",
        expect.objectContaining({ clientName: "Juan Cliente" })
      );
      expect(
        mockEmailService.queueAppointmentReminder1h
      ).not.toHaveBeenCalled();
    });

    it("debería enviar recordatorio de 1h cuando corresponde", async () => {
      await listeners.handleAppointmentReminder(buildReminderEvent("1h"));

      expect(mockEmailService.queueAppointmentReminder1h).toHaveBeenCalled();
      expect(
        mockEmailService.queueAppointmentReminder24h
      ).not.toHaveBeenCalled();
    });

    // Cuando toca avisar lo decide booking al emitir el evento; aqui solo se
    // envia.
    it("envía el aviso atrasado, sin recalcular si aún cae en su franja", async () => {
      await listeners.handleAppointmentReminder(buildReminderEvent("1h"));

      expect(mockEmailService.queueAppointmentReminder1h).toHaveBeenCalledTimes(
        1
      );
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockRejectedValue(
        new Error("Error")
      );

      await expect(
        listeners.handleAppointmentReminder(buildReminderEvent("24h"))
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
      await listeners.handleAppointmentCompleted(mockAppointmentCompletedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          type: "APPOINTMENT_COMPLETED",
        })
      );
    });

    it("no avisa a quien reservó sin cuenta", async () => {
      mockDataEnricher.enrichAppointmentParticipants.mockResolvedValue({
        ...DATOS_ENRIQUECIDOS,
        clientUserId: null,
      });

      await listeners.handleAppointmentCompleted(mockAppointmentCompletedEvent);

      expect(mockNotifications.create).not.toHaveBeenCalled();
    });
  });
});
