import { Entity, Column, Check, Index } from "typeorm";
import { TenantEntity, enCatalogo } from "@beautyspot/database";

/** Visibilidad de una reseña. */
export enum ReviewStatus {
  PUBLICADA = "PUBLICADA",
  OCULTA = "OCULTA",
}

/** Reseña de un cliente sobre un negocio/profesional, con su calificación, respuesta y datos enriquecidos. */
@Entity("reviews")
// El catalogo de visibilidades, acotado en la base.
@Check("CHK_reviews_status", enCatalogo("status", Object.values(ReviewStatus)))
// El listado de un negocio ordena siempre por fecha; sin este índice Postgres
// lee todas sus reseñas y las ordena en memoria en cada página.
@Index("idx_reviews_negocio_fecha", ["businessId", "createdAt"])
// Una reseña por cita, y garantizado por la base: con un índice no único, dos
// altas simultáneas pasan las dos la comprobación previa.
@Index("idx_reviews_cita", ["appointmentId"], { unique: true })
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

  @Column({ type: "text", nullable: true }) response!: string | null;

  @Column({ type: "timestamptz", nullable: true, name: "responded_at" })
  respondedAt!: Date | null;

  /** Última edición del autor; se muestra para que se sepa que se cambió. */
  @Column({ type: "timestamptz", nullable: true, name: "edited_at" })
  editedAt!: Date | null;

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

  /** Visibilidad de la reseña. */
  @Column({ type: "varchar", default: ReviewStatus.PUBLICADA })
  status!: ReviewStatus;

  @Column({ type: "int", default: 0, name: "report_count" })
  reportCount!: number;

  // Relaciones: se consultan por businessId sin FK (agregacion en servicio)
}
