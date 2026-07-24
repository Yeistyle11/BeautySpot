// Esquemas Zod y tipos de los pagos.
import { z } from "zod";

export const paymentSchema = z.object({
  id: z.string(),
  amount: z.string(),
  method: z.string(),
  status: z.string(),
  registeredAt: z.string(),
  appointmentId: z.string().optional(),
  clientId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const clientSchema = z.object({ id: z.string(), name: z.string() });
export type Client = z.infer<typeof clientSchema>;

export const dailySummarySchema = z.object({
  date: z.string(),
  total: z.number(),
  count: z.number(),
  byMethod: z.record(z.string(), z.number()),
});
export type DailySummary = z.infer<typeof dailySummarySchema>;

export const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

export const METHOD_FILTERS = ["all", "CASH", "CARD", "TRANSFER"];

export const emptyCreateForm = {
  clientId: "",
  amount: "",
  method: "CASH",
  reference: "",
  notes: "",
};
export type CreateForm = typeof emptyCreateForm;

export const emptyEditForm = {
  amount: "",
  method: "",
  reference: "",
  notes: "",
};
export type EditForm = typeof emptyEditForm;

export interface PaymentSummary {
  total: number;
  cash: number;
  card: number;
  transfer: number;
  count: number;
}

export const PAYMENTS_KEY = "/payment/payments";
export const CLIENTS_KEY = "/core/clients";
