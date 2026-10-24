import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { EmailService } from "./email.service";
import { PlantillasService } from "./plantillas.service";
import { SmtpTransport } from "./smtp.transport";

const APP = "https://appbeautyspot.com";

/** Una cita como la arman los listeners. */
const CITA = {
  appointmentId: "cita-1",
  conCuenta: true,
  clientName: "Pedro Gómez",
  professionalName: "Ana",
  serviceName: "Tinte",
  duration: 90,
  appointmentDate: "2026-10-25",
  appointmentTime: "14:00",
  endTime: "15:30",
  businessName: "EliteBarbers",
  businessAddress: "Av. 456",
  businessPhone: "555-5678",
  timezone: "America/Bogota",
};

describe("EmailService", () => {
  let service: EmailService;
  let mockQueue: jest.Mocked<Queue>;
  let plantillas: { render: jest.Mock; disponibles: string[] };
  let smtp: { enviar: jest.Mock };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: "job-1" }),
    } as unknown as jest.Mocked<Queue>;

    plantillas = {
      render: jest.fn(
        (nombre: string) =>
          `<html><head><style>.x{}</style></head><body><p>Correo ${nombre}</p></body></html>`
      ),
      disponibles: [],
    };
    smtp = { enviar: jest.fn().mockResolvedValue({ messageId: "msg-1" }) };

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PlantillasService, useValue: plantillas },
        { provide: SmtpTransport, useValue: smtp },
        { provide: "BullQueue_emails", useValue: mockQueue },
        {
          provide: ConfigService,
          useValue: new ConfigService({ APP_URL: APP }),
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  /** El contexto con que se encoló el último correo. */
  const encolado = () =>
    (
      mockQueue.add.mock.calls.at(-1) as [
        string,
        {
          template: string;
          priority: string;
          context: Record<string, unknown>;
        },
      ]
    )[1];

  describe("sendEmail", () => {
    it("renderiza, entrega y manda un texto plano sin los estilos", async () => {
      const result = await service.sendEmail("c@example.com", "welcome-email", {
        subject: "Hola",
      });

      expect(result).toEqual({ messageId: "msg-1" });
      expect(smtp.enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "c@example.com",
          subject: "Hola",
          text: "Correo welcome-email",
        })
      );
    });

    it("firma con el negocio cuando el correo es de una cita suya", async () => {
      await service.sendEmail("c@example.com", "appointment-confirmed", {
        subject: "Confirmada",
        remitente: "EliteBarbers",
      });

      expect(smtp.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ remitente: "EliteBarbers" })
      );
    });

    it("propaga el fallo de una plantilla que no existe", async () => {
      plantillas.render.mockImplementation(() => {
        throw new Error("Template no-existe not found");
      });

      await expect(
        service.sendEmail("c@example.com", "no-existe", {})
      ).rejects.toThrow("Template no-existe not found");
      expect(smtp.enviar).not.toHaveBeenCalled();
    });
  });

  describe("correos de una cita", () => {
    it.each([
      [
        "queueAppointmentCreated",
        "appointment-created",
        "high",
        "Recibimos tu solicitud para el domingo 25 de octubre",
      ],
      [
        "queueAppointmentConfirmation",
        "appointment-confirmed",
        "high",
        "Tu cita del domingo 25 de octubre está confirmada",
      ],
      [
        "queueAppointmentReminder24h",
        "appointment-reminder-24h",
        "normal",
        "Mañana a las 14:00 te esperamos",
      ],
      [
        "queueAppointmentReminder1h",
        "appointment-reminder-1h",
        "high",
        "Tu cita es en una hora",
      ],
      [
        "queueAppointmentCancelled",
        "appointment-cancelled",
        "normal",
        "Tu cita del domingo 25 de octubre se canceló",
      ],
    ] as const)(
      "%s usa %s con prioridad %s y su asunto",
      async (metodo, plantilla, prioridad, asunto) => {
        const resultado = await service[metodo]("p@example.com", CITA);

        expect(resultado).toEqual({ jobId: "job-1", subject: asunto });
        expect(encolado()).toEqual(
          expect.objectContaining({ template: plantilla, priority: prioridad })
        );
        // Lo firma el negocio, no la plataforma.
        expect(encolado().context.remitente).toBe("EliteBarbers");
      }
    );

    it("lleva los enlaces de la cita", async () => {
      await service.queueAppointmentConfirmation("p@example.com", CITA);

      const contexto = encolado().context;
      expect(contexto.enlaceCita).toBe(
        `${APP}/dashboard/client/appointments/cita-1`
      );
      expect(String(contexto.enlaceCalendario)).toContain(
        "dates=20261025T140000%2F20261025T153000"
      );
      expect(String(contexto.enlaceMapa)).toContain("Av.%20456");
    });
  });

  describe("factura y recibo", () => {
    const FACTURA = {
      clientName: "Pedro",
      invoiceNumber: "FA-0001",
      invoiceDate: "2026-10-25",
      businessName: "EliteBarbers",
      services: [{ name: "Corte", price: 50000 }],
      amount: 59500,
      subtotal: 50000,
      tax: 9500,
      conCuenta: true,
    };

    it("pasa los importes como números para que la plantilla los escriba", async () => {
      await service.queueInvoice("p@example.com", FACTURA);

      const contexto = encolado().context;
      expect(contexto.items).toEqual([{ name: "Corte", amount: 50000 }]);
      expect(contexto.total).toBe(59500);
      expect(contexto.enlaceFacturas).toBe(`${APP}/dashboard/client/invoices`);
      expect(contexto.subject).toBe("Tu factura FA-0001 de EliteBarbers");
    });

    it("el recibo se llama recibo y no ofrece facturas a quien no tiene cuenta", async () => {
      await service.queueInvoice("p@example.com", {
        ...FACTURA,
        esRecibo: true,
        conCuenta: false,
      });

      const contexto = encolado().context;
      expect(contexto.subject).toBe("Tu recibo de EliteBarbers");
      expect(contexto.enlaceFacturas).toBeUndefined();
    });
  });

  describe("correos de cuenta", () => {
    it.each([
      [
        "queuePasswordReset",
        { clientName: "Pedro", resetLink: "https://x/y", expiryHours: 1 },
        "password-reset",
        "high",
        "Restablece tu contraseña de BeautySpot",
      ],
      [
        "queueEmailVerification",
        {
          clientName: "Pedro",
          verificationLink: "https://x/y",
          expiryHours: 24,
        },
        "email-verification",
        "high",
        "Confirma tu correo para entrar en BeautySpot",
      ],
      [
        "queueRegistroDuplicado",
        { clientName: "Pedro", recoveryLink: "https://x/y" },
        "registro-duplicado",
        "high",
        "Ya tienes una cuenta en BeautySpot",
      ],
      [
        "queueWelcomeEmail",
        { clientName: "Pedro" },
        "welcome-email",
        "low",
        "Te damos la bienvenida a BeautySpot",
      ],
      [
        "queueBienvenidaNegocio",
        { clientName: "Pedro", businessName: "EliteBarbers" },
        "bienvenida-negocio",
        "low",
        "EliteBarbers ya está en BeautySpot",
      ],
      [
        "queueBienvenidaEquipo",
        { clientName: "Pedro", businessName: "EliteBarbers" },
        "bienvenida-equipo",
        "low",
        "Ya tienes acceso al equipo de EliteBarbers",
      ],
    ] as const)(
      "%s usa %s",
      async (metodo, datos, plantilla, prioridad, asunto) => {
        const encolar = service[metodo] as (
          to: string,
          data: unknown
        ) => Promise<{ jobId: string; subject: string }>;

        expect(await encolar.call(service, "p@example.com", datos)).toEqual({
          jobId: "job-1",
          subject: asunto,
        });
        expect(encolado()).toEqual(
          expect.objectContaining({ template: plantilla, priority: prioridad })
        );
        // Los firma BeautySpot: no llevan remitente de negocio.
        expect(encolado().context.remitente).toBeUndefined();
      }
    );

    it("el registro duplicado ofrece entrar además de recuperar la contraseña", async () => {
      await service.queueRegistroDuplicado("p@example.com", {
        clientName: "Pedro",
        recoveryLink: `${APP}/forgot-password`,
      });

      expect(encolado().context.loginLink).toBe(`${APP}/login`);
    });
  });

  it("la reseña y el cumpleaños saludan por el nombre de pila", async () => {
    await service.queueReviewRequest("p@example.com", {
      clientName: "Pedro Gómez",
      businessName: "EliteBarbers",
      professionalName: "Ana",
      reviewLink: "https://x/y",
    });
    expect(encolado().context.subject).toBe("¿Qué tal tu visita, Pedro?");

    await service.queueBirthdayGreeting("p@example.com", {
      clientName: "Pedro Gómez",
      businessName: "EliteBarbers",
    });
    expect(encolado().context.subject).toBe("Feliz cumpleaños, Pedro");
    expect(encolado().context.enlaceReservar).toBe(
      `${APP}/marketplace?q=EliteBarbers`
    );
  });

  it("el reporte mensual deja los importes en número y enlaza a Reportes", async () => {
    await service.queueMonthlyReport("dueno@example.com", {
      businessName: "EliteBarbers",
      month: "agosto",
      year: "2026",
      totalRevenue: 1250000,
      totalAppointments: 42,
      topService: "Tinte",
      topServiceRevenue: 450000,
      clientName: "Dueño",
    });

    const contexto = encolado().context;
    expect(contexto.totalRevenue).toBe(1250000);
    expect(contexto.enlaceReportes).toBe(`${APP}/dashboard/analytics`);
    expect(contexto.subject).toBe("Así fue agosto en EliteBarbers");
  });
});
