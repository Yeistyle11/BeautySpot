import { Column, Index } from "typeorm";
import { BaseEntity } from "./base.entity";

/**
 * Base para tablas multi-tenant: añade la columna indexada `businessId` que aísla
 * los datos de cada negocio (multi-tenancy lógica, ADR-002).
 */
export abstract class TenantEntity extends BaseEntity {
  @Column({ type: "uuid", name: "business_id" })
  @Index()
  businessId!: string;
}
