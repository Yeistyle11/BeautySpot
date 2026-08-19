import { Entity, Column, Check, OneToMany, Index } from "typeorm";
import {
  TenantEntity,
  enCatalogo,
  numericTransformer,
} from "@beautyspot/database";
import { InvoiceStatus } from "@beautyspot/shared-types";
import { InvoiceItemEntity } from "./invoice-item.entity";

/**
 * Factura de un cliente: importe, estado y líneas, con un número único dentro
 * del negocio —cada uno lleva su propia serie— y no de la tabla.
 */
@Entity("invoices")
@Index(["businessId", "number"], { unique: true })
// El catalogo de estados, acotado en la base.
@Check(
  "CHK_invoices_status",
  enCatalogo("status", Object.values(InvoiceStatus))
)
export class InvoiceEntity extends TenantEntity {
  @Column({ type: "uuid", name: "client_id" }) clientId!: string;
  @Column() number!: string;
  @Column({ type: "date" }) date!: string;
  @Column({ type: "date", name: "due_date" }) dueDate!: string;
  /** Suma de las líneas, sin impuesto. */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  subtotal!: number;
  /**
   * Tipo aplicado, congelado al emitir. El IVA cambia por ley y una factura de
   * hoy no puede reimprimirse mañana con el tipo nuevo.
   */
  @Column({
    type: "decimal",
    precision: 5,
    scale: 4,
    name: "tax_rate",
    transformer: numericTransformer,
  })
  taxRate!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  tax!: number;
  /** `subtotal` + `tax`: lo que se cobra. */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  total!: number;
  @Column({ type: "varchar", default: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;
  @Column({ type: "text", nullable: true }) notes!: string;

  /** Las lineas se insertan con la factura, en el mismo `save`. */
  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice, {
    cascade: ["insert"],
  })
  items!: InvoiceItemEntity[];
}
