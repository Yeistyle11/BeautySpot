import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Business } from "./business.entity";

/** Cliente de un negocio: datos de contacto, notas, puntos de fidelidad y etiquetas. */
@Entity("clients")
@Index(["businessId", "email"])
@Index(["businessId", "phone"])
@Index("idx_clients_negocio_usuario", ["businessId", "userId"])
// El endpoint interno que resuelve los clientes de un usuario consulta por
// user_id sin negocio, así que necesita su propio índice.
@Index("idx_clients_usuario", ["userId"])
export class Client extends TenantEntity {
  @Column({ type: "uuid", name: "user_id", nullable: true })
  userId!: string | null;
  @Column() name!: string;
  // El tipo va explícito: con `string | null` TypeORM ya no puede deducirlo.
  @Column({ type: "varchar", nullable: true }) email!: string | null;
  @Column({ type: "varchar", nullable: true }) phone!: string | null;
  /** Documento de identidad, necesario para identificar al receptor en la factura. */
  @Column({ type: "varchar", nullable: true }) documento!: string | null;
  @Column({ type: "text", nullable: true }) notes!: string | null;
  @Column({ name: "loyalty_points", default: 0 }) loyaltyPoints!: number;
  @Column({ type: "simple-array", nullable: true }) tags!: string[] | null;
  @Column({ default: true }) active!: boolean;
  /**
   * Fecha en la que se ejerció el derecho de supresión. La fila se conserva
   * vaciada, no se borra: sus citas y facturas tienen que seguir cuadrando.
   */
  @Column({ type: "timestamptz", name: "anonymized_at", nullable: true })
  anonymizedAt!: Date | null;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
