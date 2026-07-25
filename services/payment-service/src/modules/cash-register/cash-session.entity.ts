import { Entity, Column, Index, OneToMany, BeforeInsert } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { CashMovementEntity } from "./cash-movement.entity";

/** Sesión de caja (arqueo): apertura con saldo inicial, cierre con saldo final y sus movimientos. */
@Entity("cash_sessions")
// Un negocio no puede tener dos cajas abiertas a la vez. El índice lo crea la
// migración CashSessionSingleOpen1700000000003 en las bases existentes; hay que
// declararlo también aquí, con el MISMO nombre, para que el esquema generado por
// `synchronize` (el que usan los tests) no divergiera del de producción.
@Index("uq_cash_sessions_open_per_business", ["businessId"], {
  unique: true,
  where: '"closed_at" IS NULL',
})
export class CashSessionEntity extends TenantEntity {
  @Column({ type: "uuid", name: "branch_id", nullable: true })
  branchId!: string;
  @Column({ type: "uuid", name: "opened_by" }) openedBy!: string;
  @Column({ type: "uuid", name: "closed_by", nullable: true })
  closedBy!: string;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    name: "opening_amount",
  })
  openingAmount!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    name: "closing_amount",
    nullable: true,
  })
  closingAmount!: number;
  @Column({ type: "timestamp", name: "opened_at" }) openedAt!: Date;
  @Column({ type: "timestamp", name: "closed_at", nullable: true })
  closedAt!: Date;
  @Column({ type: "text", nullable: true }) notes!: string;

  @OneToMany(() => CashMovementEntity, (movement) => movement.cashSession)
  movements!: CashMovementEntity[];

  /** La sesión sigue abierta mientras no tenga fecha de cierre. */
  get isOpen(): boolean {
    return !this.closedAt;
  }

  /** Fija la fecha de apertura al insertar si no se indicó. */
  @BeforeInsert()
  initOpenedAt(): void {
    if (!this.openedAt) this.openedAt = new Date();
  }
}
