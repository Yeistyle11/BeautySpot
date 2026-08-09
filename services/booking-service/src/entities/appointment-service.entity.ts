import { Entity, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { BaseEntity, numericTransformer } from "@beautyspot/database";
import { Appointment } from "./appointment.entity";

/** Servicio incluido en una cita, con su precio y duración congelados al momento de reservar. */
@Entity("appointment_services")
@Unique(["appointmentId", "serviceId"])
export class AppointmentServiceEntity extends BaseEntity {
  @Column({ type: "uuid", name: "appointment_id" }) appointmentId!: string;
  @Column({ type: "uuid", name: "service_id" }) serviceId!: string;
  @Column({ name: "service_name" }) serviceName!: string;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;
  @Column() duration!: number;
  /** Posición dentro de la cita, de la que sale su hora de inicio. */
  @Column({ type: "int", default: 0 }) orden!: number;
  /** Ventana en que el profesional queda libre, congelada al reservar. */
  @Column({ type: "int", nullable: true, name: "procesado_desde" })
  procesadoDesde!: number | null;
  @Column({ type: "int", nullable: true, name: "procesado_minutos" })
  procesadoMinutos!: number | null;
  @Column({ type: "int", default: 0, name: "buffer_despues" })
  bufferDespues!: number;

  @ManyToOne(() => Appointment, (a) => a.appointmentServices, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "appointment_id" })
  appointment!: Appointment;
}
