import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { InternalHttpClient } from "@beautyspot/nest-common";
import { ClienteListeners } from "./cliente.listeners";
import { crearEntornoDeListeners } from "./listeners.fixtures";

describe("ClienteListeners", () => {
  let listeners: ClienteListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockDataEnricher: jest.Mocked<DataEnricherService>;
  let mockNotifications: { create: jest.Mock };
  let mockHttp: jest.Mocked<InternalHttpClient>;
  let mockPreferencias: { isNotificationEnabled: jest.Mock };

  beforeEach(async () => {
    const entorno = await crearEntornoDeListeners();
    listeners = entorno.modulo.get(ClienteListeners);
    mockEmailService = entorno.emails;
    mockDataEnricher = entorno.enricher;
    mockNotifications = entorno.notificaciones;
    mockHttp = entorno.http;
    mockPreferencias = entorno.preferencias;
  });

  describe("handleReviewCreated", () => {
    const mockReviewCreatedEvent = {
      eventType: "marketplace.review.created",
      eventId: "evt-130",
      correlationId: "corr-130",
      timestamp: new Date(),
      payload: {
        reviewId: "review-123",
        businessId: "business-123",
        clientId: "client-123",
        professionalId: "professional-123",
        rating: 5,
        comment: "Excelente servicio",
      },
    };

    it("avisa al negocio de la reseña recibida", async () => {
      await listeners.handleReviewCreated(mockReviewCreatedEvent);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-dueno",
          businessId: "business-123",
          type: "REVIEW_RECEIVED",
        })
      );
    });

    it("concuerda el singular cuando la reseña es de una estrella", async () => {
      await listeners.handleReviewCreated({
        ...mockReviewCreatedEvent,
        payload: { ...mockReviewCreatedEvent.payload, rating: 1 },
      });

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("1 estrella."),
        })
      );
    });

    it("no avisa a quien no gestiona el negocio", async () => {
      mockHttp.pedirONulo.mockResolvedValue([
        { userId: "user-pro", role: "PROFESSIONAL" },
      ] as never);

      await listeners.handleReviewCreated(mockReviewCreatedEvent);

      expect(mockNotifications.create).not.toHaveBeenCalled();
    });
  });

  describe("handleClientBirthday", () => {
    const mockClientBirthdayEvent = {
      eventType: "core.client.birthday",
      eventId: "evt-131",
      correlationId: "corr-131",
      timestamp: new Date(),
      payload: {
        clientId: "client-123",
        businessId: "business-123",
        name: "Ana Gómez",
        email: "ana@example.com",
        year: 2026,
      },
    };

    it("felicita por correo y dentro de la aplicación", async () => {
      await listeners.handleClientBirthday(mockClientBirthdayEvent);

      expect(mockEmailService.queueBirthdayGreeting).toHaveBeenCalledWith(
        "ana@example.com",
        expect.objectContaining({
          clientName: "Ana Gómez",
          businessName: "EliteBarbers",
          year: 2026,
        })
      );
      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-cliente",
          businessId: "business-123",
          type: "BIRTHDAY",
        })
      );
    });

    it("sin correo en la ficha, solo deja el aviso en la aplicación", async () => {
      await listeners.handleClientBirthday({
        ...mockClientBirthdayEvent,
        payload: { ...mockClientBirthdayEvent.payload, email: undefined },
      });

      expect(mockEmailService.queueBirthdayGreeting).not.toHaveBeenCalled();
      expect(mockNotifications.create).toHaveBeenCalled();
    });

    it("no deja aviso en la aplicación a quien no tiene cuenta", async () => {
      mockDataEnricher.enrichClientUserId.mockResolvedValue(null);

      await listeners.handleClientBirthday(mockClientBirthdayEvent);

      expect(mockEmailService.queueBirthdayGreeting).toHaveBeenCalled();
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

    it("respeta que el cliente haya silenciado los cumpleaños", async () => {
      mockPreferencias.isNotificationEnabled.mockResolvedValue(false);

      await listeners.handleClientBirthday(mockClientBirthdayEvent);

      expect(mockNotifications.create).not.toHaveBeenCalled();
    });
  });
});
