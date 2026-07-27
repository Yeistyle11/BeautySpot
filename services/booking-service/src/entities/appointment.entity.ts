import { Entity, Column, OneToMany, Index } from "typeorm";
import { AuditableEntity, numericTransformer } from "@beautyspot/database";
import { AppointmentStatus } from "@beautyspot/shared-types";
import { AppointmentServiceEntity } from "./appointment-service.entity";

/** Cita: reserva de un cliente con un profesional en una fecha/hora, su estado y los servicios incluidos. */
@Entity("appointments")
@Index(["businessId", "date"])
@Index(["professionalId", "date"])
@Index(["businessId", "professionalId", "date", "startTime"])
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
  @Column({ name: "cancel_reason", nullable: true }) cancelReason!: string;
  @Column({ name: "points_earned", default: 0 }) pointsEarned!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    default: 0,
  })
  totalAmount!: number;

  @Column({ type: "timestamp", name: "reminder_24h_sent_at", nullable: true })
  reminder24hSentAt!: Date | null;
  @Column({ type: "timestamp", name: "reminder_1h_sent_at", nullable: true })
  reminder1hSentAt!: Date | null;

  @OneToMany(() => AppointmentServiceEntity, (as) => as.appointment)
  appointmentServices!: AppointmentServiceEntity[];
}
