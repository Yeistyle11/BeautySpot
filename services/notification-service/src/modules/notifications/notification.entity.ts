import { Entity, Column, BeforeInsert } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import {
  NotificationType,
  NotificationChannel,
} from "@beautyspot/shared-types";

/** Notificación in-app para un usuario: tipo, canal, contenido y estado de lectura. */
@Entity("notifications")
export class NotificationEntity extends TenantEntity {
  @Column({ type: "uuid", name: "user_id" }) userId!: string;
  @Column({ type: "enum", enum: NotificationType }) type!: NotificationType;
  @Column({ type: "enum", enum: NotificationChannel })
  channel!: NotificationChannel;
  @Column() title!: string;
  @Column({ type: "text" }) message!: string;
  @Column({ type: "jsonb", nullable: true }) data!: Record<string, unknown>;
  @Column({ default: false }) read!: boolean;
  @Column({ type: "timestamp", nullable: true, name: "sent_at" }) sentAt!: Date;

  /** Fija la fecha de envío al insertar si no se indicó. */
  @BeforeInsert()
  setSentAt(): void {
    if (!this.sentAt) this.sentAt = new Date();
  }
}
