import { Entity, Column, OneToMany, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { InvoiceStatus } from "@beautyspot/shared-types";
import { InvoiceItemEntity } from "./invoice-item.entity";

@Entity("invoices")
@Index(["businessId", "number"], { unique: true })
export class InvoiceEntity extends TenantEntity {
  @Column({ type: "uuid", name: "client_id" }) clientId!: string;
  @Column({ unique: true }) number!: string;
  @Column({ type: "date" }) date!: string;
  @Column({ type: "date", name: "due_date" }) dueDate!: string;
  @Column({ type: "decimal", precision: 10, scale: 2, transformer: numericTransformer }) total!: number;
  @Column({ type: "enum", enum: InvoiceStatus, default: InvoiceStatus.DRAFT }) status!: InvoiceStatus;
  @Column({ type: "text", nullable: true }) notes!: string;

  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice)
  items!: InvoiceItemEntity[];
}
