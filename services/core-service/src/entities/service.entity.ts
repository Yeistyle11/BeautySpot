import { Entity, Column, ManyToOne, JoinColumn, Index, Check } from "typeorm";
import { TenantEntity, numericTransformer } from "@beautyspot/database";
import { Business } from "./business.entity";
import { ServiceCategoryEntity } from "./service-category.entity";

/** Servicio ofertado por un negocio: precio, duración y categoría. */
@Entity("services")
@Index(["businessId", "category"])
@Index(["businessId", "active"])
// La ventana de procesado es una pareja y cabe dentro de la duración.
@Check(
  "CHK_procesado_pareja",
  `("procesado_desde" IS NULL) = ("procesado_minutos" IS NULL)`
)
@Check(
  "CHK_procesado_cabe",
  `"procesado_desde" IS NULL OR "procesado_desde" + "procesado_minutos" <= "duration"`
)
export class Service extends TenantEntity {
  @Column() name!: string;
  @Column({ type: "text" }) description!: string;
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;
  /** Minutos que la clienta pasa en el salón, procesado incluido. */
  @Column() duration!: number;
  /**
   * Ventana dentro de `duration` en la que el profesional queda libre. Nulos =
   * ocupa el servicio entero.
   */
  @Column({ type: "int", nullable: true, name: "procesado_desde" })
  procesadoDesde!: number | null;
  @Column({ type: "int", nullable: true, name: "procesado_minutos" })
  procesadoMinutos!: number | null;
  /** Limpieza posterior: sigue ocupado sin cliente delante. */
  @Column({ type: "int", default: 0, name: "buffer_despues" })
  bufferDespues!: number;
  @Column() category!: string;
  @Column({ type: "uuid", name: "category_id", nullable: true })
  categoryId!: string;
  @Column({ nullable: true }) image!: string;
  @Column({ default: true }) active!: boolean;

  @ManyToOne(() => Business)
  @JoinColumn({ name: "business_id" })
  business!: Business;

  @ManyToOne(() => ServiceCategoryEntity, (cat) => cat.services, {
    nullable: true,
  })
  @JoinColumn({ name: "category_id" })
  categoryRef!: ServiceCategoryEntity;
}
