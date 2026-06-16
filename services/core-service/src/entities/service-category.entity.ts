import { Entity, Column, OneToMany, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Service } from "./service.entity";

@Entity("service_categories")
@Index(["businessId", "active"])
export class ServiceCategoryEntity extends TenantEntity {
  @Column() name!: string;

  @Column({ type: "text", nullable: true }) description!: string;

  @Column({ nullable: true }) icon!: string;

  @Column({ nullable: true }) color!: string;

  @Column({ name: "sort_order", default: 0 }) sortOrder!: number;

  @Column({ default: true }) active!: boolean;

  @OneToMany(() => Service, (service) => service.categoryRef)
  services!: Service[];
}
