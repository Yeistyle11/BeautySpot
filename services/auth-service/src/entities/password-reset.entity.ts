import { Exclude } from "class-transformer";
import { Entity, Column, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { User } from "./user.entity";

/** Token de recuperación de contraseña (solo su hash), con vencimiento y marca de uso. */
@Entity("password_resets")
export class PasswordReset extends BaseEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  /** Nunca sale en una respuesta: con el hash se identifica el enlace vivo. */
  @Exclude()
  @Column({ unique: true, name: "token_hash" })
  tokenHash!: string;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true, name: "used_at" })
  usedAt!: Date;

  // Sin @JoinColumn, TypeORM no reutiliza `user_id`: genera una segunda columna
  // "userId" y cuelga de ella la clave foránea, dejando la que sí usa el código
  // sin integridad referencial.
  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;
}
