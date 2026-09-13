import { Test } from "@nestjs/testing";
import { Queue } from "bullmq";
import { EmailService } from "./email.service";
import { PlantillasService } from "./plantillas.service";
import { SmtpTransport } from "./smtp.transport";

jest.mock("fs");

describe("EmailService", () => {
  let service: EmailService;
  let mockQueue: jest.Mocked<Queue>;
  let mockFs: any;
  let plantillas: { render: jest.Mock; disponibles: string[] };
  let smtp: { enviar: jest.Mock };

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: "job-123" }),
    } as any;

    // La plantilla renderizada devuelve el contexto, para poder mirarlo.
    plantillas = {
      render: jest.fn(
        (nombre: string, contexto: Record<string, unknown>) =>
          `HTML(${nombre}): ${JSON.stringify(contexto)}`
      ),
      disponibles: ["welcome-email", "invoice-generated"],
    };
    smtp = {
      enviar: jest.fn().mockResolvedValue({ messageId: "msg-123" }),
    };

    mockFs = require("fs");
    mockFs.existsSync = jest.fn().mockReturnValue(true);

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PlantillasService, useValue: plantillas },
        { provide: SmtpTransport, useValue: smtp },
        { provide: "BullQueue_emails", useValue: mockQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("sendEmail", () => {
    it("renderiza la plantilla y la entrega por SMTP", async () => {
      const result = await service.sendEmail(
        "client@example.com",
        "welcome-email",
        { clientName: "Juan" }
      );

      expect(result).toEqual({ messageId: "msg-123" });
      expect(plantillas.render).toHaveBeenCalledWith("welcome-email", {
        clientName: "Juan",
      });
      expect(smtp.enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "client@example.com",
          subject: "BeautySpot - welcome-email",
        })
      );
    });

    it("usa el asunto del contexto cuando lo trae", async () => {
      await service.sendEmail("client@example.com", "password-reset", {
        clientName: "Juan",
        subject: "Recupera tu cuenta",
      });

      expect(smtp.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Recupera tu cuenta" })
      );
    });

    it("propaga el fallo de una plantilla que no existe", async () => {
      plantillas.render.mockImplementation(() => {
        throw new Error("Template non-existent not found");
      });

      await expect(
        service.sendEmail("client@example.com", "non-existent", {})
      ).rejects.toThrow("Template non-existent not found");
      expect(smtp.enviar).not.toHaveBeenCalled();
    });
  });

  describe("sendAppointmentConfirmation", () => {
    it("debería enviar email de confirmación de cita", async () => {
      await service.sendAppointmentConfirmation("maria@example.com", {
        clientName: "Maria",
        professionalName: "Carlos",
        serviceName: "Corte de cabello",
        appointmentDate: "2026-06-16",
        appointmentTime: "10:00",
        businessName: "EliteBarbers",
        businessAddress: "Calle 123",
        businessPhone: "555-1234",
      });

      expect(smtp.enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "maria@example.com",
          subject: "Confirmación de cita en EliteBarbers",
        })
      );
    });
  });

  describe("sendInvoice", () => {
    const factura = {
      clientName: "Juan",
      invoiceNumber: "INV-001",
      amount: 50000,
      dueDate: "2026-07-01",
      businessName: "EliteBarbers",
      services: [{ name: "Corte", price: 50000 }],
    };

    it("debería enviar factura con attachment si existe el PDF", async () => {
      mockFs.existsSync.mockReturnValue(true);

      await service.sendInvoice(
        "juan@example.com",
        factura,
        "/path/to/invoice.pdf"
      );

      expect(smtp.enviar).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Factura #INV-001 - EliteBarbers",
          attachments: [
            { filename: "Factura_INV-001.pdf", path: "/path/to/invoice.pdf" },
          ],
        })
      );
    });

    it("debería enviar factura sin attachment si no existe el PDF", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await service.sendInvoice("juan@example.com", factura, "/no/esta.pdf");

      const [mensaje] = smtp.enviar.mock.calls[0];
      expect(mensaje.attachments).toBeUndefined();
    });
  });

  describe("queueAppointmentConfirmation", () => {
    it("debería agregar trabajo a la cola con prioridad alta", async () => {
      const result = await service.queueAppointmentConfirmation(
        "pedro@example.com",
        {
          clientName: "Pedro",
          professionalName: "Ana",
          serviceName: "Tinte",
          appointmentDate: "2026-06-17",
          appointmentTime: "14:00",
          businessName: "BeautySpot",
          businessAddress: "Av. 456",
          businessPhone: "555-5678",
        }
      );

      expect(result).toEqual({ jobId: "job-123" });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "pedro@example.com",
          template: "appointment-confirmed",
          priority: "high",
        })
      );
    });
  });

  describe("alta repetida", () => {
    it("sale con prioridad alta: es un aviso de seguridad", async () => {
      const result = await service.queueRegistroDuplicado("ya@example.com", {
        clientName: "Dueña",
        recoveryLink: "http://localhost:8080/forgot-password",
      });

      expect(result).toEqual({ jobId: "job-123" });
      expect(mockQueue.add).toHaveBeenCalledWith(
        "send",
        expect.objectContaining({
          to: "ya@example.com",
          template: "registro-duplicado",
          priority: "high",
        })
      );
    });
  });

  describe("importes", () => {
    it("el correo lleva el dinero escrito, no el numero crudo", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await service.sendInvoice("juan@example.com", {
        clientName: "Juan",
        invoiceNumber: "INV-002",
        amount: 50000,
        dueDate: "2026-07-01",
        businessName: "EliteBarbers",
        services: [{ name: "Corte", price: 50000 }],
      });

      const [, contexto] = plantillas.render.mock.calls.at(-1)!;
      expect(contexto.amount).toContain("50.000");
      expect(contexto.amount).not.toBe(50000);
    });
  });
});

/** Cada aviso encolado con su plantilla y su prioridad. */
describe("EmailService · avisos encolados", () => {
  let service: EmailService;
  let mockQueue: jest.Mocked<Queue>;

  const CITA = {
    clientName: "Pedro",
    professionalName: "Ana",
    serviceName: "Tinte",
    appointmentDate: "2026-06-17",
    appointmentTime: "14:00",
    businessName: "BeautySpot",
    businessAddress: "Av. 456",
    businessPhone: "555-5678",
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue({ id: "job-1" }) } as any;

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PlantillasService,
          useValue: { render: jest.fn(() => "HTML"), disponibles: [] },
        },
        {
          provide: SmtpTransport,
          useValue: { enviar: jest.fn().mockResolvedValue({}) },
        },
        { provide: "BullQueue_emails", useValue: mockQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it.each([
    ["queueAppointmentCreated", CITA, "appointment-created", "high"],
    [
      "queueAppointmentCancelled",
      { ...CITA, reason: "El profesional no está" },
      "appointment-cancelled",
      "normal",
    ],
    ["queueAppointmentReminder24h", CITA, "appointment-reminder-24h", "normal"],
    ["queueAppointmentReminder1h", CITA, "appointment-reminder-1h", "high"],
    [
      "queuePasswordReset",
      { clientName: "Pedro", resetLink: "https://x/y", expiryHours: 2 },
      "password-reset",
      "high",
    ],
    [
      "queueEmailVerification",
      { clientName: "Pedro", verificationLink: "https://x/y", expiryHours: 24 },
      "email-verification",
      "high",
    ],
    [
      "queueReviewRequest",
      {
        clientName: "Pedro",
        businessName: "BeautySpot",
        professionalName: "Ana",
        reviewLink: "https://x/y",
      },
      "review-request",
      "low",
    ],
    [
      "queueBirthdayGreeting",
      { clientName: "Pedro", businessName: "BeautySpot", year: 2026 },
      "birthday-greeting",
      "low",
    ],
    [
      "queueWelcomeEmail",
      { clientName: "Pedro", businessName: "BeautySpot" },
      "welcome-email",
      "low",
    ],
  ])("%s usa la plantilla %s", async (metodo, datos, plantilla, prioridad) => {
    const encolar = service[metodo as keyof EmailService] as (
      to: string,
      data: unknown
    ) => Promise<{ jobId: string }>;

    expect(await encolar.call(service, "pedro@example.com", datos)).toEqual({
      jobId: "job-1",
    });
    expect(mockQueue.add).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        to: "pedro@example.com",
        template: plantilla,
        priority: prioridad,
      })
    );
  });

  // El importe viaja ya escrito, no como número.
  it("el reporte mensual encola los importes ya escritos", async () => {
    await service.queueMonthlyReport("dueno@example.com", {
      businessName: "BeautySpot",
      month: "agosto",
      year: "2026",
      totalRevenue: 1250000,
      totalAppointments: 42,
      topService: "Tinte",
      topServiceRevenue: 450000,
      clientName: "Dueño",
    });

    const [, trabajo] = mockQueue.add.mock.calls[0] as [
      string,
      { context: Record<string, unknown> },
    ];
    expect(String(trabajo.context.totalRevenue)).toContain("1.250.000");
    expect(String(trabajo.context.topServiceRevenue)).toContain("450.000");
    expect(String(trabajo.context.subject)).toContain("agosto 2026");
  });

  it("la factura encolada lleva el número en el asunto", async () => {
    await service.queueInvoice("cliente@example.com", {
      clientName: "Pedro",
      invoiceNumber: "FA-0001",
      businessName: "BeautySpot",
      total: 30000,
      issueDate: "2026-09-12",
      pdfPath: "/tmp/fa-0001.pdf",
    } as never);

    expect(mockQueue.add).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({
        template: "invoice-generated",
        context: expect.objectContaining({
          subject: expect.stringContaining("FA-0001"),
        }),
      })
    );
  });
});

/** Los envíos inmediatos, que no pasan por la cola. */
describe("EmailService · envíos directos", () => {
  let service: EmailService;
  let smtp: { enviar: jest.Mock };

  beforeEach(async () => {
    smtp = { enviar: jest.fn().mockResolvedValue({ messageId: "msg-1" }) };

    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PlantillasService,
          useValue: { render: jest.fn(() => "HTML"), disponibles: [] },
        },
        { provide: SmtpTransport, useValue: smtp },
        {
          provide: "BullQueue_emails",
          useValue: { add: jest.fn().mockResolvedValue({ id: "job-1" }) },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it.each([
    ["sendAppointmentReminder24h", "Recordatorio - Cita mañana en BeautySpot"],
    [
      "sendAppointmentReminder1h",
      "Recordatorio - Cita en 1 hora en BeautySpot",
    ],
    ["sendAppointmentCancelled", "Cita cancelada - BeautySpot"],
  ])("%s escribe su asunto", async (metodo, asunto) => {
    const enviar = service[metodo as keyof EmailService] as (
      to: string,
      data: unknown
    ) => Promise<void>;

    await enviar.call(service, "pedro@example.com", {
      clientName: "Pedro",
      professionalName: "Ana",
      serviceName: "Tinte",
      appointmentDate: "2026-06-17",
      appointmentTime: "14:00",
      cancelledDate: "2026-06-16",
      reason: "El profesional no está",
      businessName: "BeautySpot",
      businessAddress: "Av. 456",
    });

    expect(smtp.enviar).toHaveBeenCalledWith(
      expect.objectContaining({ subject: asunto })
    );
  });

  it("el restablecimiento y la bienvenida nombran BeautySpot", async () => {
    await service.sendPasswordReset("pedro@example.com", {
      clientName: "Pedro",
      resetLink: "https://x/y",
      expiryHours: 2,
    });
    await service.sendWelcomeEmail("pedro@example.com", {
      clientName: "Pedro",
    });

    expect(smtp.enviar).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        subject: "Restablecer contraseña - BeautySpot",
      })
    );
    expect(smtp.enviar).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ subject: "Bienvenido a BeautySpot" })
    );
  });

  it("el reporte mensual directo escribe los importes", async () => {
    await service.sendMonthlyReport("dueno@example.com", {
      businessName: "BeautySpot",
      month: "agosto",
      year: "2026",
      totalRevenue: 1250000,
      totalAppointments: 42,
      topService: "Tinte",
      topServiceRevenue: 450000,
      clientName: "Dueño",
    });

    expect(smtp.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reporte mensual - BeautySpot (agosto 2026)",
      })
    );
  });
});
