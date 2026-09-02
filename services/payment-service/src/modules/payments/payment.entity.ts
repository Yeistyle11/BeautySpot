import { Entity, Column, Check, Index, OneToMany } from "typeorm";
import {
  TenantEntity,
  enCatalogo,
  numericTransformer,
} from "@beautyspot/database";
import {
  METODO_MIXTO,
  MetodoDeCobro,
  PaymentMethod,
  PaymentStatus,
} from "@beautyspot/shared-types";
import { PaymentSplitEntity } from "./payment-split.entity";

/** Pago manual de un cliente (opcionalmente ligado a una cita), con sus datos de devolución. */
@Entity("payments")
@Index(["businessId", "createdAt"])
/**
 * Una cita no se cobra dos veces. El indice solo mira los cobros vivos, asi
 * que anular uno deja volver a cobrar.
 */
@Index("uq_payments_cita_viva", ["businessId", "appointmentId"], {
  unique: true,
  where: `"appointment_id" IS NOT NULL AND status IN ('PENDING', 'COMPLETED')`,
})
/**
 * Un cobro enviado dos veces se guarda una: el identificador lo pone quien
 * cobra, uno por formulario abierto, y el segundo envio choca aqui.
 */
@Index("uq_payments_solicitud", ["businessId", "solicitudId"], {
  unique: true,
  where: `"solicitud_id" IS NOT NULL`,
})
// Los catalogos de metodo y estado, acotados en la base.
// Ademas de los medios, admite la marca de reparto: el detalle vive en las
// lineas del cobro.
@Check(
  "CHK_payments_method",
  enCatalogo("method", [...Object.values(PaymentMethod), METODO_MIXTO])
)
@Check(
  "CHK_payments_status",
  enCatalogo("status", Object.values(PaymentStatus))
)
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
  /** El medio del cobro, o `MIXED` cuando el importe se repartió entre varios. */
  @Column({ type: "varchar" }) method!: MetodoDeCobro;
  @Column({ type: "varchar", default: PaymentStatus.COMPLETED })
  status!: PaymentStatus;
  /**
   * Puntos de fidelidad que el cliente gasto en este cobro y lo que rebajaron,
   * con los numeros que se aplicaron entonces.
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

  /**
   * Rebaja que concede el negocio —la promocion del martes, el trato con un
   * cliente fiel—, con su motivo. Es distinta de {@link descuento}, que es lo
   * que rebajaron los puntos canjeados: una sale del margen y la otra de la
   * fidelizacion, y el negocio necesita saber cuanto regalo por cada via.
   */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    name: "descuento_comercial",
    default: 0,
    transformer: numericTransformer,
  })
  descuentoComercial!: number;
  @Column({ type: "text", name: "motivo_descuento", nullable: true })
  motivoDescuento!: string | null;

  /**
   * Propina, que no es ingreso del negocio: entra con el cobro y sale para el
   * profesional, asi que ni suma a las ventas ni se factura.
   */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
    transformer: numericTransformer,
  })
  propina!: number;
  /** A quien va la propina; se toma de la cita, y falta en los cobros sueltos. */
  @Column({ type: "uuid", name: "propina_profesional_id", nullable: true })
  propinaProfesionalId!: string | null;

  /**
   * Reparto del cobro por medio de pago. Suma `amount` mas `propina`: es el
   * dinero que entro, del que la caja solo se queda la parte en efectivo.
   */
  @OneToMany(() => PaymentSplitEntity, (split) => split.payment, {
    cascade: ["insert"],
  })
  splits!: PaymentSplitEntity[];

  /**
   * Traza de la correccion de un cobro. Un importe mal tecleado se corrige
   * mientras la caja que lo recogio sigue abierta, y queda escrito quien lo
   * hizo y por que; cerrada la caja, la via es la devolucion.
   */
  @Column({ type: "timestamptz", name: "edited_at", nullable: true })
  editedAt!: Date | null;
  @Column({ type: "uuid", name: "edited_by", nullable: true })
  editedBy!: string | null;
  @Column({ type: "text", name: "edit_reason", nullable: true })
  editReason!: string | null;

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
