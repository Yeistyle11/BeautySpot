/** Medios de pago admitidos para registrar un cobro. */
export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
  OTHER = "OTHER",
}

/**
 * Marca que un cobro se repartió entre varios medios; el reparto vive en las
 * líneas del cobro. Fuera de `PaymentMethod` a propósito: ese catálogo acota
 * también los movimientos de caja, que entran por un medio concreto.
 */
export const METODO_MIXTO = "MIXED";

/** Lo que puede guardar el `method` de un cobro: un medio, o el reparto. */
export type MetodoDeCobro = PaymentMethod | typeof METODO_MIXTO;

/** Estados por los que pasa un pago. */
export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

/** Estados por los que pasa una factura. */
export enum InvoiceStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
}

/** Sentido de un movimiento de caja: entrada o salida de efectivo. */
export enum CashMovementType {
  IN = "IN",
  OUT = "OUT",
}
