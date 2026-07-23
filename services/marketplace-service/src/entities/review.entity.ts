import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

@Entity("reviews")
export class ReviewEntity extends TenantEntity {
  @Column({ type: "uuid", name: "appointment_id", nullable: true })
  appointmentId!: string;

  @Column({ type: "uuid", name: "client_id" })
  @Index()
  clientId!: string;

  @Column({ type: "uuid", name: "professional_id", nullable: true })
  professionalId!: string;

  @Column({ type: "int" }) rating!: number;

  @Column({ type: "text", nullable: true }) comment!: string;

  @Column({ type: "text", nullable: true }) response!: string;

  @Column({ type: "timestamp", nullable: true, name: "responded_at" })
  respondedAt!: Date;

  // Campos enriquecidos

  @Column({ nullable: true, name: "service_name" })
  serviceName!: string;

  @Column({ nullable: true, name: "professional_name" })
  professionalName!: string;

  @Column({ type: "jsonb", nullable: true })
  photos!: string[] | null;

  @Column({ default: false, name: "is_verified" })
  isVerified!: boolean;

  @Column({ default: 0, name: "helpful_count" })
  helpfulCount!: number;

  // Relaciones: se consultan por businessId sin FK (agregacion en servicio)
}
