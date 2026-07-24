/** Medios de pago admitidos para registrar un cobro. */
export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
  OTHER = "OTHER",
}

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
