import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Business } from "./business.entity";

/** Ajuste de configuración por negocio, guardado como par clave–valor JSON. */
@Entity("business_config")
@Unique(["businessId", "key"])
export class BusinessConfig extends TenantEntity {
  @Column() key!: string;
  @Column({ type: "jsonb" }) value!: Record<string, unknown>;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
