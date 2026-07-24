import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { Business } from "./business.entity";
import { ServiceCategoryEntity } from "./service-category.entity";

/** Servicio ofertado por un negocio: precio, duración y categoría. */
@Entity("services")
@Index(["businessId", "category"])
@Index(["businessId", "active"])
export class Service extends TenantEntity {
  @Column() name!: string;
  @Column({ type: "text" }) description!: string;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;
  @Column() duration!: number;
  @Column() category!: string;
  @Column({ type: "uuid", name: "category_id", nullable: true })
  categoryId!: string;
  @Column({ nullable: true }) image!: string;
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;

  @ManyToOne(() => ServiceCategoryEntity, (cat) => cat.services, {
    nullable: true,
  })
  @JoinColumn({ name: "category_id" })
  categoryRef!: ServiceCategoryEntity;
}
