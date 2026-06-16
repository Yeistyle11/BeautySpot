import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

@Entity("professional_metrics")
@Index(["businessId", "professionalId", "date"], { unique: true })
export class ProfessionalMetricEntity extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" })
  professionalId: string;

  @Column({ type: "date" })
  date: string;

  @Column({ default: 0 })
  appointments: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  revenue: number;

  @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: "avg_service_time", type: "int", default: 0 })
  avgServiceTime: number;
}
