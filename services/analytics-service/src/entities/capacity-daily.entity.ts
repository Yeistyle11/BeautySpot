import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

/** Minutos disponibles y vendidos de un profesional en un día. */
@Entity("capacity_daily")
@Index(["businessId", "professionalId", "date"], { unique: true })
@Index(["businessId", "date"])
export class CapacityDailyEntity extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" })
  professionalId!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ name: "minutos_disponibles", default: 0 })
  minutosDisponibles!: number;

  @Column({ name: "minutos_vendidos", default: 0 })
  minutosVendidos!: number;
}
