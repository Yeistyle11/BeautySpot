import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";

/** Pago manual de un cliente (opcionalmente ligado a una cita), con sus datos de devolución. */
@Entity("payments")
@Index(["businessId", "createdAt"])
export class PaymentEntity extends TenantEntity {
  /** Sede en la que se cobró; nulo en los negocios de un solo local. */
  @Column({ type: "uuid", name: "branch_id", nullable: true })
  branchId!: string | null;
  @Column({ type: "uuid", name: "appointment_id", nullable: true })
  appointmentId!: string;
  @Column({ type: "uuid", name: "client_id" }) clientId!: string;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amount!: number;
  @Column({ type: "enum", enum: PaymentMethod }) method!: PaymentMethod;
  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.COMPLETED,
  })
  status!: PaymentStatus;
  /**
   * Puntos de fidelidad que el cliente gastó en este cobro, y lo que rebajaron.
   *
   * Se guardan los dos: el valor del punto puede cambiar, y una vez cobrado hay
   * que poder explicar el importe con los números que se aplicaron entonces.
   */
  @Column({ type: "int", name: "puntos_usados", default: 0 })
  puntosUsados!: number;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  descuento!: number;
  @Column({ nullable: true }) reference!: string;
  @Column({ type: "text", nullable: true }) notes!: string;
  @Column({ type: "uuid", name: "registered_by", nullable: true })
  registeredBy!: string;

  @Column({ type: "timestamptz", name: "refunded_at", nullable: true })
  refundedAt!: Date | null;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
    name: "refund_amount",
    nullable: true,
  })
  refundAmount!: number | null;
  @Column({ type: "text", name: "refund_reason", nullable: true })
  refundReason!: string | null;
  @Column({ type: "varchar", name: "refunded_by", length: 100, nullable: true })
  refundedBy!: string | null;
}
