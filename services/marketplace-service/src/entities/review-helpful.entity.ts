import { Entity, Column, Unique } from "typeorm";
import { BaseEntity } from "@beautyspot/database";

/** Marca de "útil" de un usuario sobre una reseña; única por usuario y reseña para evitar votos repetidos. */
@Entity("review_helpful")
@Unique(["reviewId", "userId"])
export class ReviewHelpfulEntity extends BaseEntity {
  @Column({ type: "uuid", name: "review_id" })
  reviewId!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;
}
