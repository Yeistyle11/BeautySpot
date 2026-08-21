import { Entity, Column, Check, Index, ManyToOne, JoinColumn } from "typeorm";
import {
  BaseEntity,
  enCatalogo,
  numericTransformer,
} from "@beautyspot/database";
import { CashMovementType, PaymentMethod } from "@beautyspot/shared-types";
import { CashSessionEntity } from "./cash-session.entity";

/** Movimiento de caja (ingreso o egreso) registrado dentro de una sesión de caja. */
@Entity("cash_movements")
// El arqueo lee los movimientos de una sesion; la clave ajena no basta, que
// Postgres no la indexa sola.
@Index("idx_cash_movements_sesion", ["cashSessionId"])
// Los catalogos de las dos columnas, acotados en la base.
@Check(
  "CHK_cash_movements_type",
  enCatalogo("type", Object.values(CashMovementType))
)
@Check(
  "CHK_cash_movements_method",
  enCatalogo("method", Object.values(PaymentMethod), true)
)
export class CashMovementEntity extends BaseEntity {
  @Column({ type: "uuid", name: "cash_session_id" }) cashSessionId!: string;
  @Column({ type: "varchar" }) type!: CashMovementType;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amount!: number;
  @Column({ type: "text" }) concept!: string;
  /** Método del cobro; nulo en los movimientos que se anotan a mano. */
  @Column({ type: "varchar", nullable: true })
  method!: PaymentMethod | null;
  @Column({ type: "uuid", name: "payment_id", nullable: true })
  paymentId!: string | null;
  @Column({ type: "uuid", name: "registered_by" }) registeredBy!: string;

  @ManyToOne(() => CashSessionEntity, (session) => session.movements)
  @JoinColumn({ name: "cash_session_id" })
  cashSession!: CashSessionEntity;
}
