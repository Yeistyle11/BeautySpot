import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";

/** Lo que aportó cada servicio en un día: veces prestado, ingresos y minutos. */
@Entity("service_metrics")
@Index(["businessId", "serviceId", "date"], { unique: true })
@Index(["businessId", "date"])
export class ServiceMetricEntity extends TenantEntity {
  @Column({ type: "uuid", name: "service_id" })
  serviceId!: string;

  @Column({ name: "service_name" })
  serviceName!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ default: 0 })
  veces!: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  ingresos!: number;

  @Column({ default: 0 })
  minutos!: number;
}
