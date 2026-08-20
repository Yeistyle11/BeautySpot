import { Entity, Column, Check, Index, Unique } from "typeorm";
import { BaseEntity, enCatalogo } from "@beautyspot/database";

/** Motivos por los que se puede denunciar una reseña. */
export enum ReviewReportReason {
  OFENSIVA = "OFENSIVA",
  FALSA = "FALSA",
  SPAM = "SPAM",
  DATOS_PERSONALES = "DATOS_PERSONALES",
  OTRO = "OTRO",
}

/** Denuncia de un usuario sobre una reseña; una por usuario y reseña. */
@Entity("review_reports")
@Unique(["reviewId", "userId"])
// El catalogo de motivos, acotado en la base.
@Check(
  "CHK_review_reports_reason",
  enCatalogo("reason", Object.values(ReviewReportReason))
)
export class ReviewReportEntity extends BaseEntity {
  @Column({ type: "uuid", name: "review_id" })
  @Index()
  reviewId!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "varchar" })
  reason!: ReviewReportReason;

  @Column({ type: "text", nullable: true })
  detalle!: string | null;
}
