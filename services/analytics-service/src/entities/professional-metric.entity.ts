import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";

/** Métricas de un profesional por día: citas, ingresos, valoración y tiempo medio de servicio. */
@Entity("professional_metrics")
@Index(["businessId", "professionalId", "date"], { unique: true })
// Los reportes filtran por negocio y rango de fechas agrupando por profesional;
// con professional_id en medio, el índice único no permite acotar por fecha.
@Index("idx_professional_metrics_negocio_fecha", ["businessId", "date"])
export class ProfessionalMetricEntity extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" })
  professionalId: string;

  @Column({ type: "date" })
  date: string;

  @Column({ default: 0 })
  appointments: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  revenue: number;

  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  rating: number;

  @Column({ name: "avg_service_time", type: "int", default: 0 })
  avgServiceTime: number;
}
