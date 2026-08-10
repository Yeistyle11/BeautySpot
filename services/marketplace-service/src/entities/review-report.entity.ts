import { Entity, Column, Index, Unique } from "typeorm";
import { BaseEntity } from "@beautyspot/database";

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
