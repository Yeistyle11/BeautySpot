import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Worker } from "worker_threads";
import { cpus } from "os";
import { join } from "path";
import { InvoiceData } from "./pdf.builder";
import { RespuestaWorker } from "./pdf.worker";

export { InvoiceData };

/** Hilos de render como mucho, dejando margen para el resto del servicio. */
const MAXIMO_HILOS = Math.max(1, Math.min(4, cpus().length - 1));

/** Encargo pendiente: la factura y las funciones que resuelven su promesa. */
interface Encargo {
  data: InvoiceData;
  resolve: (pdf: Buffer) => void;
  reject: (error: Error) => void;
}

/** Ruta del worker ya compilado, junto a este mismo fichero en `dist`. */
function rutaDelWorker(): string {
  return join(__dirname, "pdf.worker.js");
}

/**
 * Genera los PDF de facturas repartiéndolos entre un pool de hilos que se
 * reutilizan, de modo que varias descargas a la vez no esperen unas por otras.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly libres: Worker[] = [];
  private readonly cola: Encargo[] = [];
  private readonly enCurso = new Map<Worker, Encargo>();
  private creados = 0;

  constructor(private readonly configService: ConfigService) {}

  /** Cierra los hilos del pool al parar el servicio. */
  async onModuleDestroy(): Promise<void> {
    const worker = [...this.libres, ...this.enCurso.keys()];
    this.libres.length = 0;
    this.enCurso.clear();
    await Promise.all(worker.map((w) => w.terminate()));
  }

  /** Construye el PDF completo de la factura y lo devuelve como Buffer. */
  generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      this.cola.push({ data, resolve, reject });
      this.repartir();
    });
  }

  /** Entrega el siguiente encargo a un hilo libre, creándolo si aún caben más. */
  private repartir(): void {
    if (this.cola.length === 0) return;

    const worker = this.libres.pop() ?? this.crearWorker();
    if (!worker) return;

    const encargo = this.cola.shift()!;
    this.enCurso.set(worker, encargo);
    worker.postMessage(encargo.data);
  }

  /** Añade un hilo al pool si no se ha alcanzado el máximo; si no, devuelve null. */
  private crearWorker(): Worker | null {
    if (this.creados >= MAXIMO_HILOS) return null;
    this.creados++;

    const worker = new Worker(rutaDelWorker());
    worker.on("message", (respuesta: RespuestaWorker) => {
      const encargo = this.enCurso.get(worker);
      this.enCurso.delete(worker);
      this.libres.push(worker);

      if (respuesta.ok) encargo?.resolve(Buffer.from(respuesta.pdf));
      else encargo?.reject(new Error(respuesta.error));

      this.repartir();
    });
    worker.on("error", (error: Error) => this.descartar(worker, error));
    worker.on("exit", (codigo) => {
      if (codigo !== 0) {
        this.descartar(
          worker,
          new Error(`El render del PDF terminó con código ${codigo}`)
        );
      }
    });

    return worker;
  }

  /** Saca del pool un hilo que murió y rechaza el encargo que tuviera entre manos. */
  private descartar(worker: Worker, error: Error): void {
    const encargo = this.enCurso.get(worker);
    this.enCurso.delete(worker);
    const libre = this.libres.indexOf(worker);
    if (libre !== -1) this.libres.splice(libre, 1);
    this.creados--;

    encargo?.reject(error);
    this.repartir();
  }

  /** Escribe el PDF en disco bajo la ruta configurada y devuelve la ruta del archivo. */
  async savePdfToBuffer(pdfBuffer: Buffer, filename: string): Promise<string> {
    const uploadPath = this.configService.get<string>(
      "PDF_STORAGE_PATH",
      "./temp/invoices"
    );
    const fs = await import("fs").then((m) => m.default);
    const path = await import("path").then((m) => m.default);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const filePath = path.join(uploadPath, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }
}
