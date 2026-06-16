import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

@Entity("blocked_slots")
@Index(["businessId", "professionalId", "date"])
export class BlockedSlot extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" }) professionalId!: string;
  @Column({ type: "date" }) date!: string;
  @Column({ name: "start_time" }) startTime!: string;
  @Column({ name: "end_time" }) endTime!: string;
  @Column({ nullable: true }) reason!: string;
}
