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
