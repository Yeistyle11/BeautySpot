import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { InvoiceEntity } from "./invoice.entity";

@Entity("invoice_items")
export class InvoiceItemEntity extends BaseEntity {
  @Column({ type: "uuid", name: "invoice_id" }) invoiceId!: string;
  @Column({ type: "text" }) description!: string;
  @Column({ type: "int" }) quantity!: number;
  @Column({ type: "decimal", precision: 10, scale: 2, name: "unit_price" }) unitPrice!: number;
  @Column({ type: "decimal", precision: 10, scale: 2 }) total!: number;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.items)
  @JoinColumn({ name: "invoice_id" })
  invoice!: InvoiceEntity;
}
