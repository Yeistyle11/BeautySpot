import { Entity, Column, Unique } from "typeorm";
import { BaseEntity } from "@beautyspot/database";

@Entity("review_helpful")
@Unique(["reviewId", "userId"])
export class ReviewHelpfulEntity extends BaseEntity {
  @Column({ type: "uuid", name: "review_id" })
  reviewId!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;
}
