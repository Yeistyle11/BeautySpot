import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity, numericTransformer } from "@beautyspot/database";
import { CashMovementType, PaymentMethod } from "@beautyspot/shared-types";
import { CashSessionEntity } from "./cash-session.entity";

/** Movimiento de caja (ingreso o egreso) registrado dentro de una sesión de caja. */
@Entity("cash_movements")
export class CashMovementEntity extends BaseEntity {
  @Column({ type: "uuid", name: "cash_session_id" }) cashSessionId!: string;
  @Column({ type: "enum", enum: CashMovementType }) type!: CashMovementType;
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
