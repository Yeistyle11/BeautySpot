import { Entity, Column, OneToMany, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Professional } from "./professional.entity";

@Entity("professional_categories")
@Index(["businessId", "active"])
export class ProfessionalCategoryEntity extends TenantEntity {
  @Column() name!: string;

  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ nullable: true }) icon!: string;

  @Column({ nullable: true }) color!: string;

  @Column({ name: "sort_order", default: 0 }) sortOrder!: number;

  @Column({ default: true }) active!: boolean;

  @OneToMany(() => Professional, (professional) => professional.categoryRef)
  professionals!: Professional[];
}
