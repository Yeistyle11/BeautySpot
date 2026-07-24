import {
  Entity,
  Column,
  Index,
  PrimaryColumn,
  CreateDateColumn,
  BeforeInsert,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";

/** Estado de un mensaje del outbox: pendiente, ya publicado o descartado tras agotar reintentos. */
export enum OutboxStatus {
  PENDING = "PENDING",
  PROCESSED = "PROCESSED",
  DEAD = "DEAD",
}

/**
 * Evento persistido a la espera de ser publicado en RabbitMQ (patrón Transactional
 * Outbox). Guarda el payload, el agregado de origen y el conteo de intentos.
 */
@Entity("outbox_messages")
@Index(["status", "createdAt"])
export class OutboxMessageEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ type: "varchar", name: "aggregate_type", length: 100 })
  aggregateType!: string;

  @Column({ type: "varchar", name: "aggregate_id", length: 100 })
  aggregateId!: string;

  @Column({ type: "varchar", name: "event_type", length: 200 })
  eventType!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: "enum", enum: OutboxStatus, default: OutboxStatus.PENDING })
  status!: OutboxStatus;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "text", name: "last_error", nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ type: "timestamp", name: "processed_at", nullable: true })
  processedAt!: Date | null;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
