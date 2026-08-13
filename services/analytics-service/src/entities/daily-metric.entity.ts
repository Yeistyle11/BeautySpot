import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";

/** Métricas agregadas de un negocio por día: citas, ingresos y clientes nuevos/recurrentes. */
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

  @Column({
    name: "total_revenue",
    type: "decimal",
    precision: 12,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  totalRevenue: number;

  /**
   * Cobros del día, que es de donde salen esos ingresos.
   *
   * El ticket medio se divide por aquí y no por las citas atendidas: son cosas
   * distintas —una venta de producto no tiene cita, y una cita atendida puede
   * cobrarse otro día— y mezclarlas da un promedio que no es de nada.
   */
  @Column({ default: 0 })
  ventas: number;

  @Column({ name: "new_clients", default: 0 })
  newClients: number;

  @Column({ name: "returning_clients", default: 0 })
  returningClients: number;
}
