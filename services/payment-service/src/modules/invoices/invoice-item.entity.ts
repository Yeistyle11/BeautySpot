import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity, numericTransformer } from "@beautyspot/database";
import { InvoiceEntity } from "./invoice.entity";

/** Línea de una factura: descripción, cantidad, precio unitario y total. */
@Entity("invoice_items")
export class InvoiceItemEntity extends BaseEntity {
  @Column({ type: "uuid", name: "invoice_id" }) invoiceId!: string;
  @Column({ type: "text" }) description!: string;
  @Column({ type: "int" }) quantity!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    name: "unit_price",
  })
  unitPrice!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  total!: number;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.items)
  @JoinColumn({ name: "invoice_id" })
  invoice!: InvoiceEntity;
}
