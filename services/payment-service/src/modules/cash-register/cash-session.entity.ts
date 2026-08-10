import { Entity, Column, Index, OneToMany, BeforeInsert } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { CashMovementEntity } from "./cash-movement.entity";

/** Sesión de caja (arqueo): apertura con saldo inicial, cierre con saldo final y sus movimientos. */
@Entity("cash_sessions")
// Una caja abierta por sede. Los índices se declaran aquí con el mismo nombre
// que en las migraciones, porque los tests derivan el esquema de las entidades.
@Index("uq_cash_sessions_open_per_branch", ["businessId", "branchId"], {
  unique: true,
  where: '"closed_at" IS NULL AND "branch_id" IS NOT NULL',
})
// Cubre las cajas sin sede, que el índice anterior deja fuera.
@Index("uq_cash_sessions_open_per_business", ["businessId"], {
  unique: true,
  where: '"closed_at" IS NULL AND "branch_id" IS NULL',
})
export class CashSessionEntity extends TenantEntity {
  /** Sede de la caja; nulo en los negocios de un solo local. */
  @Column({ type: "uuid", name: "branch_id", nullable: true })
  branchId!: string | null;
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
  /** Saldo que debería haber en caja: apertura + entradas − salidas. */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    name: "expected_total",
    nullable: true,
  })
  expectedTotal!: number;
  /** `closingAmount` − `expectedTotal`: sobrante en positivo, faltante en negativo. */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    nullable: true,
  })
  difference!: number;
  @Column({ type: "timestamptz", name: "opened_at" }) openedAt!: Date;
  @Column({ type: "timestamptz", name: "closed_at", nullable: true })
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
