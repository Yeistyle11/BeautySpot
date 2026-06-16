import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Business } from "./business.entity";

@Entity("branches")
export class Branch extends TenantEntity {
  @Column() name!: string;
  @Column({ nullable: true }) address!: string;
  @Column({ nullable: true }) city!: string;
  @Column({ nullable: true }) state!: string;
  @Column({ nullable: true }) country!: string;
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true }) latitude!: number;
  @Column({ type: "decimal", precision: 10, scale: 7, nullable: true }) longitude!: number;
  @Column({ nullable: true }) phone!: string;
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business, (b) => b.branches)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
