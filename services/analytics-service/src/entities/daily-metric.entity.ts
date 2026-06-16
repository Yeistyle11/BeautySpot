import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";

@Entity("daily_metrics")
@Index(["businessId", "date"], { unique: true })
export class DailyMetricEntity extends TenantEntity {
  @Column({ type: "date" })
  date: string;

  @Column({ name: "total_appointments", default: 0 })
  totalAppointments: number;

  @Column({ name: "completed_appointments", default: 0 })
  completedAppointments: number;

  @Column({ name: "cancelled_appointments", default: 0 })
  cancelledAppointments: number;

  @Column({ name: "no_show_appointments", default: 0 })
  noShowAppointments: number;

  @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
  totalRevenue: number;

  @Column({ name: "new_clients", default: 0 })
  newClients: number;

  @Column({ name: "returning_clients", default: 0 })
  returningClients: number;
}
