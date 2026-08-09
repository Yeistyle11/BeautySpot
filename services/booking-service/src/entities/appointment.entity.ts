import { Entity, Column, OneToMany, Index } from "typeorm";
import { AuditableEntity, numericTransformer } from "@beautyspot/database";
import { AppointmentStatus, CancelReason } from "@beautyspot/shared-types";
import { AppointmentServiceEntity } from "./appointment-service.entity";

/** Cita: reserva de un cliente con un profesional en una fecha/hora, su estado y los servicios incluidos. */
@Entity("appointments")
@Index(["businessId", "date"])
@Index(["professionalId", "date"])
@Index(["businessId", "professionalId", "date", "startTime"])
@Index("idx_appointments_cliente_fecha", ["clientId", "date"])
// El worker de recordatorios busca por fecha sin acotar por negocio, así que
// ninguno de los índices anteriores le sirve. Parcial porque solo mira citas
// vivas a las que aún les falta algún aviso: cubre el filtro entero.
@Index("idx_appointments_recordatorios", ["date"], {
  where: `"status" IN ('PENDING', 'CONFIRMED') AND ("reminder_24h_sent_at" IS NULL OR "reminder_1h_sent_at" IS NULL)`,
})
export class Appointment extends AuditableEntity {
  @Column({ type: "uuid", name: "branch_id", nullable: true })
  branchId!: string;
  @Column({ type: "uuid", name: "client_id" }) clientId!: string;
  @Column({ type: "uuid", name: "professional_id" }) professionalId!: string;
  @Column({ type: "date" }) date!: string;
  @Column({ name: "start_time" }) startTime!: string;
  @Column({ name: "end_time" }) endTime!: string;
  @Column({
    type: "enum",
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status!: AppointmentStatus;
  @Column({ nullable: true }) notes!: string;
  /** Nota libre de quien cancela; el motivo tipificado va en `cancelReasonType`. */
  @Column({ type: "varchar", name: "cancel_reason", nullable: true })
  cancelReason!: string | null;
  @Column({
    type: "varchar",
    name: "cancel_reason_type",
    nullable: true,
  })
  cancelReasonType!: CancelReason | null;
  @Column({ type: "uuid", name: "cancelled_by", nullable: true })
  cancelledBy!: string | null;
  @Column({ type: "timestamptz", name: "cancelled_at", nullable: true })
  cancelledAt!: Date | null;
  @Column({ name: "points_earned", default: 0 }) pointsEarned!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    default: 0,
  })
  totalAmount!: number;

  /** Hora hasta la que sigue ocupado: `endTime` más la limpieza del último servicio. */
  @Column({ type: "varchar", nullable: true, name: "ocupado_hasta" })
  ocupadoHasta!: string | null;

  /**
   * Horas a las que la cita empezó y terminó de verdad, frente a `startTime` /
   * `endTime`, que son las previstas. La diferencia es lo que dice si la
   * duración estimada de un servicio se ajusta a la realidad.
   */
  @Column({ type: "timestamptz", name: "started_at", nullable: true })
  startedAt!: Date | null;
  @Column({ type: "timestamptz", name: "completed_at", nullable: true })
  completedAt!: Date | null;

  @Column({ type: "timestamptz", name: "reminder_24h_sent_at", nullable: true })
  reminder24hSentAt!: Date | null;
  @Column({ type: "timestamptz", name: "reminder_1h_sent_at", nullable: true })
  reminder1hSentAt!: Date | null;

  @OneToMany(() => AppointmentServiceEntity, (as) => as.appointment)
  appointmentServices!: AppointmentServiceEntity[];
}
