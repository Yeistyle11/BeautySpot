import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

/** Franja horaria recurrente en que un profesional atiende, por día de la semana. */
@Entity("availabilities")
@Index(["businessId", "professionalId", "dayOfWeek"])
export class Availability extends TenantEntity {
  @Column({ type: "uuid", name: "professional_id" }) professionalId!: string;
  @Column({ name: "day_of_week" }) dayOfWeek!: number;
  @Column({ name: "start_time" }) startTime!: string;
  @Column({ name: "end_time" }) endTime!: string;
  @Column({ default: true }) active!: boolean;
}
