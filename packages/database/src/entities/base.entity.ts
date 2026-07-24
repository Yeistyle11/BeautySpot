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
 */
export abstract class BaseEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  /** Asigna un UUID v4 si la entidad aún no tiene id antes de insertarla. */
  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
