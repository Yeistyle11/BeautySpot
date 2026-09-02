import { z } from "zod";

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
  /** Cuándo se devolvió; nulo mientras el cobro siga vivo. */
  refundedAt: z.string().nullish(),
  /** Lo devuelto, que puede ser parte de lo cobrado. */
  refundAmount: z.number().nullish(),
  refundReason: z.string().nullish(),
  /** Rebaja concedida por el negocio, con su motivo. */
  descuentoComercial: z.number().nullish(),
  motivoDescuento: z.string().nullish(),
  /** Propina, que entró con el cobro pero no es ingreso del negocio. */
  propina: z.number().nullish(),
  /** Reparto por medio cuando el cobro entró por más de uno. */
  splits: z
    .array(z.object({ method: z.string(), amount: z.number() }))
    .nullish(),
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

/** Estados de PaymentStatus que la lista muestra tal cual. */
export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  REFUNDED: "Reembolsado",
  CANCELLED: "Cancelado",
};

/** Cita atendida del cliente, con sus servicios, tal y como la ofrece el cobro. */
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

/** Una parte del cobro: cuánto entra por ese medio. Importes como texto del formulario. */
export interface LineaDeCobro {
  method: string;
  amount: string;
}

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
  /** Rebaja que concede el negocio, con su motivo; solo la ofrece a quien puede. */
  descuentoComercial: "",
  motivoDescuento: "",
  /** Propina, que se cobra encima del importe. */
  propina: "",
  /** Reparto entre varios medios; vacío cobra todo por `method`. */
  metodos: [] as LineaDeCobro[],
};
export type CreateForm = typeof emptyCreateForm;

/** Lo que entra en el cobro: los servicios más la propina. */
export function totalDelCobro(form: CreateForm): number {
  return redondear((Number(form.amount) || 0) + (Number(form.propina) || 0));
}

/**
 * Lo que falta por repartir entre los medios elegidos. Negativo cuando se
 * asignó de más; cero cuando cuadra, que es lo que el servidor exige.
 */
export function faltaPorRepartir(form: CreateForm): number {
  const asignado = form.metodos.reduce(
    (suma, linea) => suma + (Number(linea.amount) || 0),
    0
  );
  return redondear(totalDelCobro(form) - asignado);
}

/** Redondea a céntimos, que es como se guarda el dinero. */
function redondear(importe: number): number {
  return Math.round(importe * 100) / 100;
}

/**
 * Cuerpo del alta de cobro. Los campos que el formulario deja vacíos no se
 * mandan: el servidor distingue «no lo pongo» de un cero.
 */
export function cobroParaEnviar(
  form: CreateForm,
  solicitudId?: string
): Record<string, unknown> {
  const reparto = form.metodos.filter((linea) => Number(linea.amount) > 0);
  return {
    clientId: form.clientId,
    appointmentId: form.appointmentId || undefined,
    amount: parseFloat(form.amount),
    method: form.method,
    reference: form.reference || undefined,
    notes: form.notes || undefined,
    // Sin canje no se manda el campo: el backend exige al menos un punto.
    puntosUsados: Number(form.puntosUsados) || undefined,
    descuentoComercial: Number(form.descuentoComercial) || undefined,
    motivoDescuento: form.motivoDescuento.trim() || undefined,
    propina: Number(form.propina) || undefined,
    metodos: reparto.length
      ? reparto.map((linea) => ({
          method: linea.method,
          amount: Number(linea.amount),
        }))
      : undefined,
    solicitudId: solicitudId || undefined,
  };
}

/**
 * Días desde el cobro dentro de los que el servicio admite una devolución. Es
 * el mismo número que aplica el backend: la pantalla lo dice antes de que
 * alguien pulse un botón que iba a responder 400.
 */
export const DIAS_PARA_DEVOLVER = 30;

/** Si el cobro se puede devolver, y si no, por qué no. */
export function estadoDeDevolucion(
  payment: Payment,
  ahora: Date = new Date()
): { puede: boolean; motivo?: string } {
  if (payment.status === "REFUNDED") {
    return { puede: false, motivo: "Este cobro ya se devolvió." };
  }
  if (payment.status !== "COMPLETED") {
    return {
      puede: false,
      motivo: "Solo se devuelve un cobro completado.",
    };
  }

  const dias =
    (ahora.getTime() - new Date(payment.createdAt).getTime()) / 86400000;
  if (dias > DIAS_PARA_DEVOLVER) {
    return {
      puede: false,
      motivo: `El plazo de devolución es de ${DIAS_PARA_DEVOLVER} días y ya pasó.`,
    };
  }

  return { puede: true };
}

export const emptyDevolucionForm = {
  /** `total` o `parcial`; el parcial pide importe. */
  alcance: "total",
  importe: "",
  motivo: "",
};
export type DevolucionForm = typeof emptyDevolucionForm;

/**
 * Cuerpo de la devolución. El total va sin importe —lo pone el servicio— para
 * no arriesgarse a devolver un céntimo de menos por redondeo del formulario.
 */
export function devolucionParaEnviar(form: DevolucionForm): {
  reason: string;
  refundAmount?: number;
} {
  const importe = Number(form.importe);

  return {
    reason: form.motivo.trim(),
    refundAmount:
      form.alcance === "parcial" && Number.isFinite(importe) && importe > 0
        ? importe
        : undefined,
  };
}

/** Si el formulario de devolución está listo para enviarse. */
export function devolucionCompleta(
  form: DevolucionForm,
  cobrado: number
): boolean {
  if (!form.motivo.trim()) return false;
  if (form.alcance === "total") return true;

  const importe = Number(form.importe);
  return Number.isFinite(importe) && importe > 0 && importe <= cobrado;
}

export const emptyEditForm = {
  amount: "",
  method: "",
  reference: "",
  notes: "",
  /** Obligatorio: la correccion queda escrita en el cobro con su motivo. */
  reason: "",
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
