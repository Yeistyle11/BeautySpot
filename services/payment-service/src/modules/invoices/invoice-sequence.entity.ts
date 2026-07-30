import { Entity, Column, PrimaryColumn } from "typeorm";

/**
 * Último número de factura emitido por un negocio en un año; se reserva el
 * siguiente con un INSERT … ON CONFLICT DO UPDATE … RETURNING atómico.
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
