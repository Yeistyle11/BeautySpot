import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Business } from "./business.entity";

@Entity("business_hours")
export class BusinessHours extends TenantEntity {
  @Column({ type: "uuid", name: "branch_id", nullable: true }) branchId!: string;
  @Column({ name: "day_of_week" }) dayOfWeek!: number;
  @Column({ name: "open_time" }) openTime!: string;
  @Column({ name: "close_time" }) closeTime!: string;
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
