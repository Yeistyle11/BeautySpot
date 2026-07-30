import { Entity, Column, PrimaryColumn } from "typeorm";

/**
 * Último número de factura emitido por un negocio en un año.
 *
 * La numeración se sacaba de contar las facturas del negocio, lo que daba el
 * mismo número a dos altas simultáneas y recorría toda la tabla en cada una.
 * Aquí el número se reserva con un INSERT … ON CONFLICT DO UPDATE … RETURNING,
 * que es una sola operación atómica.
 */
@Entity("invoice_sequences")
export class InvoiceSequenceEntity {
  @PrimaryColumn({ type: "uuid", name: "business_id" })
  businessId!: string;

  @PrimaryColumn({ type: "int" })
  year!: number;

  @Column({ type: "int", name: "last_number", default: 0 })
  lastNumber!: number;
}
