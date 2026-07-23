import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity, numericTransformer } from "@beautyspot/database";
import { CashMovementType } from "@beautyspot/shared-types";
import { CashSessionEntity } from "./cash-session.entity";

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
  @Column({ type: "uuid", name: "registered_by" }) registeredBy!: string;

  @ManyToOne(() => CashSessionEntity, (session) => session.movements)
  @JoinColumn({ name: "cash_session_id" })
  cashSession!: CashSessionEntity;
}
