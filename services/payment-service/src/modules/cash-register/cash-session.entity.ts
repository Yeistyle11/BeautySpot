import { Entity, Column, OneToMany, BeforeInsert } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { CashMovementEntity } from "./cash-movement.entity";

@Entity("cash_sessions")
export class CashSessionEntity extends TenantEntity {
  @Column({ type: "uuid", name: "branch_id", nullable: true }) branchId!: string;
  @Column({ type: "uuid", name: "opened_by" }) openedBy!: string;
  @Column({ type: "uuid", name: "closed_by", nullable: true }) closedBy!: string;
  @Column({ type: "decimal", precision: 10, scale: 2, name: "opening_amount" }) openingAmount!: number;
  @Column({ type: "decimal", precision: 10, scale: 2, name: "closing_amount", nullable: true }) closingAmount!: number;
  @Column({ type: "timestamp", name: "opened_at" }) openedAt!: Date;
  @Column({ type: "timestamp", name: "closed_at", nullable: true }) closedAt!: Date;
  @Column({ type: "text", nullable: true }) notes!: string;

  @OneToMany(() => CashMovementEntity, (movement) => movement.cashSession)
  movements!: CashMovementEntity[];

  get isOpen(): boolean { return !this.closedAt; }

  @BeforeInsert()
  initOpenedAt(): void { if (!this.openedAt) this.openedAt = new Date(); }
}
