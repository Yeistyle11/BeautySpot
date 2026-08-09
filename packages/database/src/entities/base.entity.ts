import {
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";

/**
 * Entidad base común: id UUID y marcas de tiempo de creación/actualización.
 * El id se genera en la aplicación antes del INSERT (@BeforeInsert).
 *
 * Las marcas son `timestamptz` y no `timestamp`: una columna sin huso guarda la
 * hora de pared de quien escribe —Postgres en UTC para los valores por defecto,
 * el proceso Node en su hora local para el resto— y quien lee después no puede
 * saber cuál de las dos era.
 */
export abstract class BaseEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  /** Asigna un UUID v4 si la entidad aún no tiene id antes de insertarla. */
  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
