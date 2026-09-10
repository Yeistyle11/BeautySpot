import {
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from "typeorm";
import { v4 as uuidv4 } from "uuid";

/**
 * Entidad base común: id UUID generado en la aplicación antes del INSERT y
 * marcas de tiempo. Son `timestamptz` porque una columna sin huso guarda la
 * hora de pared de quien escribe y quien lee no sabe cuál era.
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
