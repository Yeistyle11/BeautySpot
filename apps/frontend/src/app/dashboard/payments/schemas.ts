// Esquemas Zod y tipos de los pagos.
import { z } from "zod";

// Los campos opcionales admiten null o ausencia.

export const paymentSchema = z.object({
  id: z.string(),
  amount: z.number(),
  method: z.string(),
  status: z.string(),
  createdAt: z.string(),
  appointmentId: z.string().nullish(),
  clientId: z.string().nullish(),
  reference: z.string().nullish(),
  notes: z.string().nullish(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Saldo de fidelización, para poder canjearlo al cobrar. */
  loyaltyPoints: z.number().default(0),
});
export type Client = z.infer<typeof clientSchema>;

export const dailySummarySchema = z.object({
  date: z.string(),
  total: z.number(),
  count: z.number(),
  byMethod: z.record(z.string(), z.number()),
});
export type DailySummary = z.infer<typeof dailySummarySchema>;

export { ETIQUETAS_DE_METODO as METHOD_LABELS } from "@/lib/metodos-de-pago";

export const METHOD_FILTERS = ["all", "CASH", "CARD", "TRANSFER"];

/** Estados de PaymentStatus, que la lista muestra tal cual si no se traducen. */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
};

/**
 * Cita atendida del cliente, tal y como la ofrece el cobro.
 *
 * Trae sus servicios porque son los que se nombran al elegirla: cobrar "Corte y
 * barba del martes" es lo que distingue una cita de otra del mismo importe.
 */
export const citaCobrableSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  totalAmount: z.union([z.string(), z.number()]),
  appointmentServices: z
    .array(z.object({ serviceName: z.string().nullish() }))
    .nullish(),
});
export type CitaCobrable = z.infer<typeof citaCobrableSchema>;

export const emptyCreateForm = {
  clientId: "",
  /** Cita que se cobra; vacío es una venta suelta, sin cita detrás. */
  appointmentId: "",
  amount: "",
  method: "CASH",
  reference: "",
  notes: "",
  /** Puntos de fidelidad que el cliente gasta en este cobro. */
  puntosUsados: "",
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
export const CLIENTS_KEY = "/core/clients?limit=100";
/** Cuáles de unas citas dadas ya tienen cobro; lo sabe payment, no booking. */
export const COBRADAS_KEY = "/payment/payments/cobradas";
