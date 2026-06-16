import {
  Entity, Column,
  ManyToOne, JoinColumn, Unique,
} from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { Appointment } from "./appointment.entity";

@Entity("appointment_services")
@Unique(["appointmentId", "serviceId"])
export class AppointmentServiceEntity extends BaseEntity {
  @Column({ type: "uuid", name: "appointment_id" }) appointmentId!: string;
  @Column({ type: "uuid", name: "service_id" }) serviceId!: string;
  @Column({ name: "service_name" }) serviceName!: string;
  @Column({ type: "decimal", precision: 10, scale: 2 }) price!: number;
  @Column() duration!: number;

  @ManyToOne(() => Appointment, (a) => a.appointmentServices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "appointment_id" }) appointment!: Appointment;
}
