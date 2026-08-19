import { Entity, Column, Check, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

/**
 * Día o rango de días con un horario distinto al de la semana: un festivo, unas
 * vacaciones o una jornada reducida.
 */
@Entity("business_special_days")
@Index("idx_special_days_negocio_rango", ["businessId", "startDate", "endDate"])
@Check("CHK_special_days_rango", `"end_date" >= "start_date"`)
export class BusinessSpecialDay extends TenantEntity {
  @Column({ type: "uuid", name: "branch_id", nullable: true })
  branchId!: string | null;

  @Column({ type: "date", name: "start_date" })
  startDate!: string;

  @Column({ type: "date", name: "end_date" })
  endDate!: string;

  /** Cerrado todo el día; con `false`, valen `openTime` y `closeTime`. */
  @Column({ type: "boolean", default: true })
  closed!: boolean;

  @Column({ type: "varchar", length: 5, name: "open_time", nullable: true })
  openTime!: string | null;

  @Column({ type: "varchar", length: 5, name: "close_time", nullable: true })
  closeTime!: string | null;

  @Column({ type: "varchar", length: 120 })
  motivo!: string;
}
