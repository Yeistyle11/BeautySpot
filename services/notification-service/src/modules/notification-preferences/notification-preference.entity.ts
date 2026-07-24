import { Entity, Column } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

/** Preferencia de un usuario: si quiere recibir cierto tipo de notificación por cierto canal. */
@Entity("notification_preferences")
export class NotificationPreferenceEntity extends TenantEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "varchar" })
  type!: string;

  @Column({ type: "varchar" })
  channel!: string;

  @Column({ default: true })
  enabled!: boolean;
}
