// Esquemas Zod, tipos y textos de las facturas del negocio.
import { z } from "zod";

export const invoiceItemSchema = z.object({
  id: z.string().nullish(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  clientId: z.string(),
  /** Cobro del que salió; nulo en las escritas a mano. */
  paymentId: z.string().nullish(),
  date: z.string(),
  dueDate: z.string(),
  subtotal: z.number(),
  /** Tipo aplicado, en tanto por uno y congelado al emitir. */
  taxRate: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.string(),
  notes: z.string().nullish(),
  items: z.array(invoiceItemSchema).default([]),
});
export type Invoice = z.infer<typeof invoiceSchema>;

/** Cobro completado del negocio, que es lo que se puede facturar. */
export const cobroFacturableSchema = z.object({
  id: z.string(),
  amount: z.number(),
  method: z.string(),
  status: z.string(),
  createdAt: z.string(),
  clientId: z.string().nullish(),
});
export type CobroFacturable = z.infer<typeof cobroFacturableSchema>;

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Client = z.infer<typeof clientSchema>;

export const INVOICES_KEY = "/payment/invoices";
export const CLIENTS_KEY = "/core/clients";

/** Cómo se pinta cada estado de factura. */
export const ESTADOS: Record<
  string,
  { label: string; variant: "secondary" | "success" | "destructive" }
> = {
  DRAFT: { label: "Borrador", variant: "secondary" },
  SENT: { label: "Enviada", variant: "secondary" },
  PAID: { label: "Pagada", variant: "success" },
  CANCELLED: { label: "Anulada", variant: "destructive" },
};

/** Filtros de estado que ofrece el listado, en el orden en que se muestran. */
export const FILTROS_DE_ESTADO = [
  { valor: "all", etiqueta: "Todas" },
  { valor: "DRAFT", etiqueta: "Borradores" },
  { valor: "SENT", etiqueta: "Enviadas" },
  { valor: "PAID", etiqueta: "Pagadas" },
  { valor: "CANCELLED", etiqueta: "Anuladas" },
];

/**
 * A qué estados puede pasar una factura desde el suyo. Es el mismo cuadro que
 * aplica el servicio: la pantalla solo ofrece lo que el backend aceptaría, para
 * no proponer un botón que va a responder 400.
 */
export const SIGUIENTES_ESTADOS: Record<string, string[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

/** Verbo con el que se ofrece cada cambio de estado. */
export const ACCIONES_DE_ESTADO: Record<string, string> = {
  SENT: "Marcar enviada",
  PAID: "Marcar pagada",
  CANCELLED: "Anular",
};

/** El tipo impositivo congelado, tal como se enseña junto al importe. */
export function porcentajeDeImpuesto(taxRate: number): string {
  const porcentaje = taxRate * 100;
  return `${Number.isInteger(porcentaje) ? porcentaje : porcentaje.toFixed(2)} %`;
}
