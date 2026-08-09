import { Test } from "@nestjs/testing";
import { DataSource, Repository } from "typeorm";
import { OutboxService } from "@beautyspot/nest-common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { InvoicesService } from "./invoices.service";
import { InvoiceEntity } from "./invoice.entity";
import { InvoiceItemEntity } from "./invoice-item.entity";
import { InvoiceStatus } from "@beautyspot/shared-types";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PdfService } from "./pdf/pdf.service";
import { InternalHttpClient } from "@beautyspot/nest-common";

/** Emisor y receptor tal y como los resuelve el core-service. */
const PERFILES = {
  client: { name: "Juan Pérez", documento: "1020304050" },
  business: {
    name: "Salón Aurora",
    address: "Carrera 7 #12-34",
    phone: "+57 320 000 0000",
    email: "hola@aurora.co",
    facturacion: {
      nit: "901555222-3",
      razonSocial: "Aurora Belleza S.A.S.",
      direccionFiscal: "Carrera 7 #12-34 of. 201",
    },
  },
};

describe("InvoicesService", () => {
  let service: InvoicesService;
  let mockInvoiceRepo: jest.Mocked<Repository<InvoiceEntity>>;
  let mockItemRepo: jest.Mocked<Repository<InvoiceItemEntity>>;
  let mockPdfService: jest.Mocked<PdfService>;
  let mockReservarNumero: jest.Mock;
  let mockHttp: { pedir: jest.Mock };

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
    subtotal: 30000,
    taxRate: 0.19,
    tax: 5700,
    total: 35700,
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
      findAndCount: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    } as any;

    mockItemRepo = {
      create: jest.fn(),
    } as any;

    mockPdfService = {
      generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("PDF data")),
    } as any;

    mockHttp = { pedir: jest.fn().mockResolvedValue(PERFILES) };

    const mockOutboxSpec = { enqueue: jest.fn().mockResolvedValue(undefined) };
    // La transacción entrega el repositorio simulado y resuelve la reserva del
    // número de factura, que ahora sale de una secuencia por negocio.
    mockReservarNumero = jest.fn().mockResolvedValue([{ last_number: 1 }]);
    const mockDataSourceSpec = {
      transaction: jest.fn((cb) =>
        cb({
          getRepository: jest.fn().mockReturnValue(mockInvoiceRepo),
          query: mockReservarNumero,
        })
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        { provide: DataSource, useValue: mockDataSourceSpec },
        { provide: OutboxService, useValue: mockOutboxSpec },
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
        {
          provide: InternalHttpClient,
          useValue: mockHttp,
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

      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      const result = await service.create("business-123", dto);

      expect(mockReservarNumero).toHaveBeenCalled();
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

      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.dueDate).toBeDefined();
      expect(createCall.status).toBe(InvoiceStatus.DRAFT);
    });

    it("guarda el desglose del impuesto, no solo el total", async () => {
      const dto = {
        clientId: "client-123",
        items: [{ description: "Corte", quantity: 1, unitPrice: 100000 }],
      };

      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall).toMatchObject({
        subtotal: 100000,
        taxRate: 0.19,
        tax: 19000,
        total: 119000,
      });
      // El total tiene que ser exactamente la suma de sus partes.
      expect(createCall.total).toBe(createCall.subtotal! + createCall.tax!);
    });

    it("debería calcular la base imponible sumando las líneas", async () => {
      const dto = {
        clientId: "client-123",
        items: [
          { description: "Corte", quantity: 2, unitPrice: 30000 },
          { description: "Barba", quantity: 1, unitPrice: 20000 },
        ],
      };

      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.subtotal).toBe(80000);
    });

    it("debería numerar la factura con la serie del negocio", async () => {
      const dto = {
        clientId: "client-123",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      };

      mockReservarNumero.mockResolvedValue([{ last_number: 6 }]);
      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockResolvedValue(mockInvoice);

      await service.create("business-123", dto);

      // La serie es de cada negocio, así que el número se reserva contra la
      // secuencia de ese negocio, no contando las facturas de la tabla.
      const [sql, parametros] = mockReservarNumero.mock.calls[0];
      expect(sql).toContain("invoice_sequences");
      expect(parametros[0]).toBe("business-123");

      const createCall = mockInvoiceRepo.create.mock.calls[0][0];
      expect(createCall.number).toMatch(/^INV-\d{4}-000006$/);
    });

    it("debería reservar el número dentro de la transacción de la factura", async () => {
      const dto = {
        clientId: "client-123",
        items: [{ description: "Corte", quantity: 1, unitPrice: 30000 }],
      };

      mockItemRepo.create.mockReturnValue(mockInvoiceItem);
      mockInvoiceRepo.create.mockReturnValue(mockInvoice);
      mockInvoiceRepo.save.mockRejectedValue(new Error("fallo al guardar"));

      await expect(service.create("business-123", dto)).rejects.toThrow();

      // Reservarlo fuera dejaría un hueco en la serie cada vez que el guardado
      // fallara.
      expect(mockReservarNumero).toHaveBeenCalled();
    });
  });

  describe("findByBusiness", () => {
    const paginacion = {
      page: 1,
      limit: 20,
      offset: 0,
      sort: "createdAt",
      order: "DESC" as const,
    };

    it("debería retornar facturas del negocio paginadas", async () => {
      const invoices = [mockInvoice];
      mockInvoiceRepo.findAndCount.mockResolvedValue([invoices, 1]);

      const result = await service.findByBusiness(
        "business-123",
        {},
        paginacion
      );

      expect(mockInvoiceRepo.findAndCount).toHaveBeenCalledWith({
        where: { businessId: "business-123" },
        relations: ["items"],
        skip: 0,
        take: 20,
        order: { createdAt: "DESC" },
      });
      expect(result.data).toEqual(invoices);
      expect(result.meta.total).toBe(1);
    });

    it("debería acotar el número de facturas devueltas", async () => {
      mockInvoiceRepo.findAndCount.mockResolvedValue([[mockInvoice], 5000]);

      await service.findByBusiness(
        "business-123",
        {},
        { ...paginacion, limit: 50, offset: 100, page: 3 }
      );

      expect(mockInvoiceRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 50 })
      );
    });

    it("debería filtrar por estado", async () => {
      mockInvoiceRepo.findAndCount.mockResolvedValue([[mockInvoice], 1]);

      await service.findByBusiness(
        "business-123",
        { status: InvoiceStatus.PAID },
        paginacion
      );

      expect(mockInvoiceRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: "business-123", status: InvoiceStatus.PAID },
        })
      );
    });

    it("debería filtrar por rango de fechas", async () => {
      mockInvoiceRepo.findAndCount.mockResolvedValue([[mockInvoice], 1]);

      await service.findByBusiness(
        "business-123",
        { from: "2026-01-01", to: "2026-01-31" },
        paginacion
      );

      expect(mockInvoiceRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdAt: expect.anything() }),
        })
      );
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
    /** Deja la factura en el estado indicado antes de intentar la transición. */
    const facturaEn = (status: InvoiceStatus) =>
      mockInvoiceRepo.findOne.mockResolvedValue({
        ...mockInvoice,
        status,
      } as any);

    it("debería actualizar el estado de la factura", async () => {
      mockInvoiceRepo.update.mockResolvedValue({ affected: 1 } as any);
      facturaEn(InvoiceStatus.SENT);

      await service.updateStatus(
        "invoice-123",
        "business-123",
        InvoiceStatus.PAID
      );

      expect(mockInvoiceRepo.update).toHaveBeenCalledWith(
        { id: "invoice-123", businessId: "business-123" },
        { status: InvoiceStatus.PAID }
      );
    });

    it("emite un borrador antes de darlo por pagado", async () => {
      mockInvoiceRepo.update.mockResolvedValue({ affected: 1 } as any);
      facturaEn(InvoiceStatus.DRAFT);

      await expect(
        service.updateStatus("invoice-123", "business-123", InvoiceStatus.SENT)
      ).resolves.toBeDefined();
    });

    it.each([
      [InvoiceStatus.DRAFT, InvoiceStatus.PAID],
      [InvoiceStatus.PAID, InvoiceStatus.DRAFT],
      [InvoiceStatus.CANCELLED, InvoiceStatus.PAID],
      [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
    ])("no deja pasar de %s a %s", async (desde, hasta) => {
      facturaEn(desde);

      await expect(
        service.updateStatus("invoice-123", "business-123", hasta)
      ).rejects.toThrow(BadRequestException);
      expect(mockInvoiceRepo.update).not.toHaveBeenCalled();
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

    it("imprime el desglose tal y como se guardó al emitir", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockPdfService.generateInvoicePdf.mockResolvedValue(
        Buffer.from("PDF data")
      );

      await service.generateInvoicePdf("invoice-123", "business-123");

      // Los importes salen de la factura, no de deducirlos del total.
      const pdfData = mockPdfService.generateInvoicePdf.mock.calls[0][0];
      expect(pdfData).toMatchObject({
        subtotal: 30000,
        taxRate: 0.19,
        tax: 5700,
        total: 35700,
      });
      expect(pdfData.subtotal + pdfData.tax).toBe(pdfData.total);
    });

    it("identifica al negocio emisor y al cliente reales", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);

      await service.generateInvoicePdf("invoice-123", "business-123");

      const pdfData = mockPdfService.generateInvoicePdf.mock.calls[0][0];
      expect(pdfData.business).toMatchObject({
        // La razón social y la dirección fiscal mandan sobre las comerciales.
        name: "Aurora Belleza S.A.S.",
        nit: "901555222-3",
        address: "Carrera 7 #12-34 of. 201",
        email: "hola@aurora.co",
      });
      expect(pdfData.client).toEqual({
        name: "Juan Pérez",
        document: "1020304050",
      });
      expect(mockHttp.pedir).toHaveBeenCalledWith(
        "core",
        expect.stringContaining("/internal/profiles/resolve")
      );
    });

    it("cae al nombre comercial cuando no hay datos fiscales configurados", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockHttp.pedir.mockResolvedValue({
        client: null,
        business: { ...PERFILES.business, facturacion: {} },
      });

      await service.generateInvoicePdf("invoice-123", "business-123");

      const pdfData = mockPdfService.generateInvoicePdf.mock.calls[0][0];
      expect(pdfData.business).toMatchObject({
        name: "Salón Aurora",
        nit: "",
        address: "Carrera 7 #12-34",
      });
      // Sin cliente resuelto se deja en blanco, nunca un documento inventado.
      expect(pdfData.client).toEqual({ name: "", document: "" });
    });

    it("no emite la factura si no puede resolver al negocio", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(mockInvoice);
      mockHttp.pedir.mockResolvedValue({ client: null, business: null });

      await expect(
        service.generateInvoicePdf("invoice-123", "business-123")
      ).rejects.toThrow(NotFoundException);
      expect(mockPdfService.generateInvoicePdf).not.toHaveBeenCalled();
    });

    it("debería lanzar NotFoundException si la factura no existe", async () => {
      mockInvoiceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateInvoicePdf("non-existent", "business-123")
      ).rejects.toThrow(NotFoundException);
    });
  });
});
