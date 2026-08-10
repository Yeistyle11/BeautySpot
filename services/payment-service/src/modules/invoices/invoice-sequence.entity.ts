import { Entity, Column, PrimaryColumn } from "typeorm";

/**
 * Último número de factura emitido por un negocio en una serie y un año; se
 * reserva el siguiente con un INSERT … ON CONFLICT DO UPDATE … RETURNING atómico.
 */
@Entity("invoice_sequences")
export class InvoiceSequenceEntity {
  @PrimaryColumn({ type: "uuid", name: "business_id" })
  businessId!: string;

  /** Prefijo de la numeración; el negocio lo configura en sus datos fiscales. */
  @PrimaryColumn({ type: "varchar", default: "INV" })
  serie!: string;

  @PrimaryColumn({ type: "int" })
  year!: number;

  @Column({ type: "int", name: "last_number", default: 0 })
  lastNumber!: number;
}
