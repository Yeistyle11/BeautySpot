import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { Business } from "./business.entity";
import { Branch } from "./branch.entity";
import { ProfessionalCategoryEntity } from "./category.entity";

@Entity("professionals")
@Index(["businessId", "active"])
export class Professional extends TenantEntity {
  @Column({ type: "uuid", name: "branch_id", nullable: true })
  branchId!: string;
  @Column({ type: "uuid", name: "user_id", nullable: true }) userId!: string;
  @Column() name!: string;
  @Column({ nullable: true }) photo!: string;
  @Column({ type: "text", nullable: true }) bio!: string;
  @Column({ nullable: true }) category!: string;
  @Column({ type: "uuid", name: "category_id", nullable: true })
  categoryId!: string;
  @Column({ type: "simple-array" }) specialties!: string[];
  @Column({ name: "years_exp", default: 0 }) yearsExp!: number;
  @Column({
    type: "decimal",
    precision: 3,
    scale: 2,
    transformer: numericTransformer,
    default: 0,
  })
  rating!: number;
  @Column({ name: "total_reviews", default: 0 }) totalReviews!: number;
  @Column({ type: "jsonb", nullable: true }) portfolio!: {
    image: string;
    title?: string;
    description?: string;
  }[];
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: "branch_id" })
  branch!: Branch;

  @ManyToOne(() => ProfessionalCategoryEntity, (cat) => cat.professionals, {
    nullable: true,
  })
  @JoinColumn({ name: "category_id" })
  categoryRef!: ProfessionalCategoryEntity;
}
