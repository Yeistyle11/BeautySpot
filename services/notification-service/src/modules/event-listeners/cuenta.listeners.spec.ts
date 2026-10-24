import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { CuentaListeners } from "./cuenta.listeners";
import { crearEntornoDeListeners } from "./listeners.fixtures";

describe("CuentaListeners", () => {
  let listeners: CuentaListeners;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockAmqpConnection: { publish: jest.Mock };
  let mockDataEnricher: jest.Mocked<DataEnricherService>;

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

  const mockRegistroDuplicadoEvent = {
    eventType: "auth.registro.duplicado",
    eventId: "evt-131",
    correlationId: "corr-131",
    timestamp: new Date(),
    payload: {
      email: "yatengo@example.com",
      name: "Dueña de la cuenta",
    },
  };

  beforeEach(async () => {
    const entorno = await crearEntornoDeListeners();
    listeners = entorno.modulo.get(CuentaListeners);
    mockEmailService = entorno.emails;
    mockAmqpConnection = entorno.amqp as unknown as { publish: jest.Mock };
    mockDataEnricher = entorno.enricher;
  });

  describe("bienvenidas", () => {
    // Quien entra por un negocio no viene a reservar: su bienvenida es la del
    // equipo, con el nombre del negocio que le dio acceso.
    it("da la bienvenida de equipo a quien dio de alta un negocio", async () => {
      await listeners.handleUserRegistered({
        ...mockUserRegisteredEvent,
        payload: {
          ...mockUserRegisteredEvent.payload,
          businessId: "business-123",
        },
      });

      expect(mockEmailService.queueBienvenidaEquipo).toHaveBeenCalledWith(
        "newuser@example.com",
        { clientName: "New User", businessName: "EliteBarbers" }
      );
      expect(mockEmailService.queueWelcomeEmail).not.toHaveBeenCalled();
    });

    it("da la bienvenida del negocio a su dueño al crearlo", async () => {
      await listeners.handleBusinessCreated({
        eventType: "core.business.created",
        eventId: "evt-200",
        correlationId: "corr-200",
        timestamp: new Date(),
        payload: {
          businessId: "business-200",
          slug: "barberia-la-noche",
          name: "Barbería La Noche",
          businessType: "BARBERSHOP",
          ownerId: "user-dueno",
        },
      });

      expect(mockDataEnricher.enrichUserContact).toHaveBeenCalledWith(
        "user-dueno"
      );
      expect(mockEmailService.queueBienvenidaNegocio).toHaveBeenCalledWith(
        "dueno@example.com",
        { clientName: "Yeison García", businessName: "Barbería La Noche" }
      );
    });

    it("sin el correo del dueño no envía nada", async () => {
      mockDataEnricher.enrichUserContact.mockResolvedValue(null);

      await listeners.handleBusinessCreated({
        eventType: "core.business.created",
        eventId: "evt-201",
        correlationId: "corr-201",
        timestamp: new Date(),
        payload: {
          businessId: "business-201",
          slug: "spa",
          name: "Spa",
          businessType: "SPA",
          ownerId: "user-x",
        },
      });

      expect(mockEmailService.queueBienvenidaNegocio).not.toHaveBeenCalled();
    });
  });

  describe("handleUserRegistered", () => {
    it("debería manejar evento de usuario registrado exitosamente", async () => {
      await listeners.handleUserRegistered(mockUserRegisteredEvent);

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
        listeners.handleUserRegistered(mockUserRegisteredEvent)
      ).rejects.toThrow();

      expect(mockAmqpConnection.publish).not.toHaveBeenCalled();
    });
  });

  describe("handlePasswordResetRequested", () => {
    it("debería encolar email de reset con link construido", async () => {
      await listeners.handlePasswordResetRequested(mockPasswordResetEvent);

      expect(mockEmailService.queuePasswordReset).toHaveBeenCalledWith(
        "reset@example.com",
        expect.objectContaining({
          clientName: "Reset User",
          resetLink: "http://localhost:8080/reset-password?token=raw-token-abc",
          expiryHours: expect.any(Number),
        })
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalled();
    });

    it("debería propagar el error para que el mensaje llegue a la cola de fallidos", async () => {
      mockEmailService.queuePasswordReset.mockRejectedValue(new Error("Error"));

      await expect(
        listeners.handlePasswordResetRequested(mockPasswordResetEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleEmailVerificationRequested", () => {
    it("encola el correo con el enlace de confirmación", async () => {
      await listeners.handleEmailVerificationRequested(
        mockEmailVerificationEvent
      );

      expect(mockEmailService.queueEmailVerification).toHaveBeenCalledWith(
        "nuevo@example.com",
        expect.objectContaining({
          clientName: "Nuevo Usuario",
          verificationLink:
            "http://localhost:8080/verify-email?token=raw-token-xyz",
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
        listeners.handleEmailVerificationRequested(mockEmailVerificationEvent)
      ).rejects.toThrow();
    });
  });

  describe("handleRegistroDuplicado", () => {
    it("avisa al dueño de la cuenta y le da por dónde recuperarla", async () => {
      await listeners.handleRegistroDuplicado(mockRegistroDuplicadoEvent);

      expect(mockEmailService.queueRegistroDuplicado).toHaveBeenCalledWith(
        "yatengo@example.com",
        {
          clientName: "Dueña de la cuenta",
          recoveryLink: "http://localhost:8080/forgot-password",
        }
      );
      expect(mockAmqpConnection.publish).toHaveBeenCalled();
    });

    it("no manda ningún enlace que abra la cuenta", async () => {
      await listeners.handleRegistroDuplicado(mockRegistroDuplicadoEvent);

      const [, datos] = mockEmailService.queueRegistroDuplicado.mock.calls[0];
      expect(JSON.stringify(datos)).not.toContain("token");
    });
  });
});
