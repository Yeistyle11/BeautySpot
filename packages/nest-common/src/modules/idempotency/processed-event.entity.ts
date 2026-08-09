import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/** Marca de que un handler ya aplicó un evento; la clave es (event_id, handler). */
@Entity("processed_events")
export class ProcessedEventEntity {
  @PrimaryColumn({ type: "uuid", name: "event_id" })
  eventId!: string;

  @PrimaryColumn({ type: "varchar", length: 200, name: "handler" })
  handler!: string;

  @Column({ type: "varchar", length: 200, name: "event_type" })
  eventType!: string;

  @CreateDateColumn({ type: "timestamptz", name: "processed_at" })
  processedAt!: Date;
}
