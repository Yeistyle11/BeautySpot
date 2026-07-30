import { parentPort } from "worker_threads";
import { construirPdfFactura, InvoiceData } from "./pdf.builder";

/** Respuesta que el hilo devuelve por cada factura que se le encarga. */
export type RespuestaWorker =
  | { ok: true; pdf: Buffer }
  | { ok: false; error: string };

/**
 * Hilo de render reutilizable: se queda a la espera de facturas por mensaje y
 * devuelve el PDF de cada una.
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
