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
  @Column({ type: "uuid", name: "user_id", nullable: true }) userId!: string;
  @Column() name!: string;
  @Column({ nullable: true }) email!: string;
  @Column({ nullable: true }) phone!: string;
  @Column({ type: "text", nullable: true }) notes!: string;
  @Column({ name: "loyalty_points", default: 0 }) loyaltyPoints!: number;
  @Column({ type: "simple-array", nullable: true }) tags!: string[];
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
