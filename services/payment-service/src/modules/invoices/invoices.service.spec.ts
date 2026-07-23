import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InvoicesService } from "./invoices.service";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import { InvoiceStatus } from "@beautyspot/shared-types";
import { NotFoundException } from "@nestjs/common";
import { PdfService } from "./pdf/pdf.service";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let mockInvoiceRepo: jest.Mocked<Repository<InvoiceEntity>>;
  let mockItemRepo: jest.Mocked<Repository<InvoiceItemEntity>>;
  let mockPdfService: jest.Mocked<PdfService>;

  const mockInvoiceItem: InvoiceItemEntity = {
    id: "item-123",
    description: "Corte de cabello",
    quantity: 1,
    unitPrice: 30000,
    total: 30000,
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  const mockInvoice: InvoiceEntity = {
    id: "invoice-123",
    businessId: "business-123",
    clientId: "client-123",
    number: "INV-2024-000001",
    date: "2024-01-15",
    dueDate: "2024-02-14",
    total: 30000,
    status: InvoiceStatus.DRAFT,
    notes: "Factura de prueba",
    items: [mockInvoiceItem],
    createdAt: new Date(),
    updatedAt: new Date(),
    generateId: () => {},
  } as any;

  beforeEach(async () => {
    mockInvoiceRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    } as any;

    mockItemRepo = {
      create: jest.fn(),
    } as any;

    mockPdfService = {
      generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("PDF data")),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getRepositoryToken(InvoiceEntity),
          useValue: mockInvoiceRepo,
        },
        {
          provide: getRepositoryToken(InvoiceItemEntity),
          useValue: mockItemRepo,
        },
        {
          provide: PdfService,
          useValue: mockPdfService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe("create", () => {
    it("debería crear una factura exitosamente", async () => {
      const dto = {
        clientId: "client-123",
        items: [
          { description: "Corte de cabello", quantity: 1, unitPrice: 30000 },
          { description: "Barba", quantity: 1, unitPrice: 20000 },
        ],
        notes: "Factura de prueba",
      };

      mockInvoiceRepo.count.mockResolvedValue(0);
      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      const result = await service.create("business-123", dto);

      expect(mockInvoiceRepo.count).toHaveBeenCalled();
      expect(mockItemRepo.create).toHaveBeenCalledTimes(2);
      expect(mockInvoiceRepo.create).toHaveBeenCalled();
      expect(mockInvoiceRepo.save).toHaveBeenCalledWith(mockInvoice);
      expect(result).toEqual(mockInvoice);
    });

    it("debería usar fecha actual si no se proporciona", async () => {
      const dto = {
        clientId: "client-123",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      };

      mockInvoiceRepo.count.mockResolvedValue(0);
      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.date).toBeDefined();
    });

    it("debería usar fecha de vencimiento por defecto", async () => {
      const dto = {
        clientId: "client-123",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      };

      mockInvoiceRepo.count.mockResolvedValue(0);
      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.dueDate).toBeDefined();
      expect(createCall.status).toBe(InvoiceStatus.DRAFT);
    });

    it("debería calcular el total correctamente", async () => {
      const dto = {
        clientId: "client-123",
        items: [
          { description: "Corte", quantity: 2, unitPrice: 30000 },
          { description: "Barba", quantity: 1, unitPrice: 20000 },
        ],
      };

      mockInvoiceRepo.count.mockResolvedValue(0);
      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.total).toBe(80000);
    });

    it("debería generar número de factura secuencial", async () => {
      const dto = {
        clientId: "client-123",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      };

      mockInvoiceRepo.count.mockResolvedValue(5);
      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.number).toMatch(/^INV-\d{4}-000006$/);
    });
  });

  describe("findByBusiness", () => {
    it("debería retornar facturas del negocio", async () => {
      const invoices = [mockInvoice];
      mockInvoiceRepo.find.mockResolvedValue(invoices);

      const result = await service.findByBusiness("business-123");

      expect(mockInvoiceRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        relations: ["items"],
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual(invoices);
    });

    it("debería filtrar por estado", async () => {
      const invoices = [mockInvoice];
      mockInvoiceRepo.find.mockResolvedValue(invoices);

      const result = await service.findByBusiness("business-123", {
        status: InvoiceStatus.PAID,
      });

      expect(mockInvoiceRepo.find).toHaveBeenCalledWith({
        where: { businessId: "business-123", status: InvoiceStatus.PAID },
        relations: ["items"],
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual(invoices);
    });
  });

  describe("findById", () => {
    it("debería retornar factura por ID", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);

      const result = await service.findById("invoice-123", "business-123");

      expect(mockInvoiceRepo.findOne).toHaveBeenCalledWith({
        where: { id: "invoice-123", businessId: "business-123" },
        relations: ["items"],
      });
      expect(result).toEqual(mockInvoice);
    });

    it("debería lanzar NotFoundException si la factura no existe", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findById("non-existent", "business-123")
      ).rejects.toThrow("Factura no encontrada");
    });
  });

  describe("updateStatus", () => {
    it("debería actualizar el estado de la factura", async () => {
      mockInvoiceRepo.update.mockResolvedValue({ affected: 1 } as any);
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);

      const result = await service.updateStatus(
        "invoice-123",
        "business-123",
        InvoiceStatus.PAID
      );

      expect(mockInvoiceRepo.update).toHaveBeenCalledWith(
        { id: "invoice-123", businessId: "business-123" },
        { status: InvoiceStatus.PAID }
      );
      expect(result).toEqual(mockInvoice);
    });
  });

  describe("generateInvoicePdf", () => {
    it("debería generar PDF de factura", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockPdfService.generateInvoicePdf.mockResolvedValue(
        Buffer.from("PDF data")
      );

      const result = await service.generateInvoicePdf(
        "invoice-123",
        "business-123"
      );

      expect(mockPdfService.generateInvoicePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: mockInvoice.number,
          invoiceDate: expect.any(Date),
          dueDate: expect.any(Date),
          total: Number(mockInvoice.total),
        })
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("debería calcular subtotal e impuestos", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockPdfService.generateInvoicePdf.mockResolvedValue(
        Buffer.from("PDF data")
      );

      await service.generateInvoicePdf("invoice-123", "business-123");

      const pdfData = mockPdfService.generateInvoicePdf.mock.calls[0][0];
      expect(pdfData.subtotal).toBe(25200);
      expect(pdfData.tax).toBe(4800);
    });

    it("debería lanzar NotFoundException si la factura no existe", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateInvoicePdf("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });
});
