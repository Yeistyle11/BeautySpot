import { Entity, Column, BeforeInsert } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { NotificationType, NotificationChannel } from "@beautyspot/shared-types";

@Entity("notifications")
export class NotificationEntity extends TenantEntity {
  @Column({ type: "uuid", name: "user_id" }) userId!: string;
  @Column({ type: "enum", enum: NotificationType }) type!: NotificationType;
  @Column({ type: "enum", enum: NotificationChannel }) channel!: NotificationChannel;
  @Column() title!: string;
  @Column({ type: "text" }) message!: string;
  @Column({ type: "jsonb", nullable: true }) data!: Record<string, unknown>;
  @Column({ default: false }) read!: boolean;
  @Column({ type: "timestamp", nullable: true, name: "sent_at" }) sentAt!: Date;

  @BeforeInsert()
  setSentAt(): void {
    if (!this.sentAt) this.sentAt = new Date();
  }
}
