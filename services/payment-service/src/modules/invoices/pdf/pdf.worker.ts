import { parentPort } from "worker_threads";
import { construirPdfFactura, InvoiceData } from "./pdf.builder";

/** Respuesta que el hilo devuelve por cada factura que se le encarga. */
export type RespuestaWorker =
  | { ok: true; pdf: Buffer }
  | { ok: false; error: string };

/**
 * Hilo de render reutilizable: espera facturas por mensaje y devuelve el PDF.
 *
 * No termina tras el primer encargo porque el servicio mantiene un pool: crear
 * un hilo por petición cuesta más que el propio render (arranca un aislado de
 * V8 y vuelve a cargar pdfkit), y ese coste lo paga el hilo principal.
 */
parentPort?.on("message", async (data: InvoiceData) => {
  try {
    const pdf = await construirPdfFactura(data);
    parentPort?.postMessage({ ok: true, pdf } satisfies RespuestaWorker);
  } catch (error: unknown) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies RespuestaWorker);
  }
});
