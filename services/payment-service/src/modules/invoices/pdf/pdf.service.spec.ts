import { Test } from "@nestjs/testing";
import { EventEmitter } from "events";
import { ConfigService } from "@nestjs/config";
import { PdfService, InvoiceData } from "./pdf.service";

jest.mock("worker_threads", () => ({ Worker: jest.fn() }));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("path", () => ({
  join: jest.fn((...args: string[]) => args.join("/")),
}));

/** Worker simulado: registra los encargos recibidos y deja responderlos a mano. */
class WorkerSimulado extends EventEmitter {
  static creados: WorkerSimulado[] = [];
  recibidos: unknown[] = [];
  terminado = false;

  constructor(public ruta: string) {
    super();
    WorkerSimulado.creados.push(this);
  }

  postMessage(data: unknown): void {
    this.recibidos.push(data);
  }

  async terminate(): Promise<number> {
    this.terminado = true;
    return 0;
  }

  /** Devuelve un PDF como lo haría el hilo real. */
  responder(pdf: string): void {
    this.emit("message", { ok: true, pdf: Buffer.from(pdf) });
  }
}

const facturaMinima: InvoiceData = {
  invoiceNumber: "INV-2023-001",
  invoiceDate: new Date("2023-11-15"),
  dueDate: new Date("2023-12-15"),
  business: {
    name: "Beauty Bar",
    nit: "900123456-1",
    address: "Calle 123",
    phone: "+57 300",
    email: "hola@beautybar.co",
  },
  client: { name: "Juan Pérez", document: "123456789" },
  items: [{ name: "Corte", quantity: 1, price: 30000 }],
  subtotal: 30000,
  tax: 5700,
  total: 35700,
  paymentMethod: "Efectivo",
};

describe("PdfService", () => {
  let service: PdfService;
  let mockConfigService: jest.Mocked<ConfigService>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Worker } = require("worker_threads");

  beforeEach(async () => {
    jest.clearAllMocks();
    WorkerSimulado.creados = [];
    Worker.mockImplementation((ruta: string) => new WorkerSimulado(ruta));

    mockConfigService = {
      get: jest.fn(
        (_key: string, defaultValue?: string) =>
          defaultValue || "./temp/invoices"
      ),
    } as never;

    const module = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  describe("generateInvoicePdf", () => {
    it("renderiza fuera del hilo principal y devuelve el Buffer", async () => {
      const promesa = service.generateInvoicePdf(facturaMinima);
      const worker = WorkerSimulado.creados[0];

      expect(worker.ruta).toContain("pdf.worker");
      expect(worker.recibidos).toEqual([facturaMinima]);

      worker.responder("%PDF-1.3");
      expect((await promesa).toString()).toBe("%PDF-1.3");
    });

    it("reutiliza el hilo entre facturas en vez de crear uno por petición", async () => {
      const primera = service.generateInvoicePdf(facturaMinima);
      WorkerSimulado.creados[0].responder("%PDF-1");
      await primera;

      const segunda = service.generateInvoicePdf(facturaMinima);
      WorkerSimulado.creados[0].responder("%PDF-2");
      await segunda;

      expect(WorkerSimulado.creados).toHaveLength(1);
      expect(WorkerSimulado.creados[0].recibidos).toHaveLength(2);
    });

    it("no crea más hilos que el máximo, y encola el resto", async () => {
      const pendientes = Array.from({ length: 20 }, () =>
        service.generateInvoicePdf(facturaMinima)
      );

      expect(WorkerSimulado.creados.length).toBeLessThanOrEqual(4);

      // Cada respuesta libera el hilo, que recoge el siguiente de la cola.
      while (WorkerSimulado.creados.some((w) => w.recibidos.length > 0)) {
        const ocupados = WorkerSimulado.creados.filter(
          (w) => w.recibidos.length > 0
        );
        for (const worker of ocupados) {
          worker.recibidos.pop();
          worker.responder("%PDF");
        }
      }

      await expect(Promise.all(pendientes)).resolves.toHaveLength(20);
    });

    it("propaga el error del worker", async () => {
      const promesa = service.generateInvoicePdf(facturaMinima);
      WorkerSimulado.creados[0].emit("error", new Error("pdfkit falló"));

      await expect(promesa).rejects.toThrow("pdfkit falló");
    });

    it("falla si el worker termina con código distinto de cero", async () => {
      const promesa = service.generateInvoicePdf(facturaMinima);
      WorkerSimulado.creados[0].emit("exit", 1);

      await expect(promesa).rejects.toThrow("terminó con código 1");
    });

    it("devuelve el error de render sin tumbar el hilo", async () => {
      const promesa = service.generateInvoicePdf(facturaMinima);
      WorkerSimulado.creados[0].emit("message", {
        ok: false,
        error: "fuente no encontrada",
      });

      await expect(promesa).rejects.toThrow("fuente no encontrada");
    });

    it("cierra los hilos al parar el servicio", async () => {
      const promesa = service.generateInvoicePdf(facturaMinima);
      WorkerSimulado.creados[0].responder("%PDF");
      await promesa;

      await service.onModuleDestroy();

      expect(WorkerSimulado.creados[0].terminado).toBe(true);
    });
  });

  describe("savePdfToBuffer", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");

    it("debería guardar PDF en el directorio especificado", async () => {
      const pdfBuffer = Buffer.from("pdf-content");
      fs.existsSync.mockReturnValue(true);

      const result = await service.savePdfToBuffer(
        pdfBuffer,
        "INV-2023-001.pdf"
      );

      expect(result).toBe("./temp/invoices/INV-2023-001.pdf");
      expect(fs.writeFileSync).toHaveBeenCalledWith(result, pdfBuffer);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it("debería crear directorio si no existe", async () => {
      fs.existsSync.mockReturnValue(false);

      await service.savePdfToBuffer(
        Buffer.from("pdf-content"),
        "INV-2023-002.pdf"
      );

      expect(fs.mkdirSync).toHaveBeenCalledWith("./temp/invoices", {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("debería usar ruta personalizada del config", async () => {
      mockConfigService.get.mockReturnValue("./custom/path" as never);
      fs.existsSync.mockReturnValue(true);

      const result = await service.savePdfToBuffer(
        Buffer.from("pdf-content"),
        "INV-2023-003.pdf"
      );

      expect(mockConfigService.get).toHaveBeenCalledWith(
        "PDF_STORAGE_PATH",
        "./temp/invoices"
      );
      expect(result).toBe("./custom/path/INV-2023-003.pdf");
    });
  });
});
