import { Column } from "typeorm";
import { TenantEntity } from "./tenant.entity";

export abstract class AuditableEntity extends TenantEntity {
  @Column({ type: "uuid", name: "created_by", nullable: true })
  createdBy?: string;

  @Column({ type: "uuid", name: "updated_by", nullable: true })
  updatedBy?: string;
}
