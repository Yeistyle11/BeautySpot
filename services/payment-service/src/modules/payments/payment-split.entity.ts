import { Entity, Column, Check, Index, ManyToOne, JoinColumn } from "typeorm";
import {
  BaseEntity,
  enCatalogo,
  numericTransformer,
} from "@beautyspot/database";
import { PaymentMethod } from "@beautyspot/shared-types";
import { PaymentEntity } from "./payment.entity";

/**
 * Lo que se pagó por un medio dentro de un cobro: «20.000 en efectivo y el
 * resto con tarjeta» son dos líneas del mismo cobro. Un cobro de un solo medio
 * también guarda la suya, para que la caja lea de una sola vía.
 */
@Entity("payment_splits")
// La caja y el arqueo leen las lineas de su cobro.
@Index("idx_payment_splits_cobro", ["paymentId"])
// El catalogo de medios, acotado en la base. MIXED no cabe aqui: una linea
// entra por un medio concreto.
@Check(
  "CHK_payment_splits_method",
  enCatalogo("method", Object.values(PaymentMethod))
)
export class PaymentSplitEntity extends BaseEntity {
  @Column({ type: "uuid", name: "payment_id" }) paymentId!: string;
  @Column({ type: "varchar" }) method!: PaymentMethod;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amount!: number;

  // La clave ajena se nombra y se borra en cascada igual que en la migración:
  // en desarrollo el esquema sale de la entidad y en producción de aquella.
  @ManyToOne(() => PaymentEntity, (payment) => payment.splits, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "payment_id",
    foreignKeyConstraintName: "FK_payment_splits_cobro",
  })
  payment!: PaymentEntity;
}
