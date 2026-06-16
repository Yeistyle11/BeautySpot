import { Entity, Column, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";

@Entity("payments")
@Index(["businessId", "createdAt"])
export class PaymentEntity extends TenantEntity {
  @Column({ type: "uuid", name: "appointment_id", nullable: true }) appointmentId!: string;
  @Column({ type: "uuid", name: "client_id" }) clientId!: string;
  @Column({ type: "decimal", precision: 10, scale: 2 }) amount!: number;
  @Column({ type: "enum", enum: PaymentMethod }) method!: PaymentMethod;
  @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.COMPLETED }) status!: PaymentStatus;
  @Column({ nullable: true }) reference!: string;
  @Column({ type: "text", nullable: true }) notes!: string;
  @Column({ type: "uuid", name: "registered_by", nullable: true }) registeredBy!: string;
}
