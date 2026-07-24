import { Column } from "typeorm";
import { TenantEntity } from "./tenant.entity";

/**
 * Base multi-tenant que además registra quién creó y actualizó por última vez la
 * fila (auditoría), sobre las columnas de {@link TenantEntity}.
 */
export abstract class AuditableEntity extends TenantEntity {
  @Column({ type: "uuid", name: "created_by", nullable: true })
  createdBy?: string;

  @Column({ type: "uuid", name: "updated_by", nullable: true })
  updatedBy?: string;
}
