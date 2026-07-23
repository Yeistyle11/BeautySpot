import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PdfService } from "./pdf.service";
import { InvoiceData } from "./pdf.service";

// Mock de PDFKit completo antes de importar el servicio
jest.mock("pdfkit", () => {
  const mockDoc = {
    on: jest.fn(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    end: jest.fn(),
    page: { height: 842 },
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
  };

  const PDFDocumentMock = jest.fn().mockReturnValue(mockDoc);

  return {
    __esModule: true,
    default: PDFDocumentMock,
  };
});

// Mock de fs y path
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => "Font content string"),
}));

jest.mock("path", () => ({
  join: jest.fn((...args: string[]) => args.join("/")),
}));

describe("PdfService", () => {
  let service: PdfService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockDoc: any;

  beforeEach(async () => {
    // Mock de PDFKit dentro de beforeEach
    mockDoc = {
      on: jest.fn((event: string, callback: Function) => {
        if (event === "data") callback(Buffer.from("pdf-data"));
        if (event === "end") callback();
      }),
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      end: jest.fn(),
      page: { height: 842 },
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
    };

    const PDFDocumentMock = require("pdfkit").default;
    PDFDocumentMock.mockReturnValue(mockDoc);

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === "PDF_STORAGE_PATH")
          return defaultValue || "./temp/invoices";
        return undefined;
      }),
    } as any;

    // Reset mocks
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        PdfService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  describe("generateInvoicePdf", () => {
    it("debería generar un PDF con datos de factura válidos", async () => {
      const invoiceData: InvoiceData = {
        invoiceNumber: "INV-2023-001",
        invoiceDate: new Date("2023-11-15"),
        dueDate: new Date("2023-12-15"),
        business: {
          name: "Beauty Bar",
          nit: "900123456-1",
          address: "Calle 123 #45-67",
          phone: "+57 300 123 4567",
          email: "contact@beautybar.co",
        },
        client: {
          name: "Juan Pérez",
          document: "123456789",
          phone: "+57 310 987 6543",
          email: "juan@example.com",
          address: "Av. 456 #78-90",
        },
        items: [
          { name: "Corte de cabello", quantity: 1, price: 30000 },
          { name: "Barba", quantity: 1, price: 15000 },
        ],
        subtotal: 45000,
        tax: 8550,
        total: 53550,
        paymentMethod: "Efectivo",
        notes: "Gracias por su visita",
      };

      // Mock completo de PDFDocument para evitar errores de fs
      const PDFDocumentMock = jest.fn().mockImplementation(() => ({
        on: jest.fn((event: string, callback: Function) => {
          if (event === "data") callback(Buffer.from("pdf-data"));
          if (event === "end") callback(Buffer.from("pdf-data"));
        }),
        end: jest.fn(),
        fontSize: jest.fn().mockReturnThis(),
        text: jest.fn().mockReturnThis(),
        fillColor: jest.fn().mockReturnThis(),
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        stroke: jest.fn().mockReturnThis(),
        page: { height: 842 },
      }));

      const pdfkit = require("pdfkit");
      pdfkit.default = PDFDocumentMock;

      const result = await service.generateInvoicePdf(invoiceData);

      expect(result).toBeInstanceOf(Buffer);
    });

    it("debería manejar factura sin logo", async () => {
      const invoiceDataWithoutLogo: InvoiceData = {
        invoiceNumber: "INV-2023-002",
        invoiceDate: new Date("2023-11-20"),
        dueDate: new Date("2023-12-20"),
        business: {
          name: "Beauty Bar",
          nit: "900123456-1",
          address: "Calle 123 #45-67",
          phone: "+57 300 123 4567",
          email: "contact@beautybar.co",
        },
        client: {
          name: "María García",
          document: "987654321",
          phone: "+57 310 123 4567",
          email: "maria@example.com",
          address: "Av. 456 #78-90",
        },
        items: [{ name: "Manicura", quantity: 1, price: 25000 }],
        subtotal: 25000,
        tax: 4750,
        total: 29750,
        paymentMethod: "Tarjeta",
      };

      const result = await service.generateInvoicePdf(invoiceDataWithoutLogo);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("formatDate (private method)", () => {
    it("debería formatear fecha en español", () => {
      const date = new Date("2023-11-15T12:00:00-05:00");
      const formatted = (service as any).formatDate(date);

      expect(formatted).toContain("noviembre");
      expect(formatted).toContain("2023");
    });
  });

  describe("formatCurrency (private method)", () => {
    it("debería formatear moneda en pesos colombianos", () => {
      const formatted = (service as any).formatCurrency(50000);

      expect(formatted).toContain("$");
      expect(formatted).toContain("50.000");
    });

    it("debería formatear cero correctamente", () => {
      const formatted = (service as any).formatCurrency(0);

      expect(formatted).toContain("$");
      expect(formatted).toContain("0");
    });
  });

  describe("savePdfToBuffer", () => {
    const fs = require("fs");
    const path = require("path");

    it("debería guardar PDF en el directorio especificado", async () => {
      const pdfBuffer = Buffer.from("pdf-content");
      const filename = "INV-2023-001.pdf";

      fs.existsSync.mockReturnValue(true);
      path.join.mockReturnValue("./temp/invoices/INV-2023-001.pdf");

      const result = await service.savePdfToBuffer(pdfBuffer, filename);

      expect(result).toBe("./temp/invoices/INV-2023-001.pdf");
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "./temp/invoices/INV-2023-001.pdf",
        pdfBuffer
      );
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it("debería crear directorio si no existe", async () => {
      const pdfBuffer = Buffer.from("pdf-content");
      const filename = "INV-2023-002.pdf";

      fs.existsSync.mockReturnValue(false);
      path.join.mockReturnValue("./temp/invoices/INV-2023-002.pdf");

      await service.savePdfToBuffer(pdfBuffer, filename);

      expect(fs.mkdirSync).toHaveBeenCalledWith("./temp/invoices", {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("debería usar ruta personalizada del config", async () => {
      const pdfBuffer = Buffer.from("pdf-content");
      const filename = "INV-2023-003.pdf";

      mockConfigService.get.mockReturnValue("./custom/path");
      fs.existsSync.mockReturnValue(true);
      path.join.mockReturnValue("./custom/path/INV-2023-003.pdf");

      await service.savePdfToBuffer(pdfBuffer, filename);

      expect(mockConfigService.get).toHaveBeenCalledWith(
        "PDF_STORAGE_PATH",
        "./temp/invoices"
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        "./custom/path/INV-2023-003.pdf",
        pdfBuffer
      );
    });
  });
});
