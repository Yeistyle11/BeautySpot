import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Business } from "./business.entity";

/** Cliente de un negocio: datos de contacto, notas, puntos de fidelidad y etiquetas. */
@Entity("clients")
@Index(["businessId", "email"])
@Index(["businessId", "phone"])
@Index("idx_clients_negocio_usuario", ["businessId", "userId"])
// La ruta interna que resuelve los clientes de un usuario consulta por user_id
// sin negocio: lleva su propio indice.
@Index("idx_clients_usuario", ["userId"])
// El sondeo de cumpleaños solo mira las fichas que traen fecha, que son minoría.
@Index("idx_clients_cumpleanos", ["birthDate"], {
  where: '"birth_date" IS NOT NULL',
})
export class Client extends TenantEntity {
  @Column({ type: "uuid", name: "user_id", nullable: true })
  userId!: string | null;
  @Column() name!: string;
  // El tipo va explícito porque con `string | null` TypeORM no lo deduce.
  @Column({ type: "varchar", nullable: true }) email!: string | null;
  @Column({ type: "varchar", nullable: true }) phone!: string | null;
  /** Documento de identidad, necesario para identificar al receptor en la factura. */
  @Column({ type: "varchar", nullable: true }) documento!: string | null;
  @Column({ type: "text", nullable: true }) notes!: string | null;
  /** Fecha de nacimiento, de la que sale la felicitación de cumpleaños. */
  @Column({ type: "date", name: "birth_date", nullable: true })
  birthDate!: string | null;
  /**
   * Ano en el que ya se felicito al cliente, marcado en la misma transaccion
   * que el evento.
   */
  @Column({ type: "smallint", name: "birthday_greeted_year", nullable: true })
  birthdayGreetedYear!: number | null;
  @Column({ name: "loyalty_points", default: 0 }) loyaltyPoints!: number;
  /** Citas a las que el cliente no se presentó. */
  @Column({ name: "no_show_count", default: 0 }) noShowCount!: number;
  @Column({ type: "simple-array", nullable: true }) tags!: string[] | null;
  /**
   * Valores de la ficha que el negocio se haya definido, indexados por el id
   * de cada campo. Van en jsonb, sin migrar el esquema.
   */
  @Column({ type: "jsonb", nullable: true })
  ficha!: Record<string, unknown> | null;
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
