import { DeleteDateColumn } from "typeorm";
import { AuditableEntity } from "./audit.entity";

export abstract class SoftDeleteEntity extends AuditableEntity {
  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt?: Date;
}
