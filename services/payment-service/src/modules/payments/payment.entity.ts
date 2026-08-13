import { Entity, Column, Index } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { PaymentMethod, PaymentStatus } from "@beautyspot/shared-types";

/** Pago manual de un cliente (opcionalmente ligado a una cita), con sus datos de devolución. */
@Entity("payments")
@Index(["businessId", "createdAt"])
/**
 * Una cita no se cobra dos veces.
 *
 * El servicio ya lo comprueba antes de escribir, pero esa comprobación y la
 * escritura son dos pasos: dos cajeros cobrando la misma cita a la vez pueden
 * pasar los dos. Es la misma forma del doble-booking, con dinero, y se cierra
 * igual: con un índice parcial que solo mira los cobros vivos, para que anular
 * uno deje volver a cobrar.
 */
@Index("uq_payments_cita_viva", ["businessId", "appointmentId"], {
  unique: true,
  where: `"appointment_id" IS NOT NULL AND status IN ('PENDING', 'COMPLETED')`,
})
/**
 * Un cobro enviado dos veces se guarda una.
 *
 * Un cobro suelto no tiene cita que lo identifique, así que el índice de arriba
 * no lo cubre: tres clics en "Registrar pago" son tres cobros perfectamente
 * válidos y distintos a ojos de la base. El identificador lo pone quien cobra,
 * uno por formulario abierto, y este índice hace que el segundo envío choque en
 * vez de duplicar el cargo.
 */
@Index("uq_payments_solicitud", ["businessId", "solicitudId"], {
  unique: true,
  where: `"solicitud_id" IS NOT NULL`,
})
export class PaymentEntity extends TenantEntity {
  /** Identificador del intento de cobro; nulo en los cobros que no lo traen. */
  @Column({ type: "uuid", name: "solicitud_id", nullable: true })
  solicitudId!: string | null;
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
