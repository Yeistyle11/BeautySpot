import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { TenantEntity } from "@beautyspot/database";
import { Business } from "./business.entity";

/** Cliente de un negocio: datos de contacto, notas, puntos de fidelidad y etiquetas. */
@Entity("clients")
@Index(["businessId", "email"])
@Index(["businessId", "phone"])
// Una persona, una ficha: el cotejo previo del alta no basta porque entre la
// consulta y la escritura cabe otra transaccion. El indice deja fuera el nulo y
// la cadena vacia, que es lo que guarda la reserva del invitado sin contacto.
@Index("uq_clients_email_por_negocio", ["businessId", "email"], {
  unique: true,
  where: '"email" IS NOT NULL AND "email" <> \'\'',
})
@Index("uq_clients_telefono_por_negocio", ["businessId", "phone"], {
  unique: true,
  where: '"phone" IS NOT NULL AND "phone" <> \'\'',
})
@Index("idx_clients_negocio_usuario", ["businessId", "userId"])
// La ruta interna que resuelve los clientes de un usuario consulta por user_id
// sin negocio: lleva su propio indice.
@Index("idx_clients_usuario", ["userId"])
// El sondeo de cumpleaños solo mira las fichas que traen fecha, que son minoría.
@Index("idx_clients_cumpleanos", ["birthDate"], {
  where: '"birth_date" IS NOT NULL',
})
// Las fichas fusionadas son minoria y se consultan por su superviviente.
@Index("idx_clients_fusionadas", ["mergedIntoId"], {
  where: '"merged_into_id" IS NOT NULL',
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

  /**
   * Ficha en la que se fusionó esta. No se borra la absorbida: sus citas y
   * facturas viejas la referencian y tienen que seguir cuadrando, y así se
   * puede responder qué pasó con ella.
   */
  @Column({ type: "uuid", name: "merged_into_id", nullable: true })
  mergedIntoId!: string | null;

  @Column({ type: "timestamptz", name: "merged_at", nullable: true })
  mergedAt!: Date | null;

  /**
   * Correos y teléfonos heredados de las fichas absorbidas. El cotejo de
   * duplicados también los mira, de modo que una reserva futura hecha con el
   * contacto viejo cae en la ficha buena en vez de crear otra.
   */
  @Column({ type: "simple-array", nullable: true, name: "alias_emails" })
  aliasEmails!: string[] | null;

  @Column({ type: "simple-array", nullable: true, name: "alias_phones" })
  aliasPhones!: string[] | null;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
