import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/**
 * Marca de que un handler concreto ya aplicó un evento.
 *
 * La clave primaria es (event_id, handler) y no solo el evento: varios handlers
 * del mismo servicio pueden reaccionar al mismo evento, y cada uno lleva su
 * propia cuenta.
 */
@Entity("processed_events")
export class ProcessedEventEntity {
  @PrimaryColumn({ type: "uuid", name: "event_id" })
  eventId!: string;

  @PrimaryColumn({ type: "varchar", length: 200, name: "handler" })
  handler!: string;

  @Column({ type: "varchar", length: 200, name: "event_type" })
  eventType!: string;

  @CreateDateColumn({ name: "processed_at" })
  processedAt!: Date;
}
