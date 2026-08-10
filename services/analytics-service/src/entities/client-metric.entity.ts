import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";

/** Historial agregado de un cliente en un negocio: visitas, gasto y fechas. */
@Entity("client_metrics")
@Index(["businessId", "clientId"], { unique: true })
export class ClientMetricEntity extends TenantEntity {
  @Column({ type: "uuid", name: "client_id" })
  clientId!: string;

  @Column({ type: "date", name: "primera_visita" })
  primeraVisita!: string;

  @Column({ type: "date", name: "ultima_visita" })
  ultimaVisita!: string;

  @Column({ default: 0 })
  visitas!: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  gasto!: number;
}
