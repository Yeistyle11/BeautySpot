import { Entity, Column, Check, ManyToOne, JoinColumn, Index } from "typeorm";
import { TenantEntity, enCatalogo } from "@beautyspot/database";
import { Business } from "./business.entity";

/** Tipos de dato que puede pedir un campo de la ficha del cliente. */
export enum TipoDeCampo {
  TEXTO = "texto",
  NUMERO = "numero",
  FECHA = "fecha",
  SI_NO = "si_no",
  OPCIONES = "opciones",
}

/**
 * Campo que un negocio añade a la ficha de sus clientes.
 *
 * Es configurable y no una columna fija porque una barbería y un centro
 * estético no piden lo mismo: alergias, tipo de piel o el color de partida solo
 * tienen sentido en algunos sitios.
 */
@Entity("campos_de_ficha")
// El catalogo de tipos, acotado en la base.
@Check(
  "CHK_campos_de_ficha_tipo",
  enCatalogo("tipo", Object.values(TipoDeCampo))
)
@Index(["businessId", "active"])
export class CampoDeFicha extends TenantEntity {
  @Column() etiqueta!: string;

  @Column({ type: "varchar", default: TipoDeCampo.TEXTO })
  tipo!: TipoDeCampo;

  /** Valores admitidos cuando el tipo es `opciones`. */
  @Column({ type: "jsonb", nullable: true })
  opciones!: string[] | null;

  @Column({ default: false }) obligatorio!: boolean;

  @Column({ type: "int", default: 0 }) orden!: number;

  /**
   * Servicios a los que aplica el campo; vacío o nulo significa "a todo
   * cliente". Va como lista y no como tabla puente: sin clave ajena, el id de un
   * servicio borrado deja de emparejar y ya está.
   */
  @Column({ type: "jsonb", nullable: true, name: "service_ids" })
  serviceIds!: string[] | null;

  // `active` y no `activo`, como el resto de entidades: es lo que mira la baja
  // lógica compartida de `TenantCrudService`.
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;
}
