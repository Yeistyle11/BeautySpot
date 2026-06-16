import { Column, Index } from "typeorm";
import { BaseEntity } from "./base.entity";

export abstract class TenantEntity extends BaseEntity {
  @Column({ type: "uuid", name: "business_id" })
  @Index()
  businessId!: string;
}
