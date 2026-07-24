import { Entity, Column, ManyToOne } from "typeorm";
import { BaseEntity } from "@beautyspot/database";
import { User } from "./user.entity";

/** Token de recuperación de contraseña (solo su hash), con vencimiento y marca de uso. */
@Entity("password_resets")
export class PasswordReset extends BaseEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ unique: true, name: "token_hash" })
  tokenHash!: string;

  @Column({ type: "timestamp", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamp", nullable: true, name: "used_at" })
  usedAt!: Date;

  @ManyToOne(() => User)
  user!: User;
}
