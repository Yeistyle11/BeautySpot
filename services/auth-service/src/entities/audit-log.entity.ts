import { Entity, Column } from "typeorm";
import { BaseEntity } from "@beautyspot/database";

/** Registro de auditoría: quién hizo qué acción sobre qué entidad, con contexto de la petición. */
@Entity("audit_logs")
export class AuditLog extends BaseEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column()
  action!: string;

  @Column()
  entity!: string;

  @Column({ type: "uuid", nullable: true, name: "entity_id" })
  entityId!: string;

  @Column({ type: "jsonb", nullable: true })
  changes!: Record<string, unknown>;

  @Column({ nullable: true })
  ip!: string;

  @Column({ name: "user_agent", nullable: true })
  userAgent!: string;
}
